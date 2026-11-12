-- ── Admin Dashboard Migration ─────────────────────────────────────────────────

-- 1. Admin-flagga
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Sätt ägarkontot som admin
UPDATE profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'wahlundsigge@gmail.com');

-- 3. RLS: admin får läsa platform_settings och coin_packages
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_settings" ON platform_settings;
CREATE POLICY "admin_read_settings" ON platform_settings FOR SELECT TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_settings" ON platform_settings;
CREATE POLICY "admin_update_settings" ON platform_settings FOR UPDATE TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

ALTER TABLE coin_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone_read_packages" ON coin_packages;
CREATE POLICY "everyone_read_packages" ON coin_packages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_packages" ON coin_packages;
CREATE POLICY "admin_update_packages" ON coin_packages FOR UPDATE TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- 4. RPC: Plattformsstatistik
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN json_build_object(
    'total_users',       (SELECT COUNT(*)::int            FROM profiles WHERE profile_completed = true),
    'users_today',       (SELECT COUNT(*)::int            FROM profiles WHERE created_at > NOW() - INTERVAL '24 hours' AND profile_completed = true),
    'users_week',        (SELECT COUNT(*)::int            FROM profiles WHERE created_at > NOW() - INTERVAL '7 days'  AND profile_completed = true),
    'total_matches',     (SELECT COUNT(*)::int            FROM matches),
    'matches_today',     (SELECT COUNT(*)::int            FROM matches  WHERE created_at > NOW() - INTERVAL '24 hours'),
    'total_messages',    (SELECT COUNT(*)::int            FROM messages),
    'messages_today',    (SELECT COUNT(*)::int            FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'),
    'coins_circulation', (SELECT COALESCE(SUM(coin_balance),0)::int FROM profiles),
    'coins_purchased',   (SELECT COALESCE(SUM(amount),0)::int       FROM coin_transactions WHERE type = 'purchase'),
    'roses_sent',        (SELECT COUNT(*)::int            FROM coin_transactions WHERE type = 'super_like'),
    'boosts_used',       (SELECT COUNT(*)::int            FROM coin_transactions WHERE type = 'boost'),
    'active_boosts',     (SELECT COUNT(*)::int            FROM profiles WHERE boost_expires_at > NOW()),
    'signups_by_day', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT DATE(created_at) AS date, COUNT(*)::int AS count
        FROM profiles
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      ) d
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;

-- 5. RPC: Användarsökning
CREATE OR REPLACE FUNCTION admin_search_users(p_query TEXT DEFAULT '', p_limit INT DEFAULT 25)
RETURNS TABLE(
  id UUID, name TEXT, email TEXT, age INTEGER, gender TEXT,
  coin_balance INTEGER, is_admin BOOLEAN, profile_completed BOOLEAN,
  created_at TIMESTAMPTZ, boost_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT p.id, COALESCE(p.name, p.first_name, ''), u.email::TEXT, p.age, p.gender,
         p.coin_balance, p.is_admin, p.profile_completed, p.created_at, p.boost_expires_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p_query = ''
     OR COALESCE(p.name, p.first_name, '') ILIKE '%' || p_query || '%'
     OR u.email ILIKE '%' || p_query || '%'
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_search_users(TEXT, INT) TO authenticated;

-- 6. RPC: Ge/dra coins
CREATE OR REPLACE FUNCTION admin_grant_coins(p_user_id UUID, p_amount INTEGER, p_reason TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  PERFORM grant_coins(
    p_user_id, p_amount, 'admin_adjustment', p_user_id, 'profile', p_reason,
    'admin_' || auth.uid()::TEXT || '_' || p_user_id::TEXT || '_' || EXTRACT(EPOCH FROM NOW())::bigint::TEXT,
    '{}'::JSONB
  );
  RETURN json_build_object('success', true,
    'new_balance', (SELECT coin_balance FROM profiles WHERE id = p_user_id));
END;
$$;
GRANT EXECUTE ON FUNCTION admin_grant_coins(UUID, INTEGER, TEXT) TO authenticated;

-- 7. RPC: Uppdatera plattformsinställning
CREATE OR REPLACE FUNCTION admin_update_setting(p_key TEXT, p_value TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE platform_settings SET value = p_value, updated_at = NOW() WHERE key = p_key;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_setting(TEXT, TEXT) TO authenticated;
