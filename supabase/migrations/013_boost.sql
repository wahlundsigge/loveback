ALTER TABLE profiles ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

INSERT INTO platform_settings (key, value, description) VALUES
  ('boost_cost_coins', '200', 'Coins för att boosta profilen i 30 min')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION activate_boost_atomic()
RETURNS TABLE(success BOOLEAN, expires_at TIMESTAMPTZ, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_cost INTEGER;
  v_bal  INTEGER;
  v_exp  TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 'NOT_AUTHENTICATED'::TEXT; RETURN;
  END IF;

  v_cost := get_platform_setting('boost_cost_coins');

  SELECT coin_balance INTO v_bal FROM profiles WHERE id = v_user FOR UPDATE;
  IF v_bal < v_cost THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 'INSUFFICIENT_BALANCE'::TEXT; RETURN;
  END IF;

  v_exp := NOW() + INTERVAL '30 minutes';
  UPDATE profiles SET boost_expires_at = v_exp WHERE id = v_user;

  PERFORM grant_coins(
    v_user, -v_cost, 'boost', v_user, 'profile',
    'Profil boostad i 30 min',
    'boost_' || v_user::TEXT || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT,
    '{}'::JSONB
  );

  RETURN QUERY SELECT TRUE, v_exp, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION activate_boost_atomic() TO authenticated;

-- Verify
SELECT key, value FROM platform_settings WHERE key = 'boost_cost_coins';
