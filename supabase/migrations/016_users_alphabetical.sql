-- ── Alphabetical user listing ──────────────────────────────────────────────
-- Admin user list should sort A-Z by display name (falling back to email
-- when no name is set) instead of newest-first, and return the full roster
-- instead of just the most recent 25.

CREATE OR REPLACE FUNCTION admin_search_users(p_query TEXT DEFAULT '', p_limit INT DEFAULT 500)
RETURNS TABLE(
  id UUID, name TEXT, email TEXT, age INTEGER, gender TEXT,
  coin_balance INTEGER, is_admin BOOLEAN, profile_completed BOOLEAN,
  created_at TIMESTAMPTZ, boost_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT p2.is_admin FROM profiles p2 WHERE p2.id = auth.uid()), false) THEN
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
  ORDER BY LOWER(COALESCE(NULLIF(p.name, ''), NULLIF(p.first_name, ''), u.email)) ASC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_search_users(TEXT, INT) TO authenticated;
