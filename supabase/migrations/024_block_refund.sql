-- Replaces the block_user RPC from 023 with refund logic.
-- If an unlocked match exists between the blocker and the blocked user,
-- the person who paid for the unlock (matches.paid_by) is automatically refunded.
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match_id UUID;
  v_paid_by  UUID;
  v_cost     INTEGER;
BEGIN
  IF auth.uid() = p_blocked_id THEN
    RETURN json_build_object('success', false, 'error_code', 'CANNOT_BLOCK_SELF');
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT DO NOTHING;

  -- Find any unlocked match between these two users
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
    SELECT value::integer INTO v_cost
    FROM platform_settings WHERE key = 'unlock_cost_coins' LIMIT 1;

    IF v_cost IS NULL THEN
      v_cost := 80;
    END IF;

    PERFORM grant_coins(
      v_paid_by,
      v_cost,
      'refund',
      v_match_id,
      'match',
      'Chatten låstes upp men motparten blockerades — dina coins återbetalas.',
      'block_refund_' || v_match_id::text
    );
  END IF;

  RETURN json_build_object(
    'success',  true,
    'refunded', v_match_id IS NOT NULL,
    'match_id', v_match_id
  );
END;
$$;
