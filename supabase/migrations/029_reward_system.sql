-- ── Reward system: daily claims, referral, new-user bonus, IAP prep ─────────

-- 1. New transaction types
ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS valid_tx_type;
ALTER TABLE coin_transactions ADD CONSTRAINT valid_tx_type CHECK (type IN (
  'purchase','reward','unlock_match','refund','admin_adjustment','bonus',
  'promotion','withdrawal','super_like','super_like_reward',
  'boost','duo_unlock_match','duo_reward','duo_slot_purchase',
  'daily_reward','new_user_bonus','referral_bonus'
));

-- 2. Daily claim tracking
CREATE TABLE IF NOT EXISTS daily_claims (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_day   INTEGER NOT NULL DEFAULT 1,
  coins_earned INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, claimed_date)
);
ALTER TABLE daily_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_claims_own" ON daily_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON daily_claims FROM authenticated, anon;

-- 3. Referral codes (one per user, permanent)
CREATE TABLE IF NOT EXISTS referral_codes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  code       TEXT NOT NULL UNIQUE,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_codes_read" ON referral_codes FOR SELECT TO authenticated USING (TRUE);
REVOKE INSERT, UPDATE, DELETE ON referral_codes FROM authenticated, anon;

-- 4. Referral use log (one per new user — prevents re-use)
CREATE TABLE IF NOT EXISTS referral_uses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_uses_own" ON referral_uses FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON referral_uses FROM authenticated, anon;

-- 5. IAP prep: add store product IDs to coin_packages
ALTER TABLE coin_packages ADD COLUMN IF NOT EXISTS apple_product_id TEXT;
ALTER TABLE coin_packages ADD COLUMN IF NOT EXISTS google_product_id TEXT;

-- 6. Platform settings for rewards
INSERT INTO platform_settings (key, value, description) VALUES
  ('daily_reward_base_coins',   '15',  'Coins awarded on day 1 of a daily streak'),
  ('daily_reward_streak_bonus', '5',   'Extra coins added per 7-day streak tier'),
  ('new_user_bonus_coins',      '100', 'One-time bonus when profile is completed'),
  ('referral_reward_coins',     '50',  'Coins earned by referrer when their code is used'),
  ('referral_bonus_coins',      '25',  'Bonus for new user who enters a referral code')
ON CONFLICT (key) DO NOTHING;

