-- user_blocks: one row per blocker→blocked pair
CREATE TABLE IF NOT EXISTS user_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_blocks" ON user_blocks;
CREATE POLICY "own_blocks" ON user_blocks FOR ALL USING (auth.uid() = blocker_id);

-- user_reports: append-only, admins can read
CREATE TABLE IF NOT EXISTS user_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert_own_reports" ON user_reports;
DROP POLICY IF EXISTS "admin_read_reports" ON user_reports;
CREATE POLICY "insert_own_reports" ON user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "admin_read_reports"  ON user_reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- RPC: report_user
CREATE OR REPLACE FUNCTION report_user(p_reported_id UUID, p_reason TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() = p_reported_id THEN
    RETURN json_build_object('success', false, 'error_code', 'CANNOT_REPORT_SELF');
  END IF;
  INSERT INTO user_reports (reporter_id, reported_id, reason)
  VALUES (auth.uid(), p_reported_id, p_reason);
  RETURN json_build_object('success', true);
END;
$$;

-- RPC: block_user (abuse-resistant — refunds only if payer sent 0 messages)
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match_id   UUID;
  v_paid_by    UUID;
  v_cost       INTEGER;
  v_payer_msgs INTEGER := 0;
  v_refunded   BOOLEAN := FALSE;
BEGIN
  IF auth.uid() = p_blocked_id THEN
    RETURN json_build_object('success', false, 'error_code', 'CANNOT_BLOCK_SELF');
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT DO NOTHING;

  SELECT id, paid_by INTO v_match_id, v_paid_by
  FROM matches
  WHERE chat_unlocked = TRUE
    AND paid_by IS NOT NULL
    AND (
      (user1 = auth.uid() AND user2 = p_blocked_id)
      OR
      (user1 = p_blocked_id AND user2 = auth.uid())
    )
  LIMIT 1;

  IF v_match_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_payer_msgs
    FROM messages
    WHERE match_id = v_match_id AND sender = v_paid_by;

    IF v_payer_msgs = 0 THEN
      SELECT value::integer INTO v_cost
      FROM platform_settings WHERE key = 'unlock_cost_coins' LIMIT 1;
      IF v_cost IS NULL THEN v_cost := 80; END IF;

      PERFORM grant_coins(
        v_paid_by, v_cost, 'refund', v_match_id, 'match',
        'Chatten låstes upp men inga meddelanden skickades — dina coins återbetalas.',
        'block_refund_' || v_match_id::text
      );
      v_refunded := TRUE;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'refunded', v_refunded, 'match_id', v_match_id);
END;
$$;
