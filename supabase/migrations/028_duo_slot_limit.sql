-- ── Duo slot limit: max 1 duo-kompanjon by default, expandable for 100 ✦ ────

-- 1. Add duo_slots column (each user gets 1 slot by default)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS duo_slots INTEGER NOT NULL DEFAULT 1;

-- 2. Add new transaction type
ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS valid_tx_type;
ALTER TABLE coin_transactions ADD CONSTRAINT valid_tx_type CHECK (type IN (
  'purchase','reward','unlock_match','refund','admin_adjustment','bonus',
  'promotion','withdrawal','super_like','super_like_reward',
  'boost','duo_unlock_match','duo_reward','duo_slot_purchase'
));

-- 3. RPC: buy_duo_slot — deducts 100 coins, adds 1 duo slot
CREATE OR REPLACE FUNCTION buy_duo_slot()
RETURNS TABLE(success BOOLEAN, new_slots INTEGER, coin_balance INTEGER, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_balance INTEGER;
  v_slots   INTEGER;
  v_cost    CONSTANT INTEGER := 100;
BEGIN
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'NOT_AUTHENTICATED'::TEXT; RETURN;
  END IF;

  SELECT coin_balance, duo_slots INTO v_balance, v_slots
  FROM profiles WHERE id = v_caller FOR UPDATE;

  IF v_balance < v_cost THEN
    RETURN QUERY SELECT FALSE, v_slots, v_balance, 'INSUFFICIENT_BALANCE'::TEXT; RETURN;
  END IF;

  PERFORM grant_coins(
    v_caller, -v_cost, 'duo_slot_purchase', NULL::UUID, NULL::TEXT,
    'Utökade antal duo-kompanjoner',
    'buy_duo_slot_' || v_caller::TEXT || '_' || floor(extract(epoch from now()) * 1000)::TEXT,
    '{}'::JSONB
  );

  UPDATE profiles SET duo_slots = duo_slots + 1 WHERE id = v_caller;
  SELECT coin_balance, duo_slots INTO v_balance, v_slots FROM profiles WHERE id = v_caller;

  RETURN QUERY SELECT TRUE, v_slots, v_balance, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION buy_duo_slot() TO authenticated;

-- 4. Update create_duo_invite — checks duo_slots instead of hardcoded 10
CREATE OR REPLACE FUNCTION create_duo_invite()
RETURNS TABLE(success BOOLEAN, duo_id UUID, invite_code TEXT, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_code TEXT;
  v_duo_id UUID;
  v_count INT;
  v_slots INT;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  PERFORM id FROM profiles WHERE id = v_caller FOR UPDATE;

  SELECT COUNT(*) INTO v_count FROM duos
  WHERE (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active');

  SELECT duo_slots INTO v_slots FROM profiles WHERE id = v_caller;

  IF v_count >= v_slots THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'TOO_MANY_DUOS'::TEXT; RETURN;
  END IF;

  v_code := generate_duo_code();
  INSERT INTO duos (invite_code, member1, status) VALUES (v_code, v_caller, 'pending') RETURNING id INTO v_duo_id;

  UPDATE profiles SET active_duo_id = v_duo_id WHERE id = v_caller AND active_duo_id IS NULL;

  RETURN QUERY SELECT TRUE, v_duo_id, v_code, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION create_duo_invite() TO authenticated;

-- 5. Update join_duo — checks duo_slots instead of hardcoded 10
CREATE OR REPLACE FUNCTION join_duo(p_code TEXT)
RETURNS TABLE(success BOOLEAN, duo_id UUID, partner_id UUID, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_duo RECORD;
  v_count INT;
  v_slots INT;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  PERFORM id FROM profiles WHERE id = v_caller FOR UPDATE;

  SELECT COUNT(*) INTO v_count FROM duos
  WHERE (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active');

  SELECT duo_slots INTO v_slots FROM profiles WHERE id = v_caller;

  IF v_count >= v_slots THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'TOO_MANY_DUOS'::TEXT; RETURN;
  END IF;

  SELECT * INTO v_duo FROM duos WHERE invite_code = UPPER(TRIM(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'CODE_NOT_FOUND'::TEXT; RETURN; END IF;
  IF v_duo.member1 = v_caller THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'CANNOT_JOIN_OWN_INVITE'::TEXT; RETURN; END IF;
  IF v_duo.status <> 'pending' OR v_duo.member2 IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'CODE_ALREADY_USED'::TEXT; RETURN;
  END IF;

  UPDATE duos SET member2 = v_caller, status = 'active', joined_at = NOW() WHERE id = v_duo.id;

  UPDATE profiles SET active_duo_id = v_duo.id WHERE id = v_caller AND active_duo_id IS NULL;

  RETURN QUERY SELECT TRUE, v_duo.id, v_duo.member1, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION join_duo(TEXT) TO authenticated;
