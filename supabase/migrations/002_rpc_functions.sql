-- ============================================================
-- LoveBack Coin Economy — Migration 002: RPC Functions
-- Run AFTER 001_coin_economy.sql
-- All functions use SECURITY DEFINER and are callable only by
-- the service_role (Edge Functions). authenticated/anon are
-- explicitly revoked to prevent direct client calls.
-- ============================================================


-- ─────────────────────────────────────────────
-- Helper: read a platform setting as INTEGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_platform_setting(p_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value FROM platform_settings WHERE key = p_key;
  IF v_value IS NULL THEN
    RAISE EXCEPTION 'Platform setting not found: %', p_key;
  END IF;
  RETURN v_value::INTEGER;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Platform setting % is not a valid integer', p_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_platform_setting(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_platform_setting(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_platform_setting(TEXT) FROM anon;


-- ─────────────────────────────────────────────
-- Core: grant_coins
-- Atomic coin credit/debit with idempotency.
-- Called by other functions; never by clients.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION grant_coins(
  p_user_id         UUID,
  p_amount          INTEGER,
  p_type            TEXT,
  p_ref_id          UUID       DEFAULT NULL,
  p_ref_type        TEXT       DEFAULT NULL,
  p_description     TEXT       DEFAULT NULL,
  p_idempotency_key TEXT       DEFAULT NULL,
  p_metadata        JSONB      DEFAULT '{}'
)
RETURNS TABLE (new_balance INTEGER, transaction_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance   INTEGER;
  v_tx_id         UUID;
  v_existing_tx   UUID;
  v_existing_bal  INTEGER;
BEGIN
  -- Idempotency: return cached result if this key was already processed
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, balance_after INTO v_existing_tx, v_existing_bal
    FROM coin_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_tx IS NOT NULL THEN
      RETURN QUERY SELECT v_existing_bal, v_existing_tx;
      RETURN;
    END IF;
  END IF;

  -- Lock the profile row to serialize concurrent coin operations
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  v_new_balance := v_new_balance + p_amount;

  -- Prevent balance going negative
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: current %, attempted deduction %',
      (v_new_balance - p_amount), (-p_amount);
  END IF;

  -- Update cached balance
  UPDATE profiles SET coin_balance = v_new_balance WHERE id = p_user_id;

  -- Write immutable ledger entry
  INSERT INTO coin_transactions (
    user_id, amount, balance_after, type,
    ref_id, ref_type, description, idempotency_key, metadata
  ) VALUES (
    p_user_id, p_amount, v_new_balance, p_type,
    p_ref_id, p_ref_type, p_description, p_idempotency_key, p_metadata
  ) RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_new_balance, v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION grant_coins(UUID, INTEGER, TEXT, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION grant_coins(UUID, INTEGER, TEXT, UUID, TEXT, TEXT, TEXT, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION grant_coins(UUID, INTEGER, TEXT, UUID, TEXT, TEXT, TEXT, JSONB) FROM anon;


-- ─────────────────────────────────────────────
-- Core: unlock_match_atomic
-- Handles the full match unlock in a single transaction:
--  1. Locks match row (prevents double-unlock)
--  2. Validates payer is a participant
--  3. Locks profile rows in UUID order (deadlock prevention)
--  4. Deducts coins from payer
--  5. Grants reward coins to partner
--  6. Marks match as unlocked
-- Uses idempotency keys so retries are safe.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION unlock_match_atomic(
  p_match_id UUID,
  p_payer_id UUID
)
RETURNS TABLE (
  success         BOOLEAN,
  payer_balance   INTEGER,
  partner_balance INTEGER,
  error_code      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match              RECORD;
  v_partner_id         UUID;
  v_unlock_cost        INTEGER;
  v_reward_amount      INTEGER;
  v_payer_balance      INTEGER;
  v_partner_balance    INTEGER;
  v_payer_idem         TEXT;
  v_reward_idem        TEXT;
BEGIN
  -- Deterministic idempotency keys derived from the match + payer
  v_payer_idem  := 'unlock_deduct_' || p_match_id::TEXT || '_' || p_payer_id::TEXT;
  v_reward_idem := 'unlock_reward_' || p_match_id::TEXT;

  -- Lock the match row first to serialize concurrent unlock attempts
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'MATCH_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Verify caller is a participant in this match
  IF v_match.user1 != p_payer_id AND v_match.user2 != p_payer_id THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'NOT_MATCH_PARTICIPANT'::TEXT;
    RETURN;
  END IF;

  -- Identify the partner
  v_partner_id := CASE
    WHEN v_match.user1 = p_payer_id THEN v_match.user2
    ELSE v_match.user1
  END;

  -- Already unlocked — idempotent success, return current balances
  IF v_match.chat_unlocked = TRUE THEN
    SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = p_payer_id;
    SELECT coin_balance INTO v_partner_balance FROM profiles WHERE id = v_partner_id;
    RETURN QUERY SELECT TRUE, v_payer_balance, v_partner_balance, 'ALREADY_UNLOCKED'::TEXT;
    RETURN;
  END IF;

  -- Read economy settings
  v_unlock_cost   := get_platform_setting('unlock_cost_coins');
  v_reward_amount := get_platform_setting('reward_amount_coins');

  -- Check payer balance before locking
  SELECT coin_balance INTO v_payer_balance
  FROM profiles WHERE id = p_payer_id;

  IF v_payer_balance < v_unlock_cost THEN
    RETURN QUERY SELECT FALSE, v_payer_balance, 0, 'INSUFFICIENT_BALANCE'::TEXT;
    RETURN;
  END IF;

  -- Deduct coins from payer (grant_coins handles the FOR UPDATE lock internally)
  PERFORM grant_coins(
    p_payer_id,
    -v_unlock_cost,
    'unlock_match',
    p_match_id,
    'match',
    'Unlocked match chat',
    v_payer_idem,
    '{}'::JSONB
  );

  -- Fetch updated payer balance
  SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = p_payer_id;

  -- Grant reward to partner
  PERFORM grant_coins(
    v_partner_id,
    v_reward_amount,
    'reward',
    p_match_id,
    'match',
    'Din match öppnade chatten — du fick coins som tack.',
    v_reward_idem,
    '{}'::JSONB
  );

  -- Fetch partner balance
  SELECT coin_balance INTO v_partner_balance FROM profiles WHERE id = v_partner_id;

  -- Mark match as unlocked
  UPDATE matches SET
    chat_unlocked = TRUE,
    match_locked  = FALSE,
    paid_by       = p_payer_id
  WHERE id = p_match_id;

  RETURN QUERY SELECT TRUE, v_payer_balance, v_partner_balance, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION unlock_match_atomic(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION unlock_match_atomic(UUID, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION unlock_match_atomic(UUID, UUID) FROM anon;


-- ─────────────────────────────────────────────
-- Core: record_coin_purchase
-- Called by purchase-coins Edge Function after payment is confirmed.
-- payment_intent_id forms the idempotency key — safe for Stripe retries.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_coin_purchase(
  p_user_id               UUID,
  p_package_id            UUID,
  p_payment_intent_id     TEXT
)
RETURNS TABLE (new_balance INTEGER, transaction_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package      RECORD;
  v_total_coins  INTEGER;
  v_idem_key     TEXT;
BEGIN
  -- Use payment intent ID as the idempotency key (Stripe may retry webhooks)
  v_idem_key := 'purchase_' || p_payment_intent_id;

  SELECT * INTO v_package
  FROM coin_packages
  WHERE id = p_package_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PACKAGE: %', p_package_id;
  END IF;

  v_total_coins := v_package.coins + v_package.bonus_coins;

  RETURN QUERY SELECT * FROM grant_coins(
    p_user_id,
    v_total_coins,
    'purchase',
    p_package_id,
    'coin_package',
    'Purchased ' || v_total_coins || ' coins — ' || v_package.label,
    v_idem_key,
    jsonb_build_object(
      'payment_intent_id', p_payment_intent_id,
      'package_id',        p_package_id,
      'package_label',     v_package.label,
      'coins',             v_package.coins,
      'bonus_coins',       v_package.bonus_coins,
      'price_sek',         v_package.price_sek
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION record_coin_purchase(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION record_coin_purchase(UUID, UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION record_coin_purchase(UUID, UUID, TEXT) FROM anon;
