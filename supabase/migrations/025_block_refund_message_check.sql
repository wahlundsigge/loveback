-- Replaces block_user (from 023/024) with an abuse-resistant version.
-- Refund is issued ONLY if the payer sent zero messages in the chat.
-- If the payer chatted (sent ≥1 message), they got value — no refund.
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match_id      UUID;
  v_paid_by       UUID;
  v_cost          INTEGER;
  v_payer_msgs    INTEGER := 0;
  v_refunded      BOOLEAN := FALSE;
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
    -- Count messages the payer actually sent in this chat
    SELECT COUNT(*) INTO v_payer_msgs
    FROM messages
    WHERE match_id = v_match_id
      AND sender   = v_paid_by;

    -- Only refund if payer sent zero messages (no value extracted from the chat)
    IF v_payer_msgs = 0 THEN
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
        'Chatten låstes upp men inga meddelanden skickades — dina coins återbetalas.',
        'block_refund_' || v_match_id::text
      );

      v_refunded := TRUE;
    END IF;
  END IF;

  RETURN json_build_object(
    'success',  true,
    'refunded', v_refunded,
    'match_id', v_match_id
  );
END;
$$;