-- 7. RPC: claim_new_user_bonus — idempotent one-time grant
CREATE OR REPLACE FUNCTION claim_new_user_bonus()
RETURNS TABLE(success BOOLEAN, coins_earned INTEGER, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_amount INTEGER;
BEGIN
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'NOT_AUTHENTICATED'::TEXT; RETURN;
  END IF;
  v_amount := get_platform_setting('new_user_bonus_coins');
  BEGIN
    PERFORM grant_coins(
      v_caller, v_amount, 'new_user_bonus', NULL::UUID, NULL::TEXT,
      'Välkommen till LoveBack! 🎉',
      'new_user_bonus_' || v_caller::TEXT,
      '{}'::JSONB
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, 0, 'ALREADY_CLAIMED'::TEXT; RETURN;
  END;
  RETURN QUERY SELECT TRUE, v_amount, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION claim_new_user_bonus() TO authenticated;

-- 8. RPC: get_daily_claim_status — read-only, for UI rendering
CREATE OR REPLACE FUNCTION get_daily_claim_status()
RETURNS TABLE(
  claimed_today        BOOLEAN,
  streak_day           INTEGER,
  next_reward_coins    INTEGER,
  days_to_next_bonus   INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_today   DATE := CURRENT_DATE;
  v_last    RECORD;
  v_streak  INT;
  v_base    INT;
  v_bonus   INT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0; RETURN;
  END IF;
  v_base  := get_platform_setting('daily_reward_base_coins');
  v_bonus := get_platform_setting('daily_reward_streak_bonus');
  SELECT * INTO v_last FROM daily_claims
  WHERE user_id = v_caller ORDER BY claimed_date DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, v_base, 7; RETURN;
  END IF;
  IF v_last.claimed_date = v_today THEN
    v_streak := v_last.streak_day;
    RETURN QUERY SELECT TRUE, v_streak,
      v_base + ((v_streak / 7) * v_bonus),
      7 - (v_streak % 7);
  ELSIF v_last.claimed_date = v_today - 1 THEN
    v_streak := v_last.streak_day + 1;
    RETURN QUERY SELECT FALSE, v_streak,
      v_base + (((v_streak - 1) / 7) * v_bonus),
      7 - ((v_streak - 1) % 7);
  ELSE
    RETURN QUERY SELECT FALSE, 0, v_base, 7;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION get_daily_claim_status() TO authenticated;

-- 9. RPC: claim_daily_reward
CREATE OR REPLACE FUNCTION claim_daily_reward()
RETURNS TABLE(
  success            BOOLEAN,
  coins_earned       INTEGER,
  streak_day         INTEGER,
  days_to_next_bonus INTEGER,
  error_code         TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_today     DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  v_last      RECORD;
  v_streak    INT;
  v_base      INT;
  v_bonus     INT;
  v_total     INT;
  v_next_days INT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 'NOT_AUTHENTICATED'::TEXT; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM daily_claims WHERE user_id = v_caller AND claimed_date = v_today) THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 'ALREADY_CLAIMED'::TEXT; RETURN;
  END IF;
  SELECT * INTO v_last FROM daily_claims
  WHERE user_id = v_caller ORDER BY claimed_date DESC LIMIT 1;
  v_streak := CASE WHEN v_last.claimed_date = v_yesterday THEN v_last.streak_day + 1 ELSE 1 END;
  v_base    := get_platform_setting('daily_reward_base_coins');
  v_bonus   := get_platform_setting('daily_reward_streak_bonus');
  v_total   := v_base + (((v_streak - 1) / 7) * v_bonus);
  v_next_days := 7 - ((v_streak - 1) % 7);
  BEGIN
    INSERT INTO daily_claims (user_id, claimed_date, streak_day, coins_earned)
    VALUES (v_caller, v_today, v_streak, v_total);
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 'ALREADY_CLAIMED'::TEXT; RETURN;
  END;
  PERFORM grant_coins(
    v_caller, v_total, 'daily_reward', NULL::UUID, NULL::TEXT,
    'Daglig belöning — dag ' || v_streak,
    'daily_reward_' || v_caller::TEXT || '_' || v_today::TEXT,
    jsonb_build_object('streak_day', v_streak)
  );
  RETURN QUERY SELECT TRUE, v_total, v_streak, v_next_days, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION claim_daily_reward() TO authenticated;

-- 10. RPC: get_or_create_referral_code
CREATE OR REPLACE FUNCTION get_or_create_referral_code()
RETURNS TABLE(success BOOLEAN, code TEXT, uses_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_row    RECORD;
  v_code   TEXT;
  v_chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, NULL::TEXT, 0; RETURN; END IF;
  SELECT * INTO v_row FROM referral_codes WHERE user_id = v_caller;
  IF FOUND THEN RETURN QUERY SELECT TRUE, v_row.code, v_row.uses_count; RETURN; END IF;
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = v_code);
  END LOOP;
  INSERT INTO referral_codes (user_id, code) VALUES (v_caller, v_code);
  RETURN QUERY SELECT TRUE, v_code, 0;
END;
$$;
GRANT EXECUTE ON FUNCTION get_or_create_referral_code() TO authenticated;

-- 11. RPC: apply_referral_code
CREATE OR REPLACE FUNCTION apply_referral_code(p_code TEXT)
RETURNS TABLE(
  success       BOOLEAN,
  referrer_name TEXT,
  bonus_coins   INTEGER,
  error_code    TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_ref     RECORD;
  v_profile RECORD;
  v_reward  INT;
  v_bonus   INT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0, 'NOT_AUTHENTICATED'::TEXT; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM referral_uses WHERE referred_id = v_caller) THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0, 'ALREADY_USED'::TEXT; RETURN;
  END IF;
  SELECT * INTO v_ref FROM referral_codes WHERE code = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0, 'CODE_NOT_FOUND'::TEXT; RETURN;
  END IF;
  IF v_ref.user_id = v_caller THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0, 'CANNOT_USE_OWN_CODE'::TEXT; RETURN;
  END IF;
  SELECT * INTO v_profile FROM profiles WHERE id = v_ref.user_id;
  v_reward := get_platform_setting('referral_reward_coins');
  v_bonus  := get_platform_setting('referral_bonus_coins');
  INSERT INTO referral_uses (referrer_id, referred_id) VALUES (v_ref.user_id, v_caller);
  UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = v_ref.id;
  PERFORM grant_coins(v_ref.user_id, v_reward, 'referral_bonus', v_caller, 'profiles',
    'En vän gick med via din kod!',
    'referral_reward_' || v_ref.user_id::TEXT || '_' || v_caller::TEXT, '{}'::JSONB);
  PERFORM grant_coins(v_caller, v_bonus, 'referral_bonus', v_ref.user_id, 'profiles',
    'Välkomstbonus via vänkod!',
    'referral_bonus_' || v_caller::TEXT, '{}'::JSONB);
  RETURN QUERY SELECT TRUE,
    COALESCE(v_profile.first_name, v_profile.name, 'din vän')::TEXT,
    v_bonus, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION apply_referral_code(TEXT) TO authenticated;
