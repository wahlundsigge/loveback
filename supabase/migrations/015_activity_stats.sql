-- ── Activity Stats Migration ──────────────────────────────────────────────────
-- Adds get_admin_activity(): active users + chat unlocks over a selectable
-- time range (7d / 30d / 90d / 1y), with a bucketed series for charting.

CREATE OR REPLACE FUNCTION get_admin_activity(p_range TEXT DEFAULT '7d')
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since  TIMESTAMPTZ;
  v_bucket TEXT;
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  CASE p_range
    WHEN '7d'  THEN v_since := NOW() - INTERVAL '7 days';  v_bucket := 'day';
    WHEN '30d' THEN v_since := NOW() - INTERVAL '30 days'; v_bucket := 'day';
    WHEN '90d' THEN v_since := NOW() - INTERVAL '90 days'; v_bucket := 'week';
    WHEN '1y'  THEN v_since := NOW() - INTERVAL '1 year';  v_bucket := 'month';
    ELSE RAISE EXCEPTION 'Invalid range: %', p_range;
  END CASE;

  RETURN json_build_object(
    'active_users', (
      SELECT COUNT(*)::int FROM auth.users WHERE last_sign_in_at > v_since
    ),
    'total_unlocks', (
      SELECT COUNT(*)::int FROM coin_transactions
      WHERE type = 'unlock_match' AND created_at > v_since
    ),
    'series', (
      SELECT COALESCE(json_agg(row_to_json(combined) ORDER BY combined.bucket), '[]'::json)
      FROM (
        SELECT
          COALESCE(u.bucket, a.bucket)   AS bucket,
          COALESCE(u.unlocks, 0)         AS unlocks,
          COALESCE(a.active_users, 0)    AS active_users
        FROM (
          SELECT TO_CHAR(DATE_TRUNC(v_bucket, created_at), 'YYYY-MM-DD') AS bucket,
                 COUNT(*)::int AS unlocks
          FROM coin_transactions
          WHERE type = 'unlock_match' AND created_at > v_since
          GROUP BY 1
        ) u
        FULL OUTER JOIN (
          SELECT TO_CHAR(DATE_TRUNC(v_bucket, last_sign_in_at), 'YYYY-MM-DD') AS bucket,
                 COUNT(*)::int AS active_users
          FROM auth.users
          WHERE last_sign_in_at > v_since
          GROUP BY 1
        ) a ON u.bucket = a.bucket
      ) combined
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_admin_activity(TEXT) TO authenticated;
