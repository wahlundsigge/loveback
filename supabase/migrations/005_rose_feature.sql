-- ============================================================
-- LoveBack — Rose / Super Like Feature
-- Run this in Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================

-- 1. Extend likes with type column
ALTER TABLE likes ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'like'
  CHECK (type IN ('like', 'super_like'));

-- 2. Extend matches with Rose metadata
ALTER TABLE matches ADD COLUMN IF NOT EXISTS super_liked_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS super_liked_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pending_reward INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS reward_paid    BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Extend coin_transactions type constraint (drop old, add new)
ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS valid_tx_type;
ALTER TABLE coin_transactions ADD CONSTRAINT valid_tx_type CHECK (type IN (
  'purchase','reward','unlock_match','refund',
  'admin_adjustment','bonus','promotion','withdrawal',
  'super_like','super_like_reward'
));

-- 4. Update regular unlock cost to 100 coins (≈ 8 SEK), scale reward to 25
UPDATE platform_settings SET value = '100' WHERE key = 'unlock_cost_coins';
UPDATE platform_settings SET value = '25'  WHERE key = 'reward_amount_coins';

-- 5. Platform settings for Rose pricing
INSERT INTO platform_settings (key, value, description) VALUES
  ('super_like_cost_coins',   '300', 'Coins to send a Rose (≈ 30 SEK)'),
  ('super_like_reward_coins', '150', 'Coins paid to recipient on first reply to a Rose')
ON CONFLICT (key) DO NOTHING;

-- 6. RPC: send_rose_atomic
--    Callable directly by authenticated users — uses auth.uid() internally.
CREATE OR REPLACE FUNCTION send_rose_atomic(p_to_user UUID, p_message TEXT)
RETURNS TABLE(success BOOLEAN, match_id UUID, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p_from_user UUID := auth.uid();
  v_cost      INTEGER;
  v_reward    INTEGER;
  v_bal       INTEGER;
  v_match_id  UUID;
  v_user1     UUID;
  v_user2     UUID;
BEGIN
  IF p_from_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'NOT_AUTHENTICATED'::TEXT; RETURN;
  END IF;
  IF p_from_user = p_to_user THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'CANNOT_ROSE_YOURSELF'::TEXT; RETURN;
  END IF;
  IF LENGTH(TRIM(p_message)) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'EMPTY_MESSAGE'::TEXT; RETURN;
  END IF;

  v_cost   := get_platform_setting('super_like_cost_coins');
  v_reward := get_platform_setting('super_like_reward_coins');

  SELECT coin_balance INTO v_bal FROM profiles WHERE id = p_from_user FOR UPDATE;
  IF v_bal < v_cost THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'INSUFFICIENT_BALANCE'::TEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_to_user) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'RECIPIENT_NOT_FOUND'::TEXT; RETURN;
  END IF;

  -- Idempotency: already sent a rose to this person?
  SELECT m.id INTO v_match_id FROM matches m
  WHERE m.super_liked_by = p_from_user
    AND (m.user1 = p_to_user OR m.user2 = p_to_user);
  IF v_match_id IS NOT NULL THEN
    RETURN QUERY SELECT TRUE, v_match_id, 'ALREADY_SENT'::TEXT; RETURN;
  END IF;

  -- Upsert like as super_like
  INSERT INTO likes (from_user, to_user, type)
  VALUES (p_from_user, p_to_user, 'super_like')
  ON CONFLICT (from_user, to_user) DO UPDATE SET type = 'super_like';

  -- Create match (sorted IDs for UNIQUE constraint)
  v_user1 := LEAST(p_from_user, p_to_user);
  v_user2 := GREATEST(p_from_user, p_to_user);

  INSERT INTO matches (
    user1, user2, chat_unlocked, match_locked, paid_by,
    super_liked_by, super_liked_at, pending_reward, reward_paid
  ) VALUES (
    v_user1, v_user2, TRUE, FALSE, p_from_user,
    p_from_user, NOW(), v_reward, FALSE
  )
  ON CONFLICT (user1, user2) DO UPDATE SET
    chat_unlocked  = TRUE,
    super_liked_by = p_from_user,
    super_liked_at = NOW(),
    pending_reward = v_reward,
    reward_paid    = FALSE
  RETURNING id INTO v_match_id;

  -- Insert intro message (chat_unlocked=TRUE so messages RLS passes)
  INSERT INTO messages (match_id, sender, sender_name, text)
  SELECT v_match_id, p_from_user, p.name, TRIM(p_message)
  FROM profiles p WHERE p.id = p_from_user;

  -- Deduct coins from sender
  PERFORM grant_coins(
    p_from_user, -v_cost, 'super_like',
    v_match_id, 'match',
    'Rose skickad',
    'rose_deduct_' || v_match_id::TEXT || '_' || p_from_user::TEXT,
    '{}'::JSONB
  );

  RETURN QUERY SELECT TRUE, v_match_id, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION send_rose_atomic(UUID, TEXT) TO authenticated;

-- 7. RPC: pay_rose_reward
--    Called after recipient sends their first reply.
CREATE OR REPLACE FUNCTION pay_rose_reward(p_match_id UUID)
RETURNS TABLE(success BOOLEAN, coins_earned INTEGER, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_match   RECORD;
  v_replier UUID := auth.uid();
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'MATCH_NOT_FOUND'::TEXT; RETURN;
  END IF;
  IF v_match.reward_paid OR v_match.pending_reward = 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'NO_PENDING_REWARD'::TEXT; RETURN;
  END IF;
  IF v_match.super_liked_by = v_replier THEN
    RETURN QUERY SELECT FALSE, 0, 'SENDER_CANNOT_CLAIM'::TEXT; RETURN;
  END IF;
  IF v_match.user1 != v_replier AND v_match.user2 != v_replier THEN
    RETURN QUERY SELECT FALSE, 0, 'NOT_PARTICIPANT'::TEXT; RETURN;
  END IF;

  -- Mark paid first to prevent double-pay
  UPDATE matches SET reward_paid = TRUE WHERE id = p_match_id;

  PERFORM grant_coins(
    v_replier, v_match.pending_reward, 'super_like_reward',
    p_match_id, 'match',
    'Rose-beloning — du svarade!',
    'rose_reward_' || p_match_id::TEXT,
    '{}'::JSONB
  );

  RETURN QUERY SELECT TRUE, v_match.pending_reward, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION pay_rose_reward(UUID) TO authenticated;
