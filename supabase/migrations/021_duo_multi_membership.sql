-- ── Duos: allow multiple simultaneous memberships ──────────────────────────
-- Previously a user could only be in one pending/active duo at a time
-- (enforced purely in RPC logic, not the schema). This relaxes that to a
-- generous soft cap and introduces an explicit "which duo am I swiping as
-- right now" pointer, since with several duos the app can no longer infer
-- a single one automatically.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_duo_id UUID REFERENCES duos(id) ON DELETE SET NULL;

-- 1. create_duo_invite — drop the single-duo guard, add a soft abuse cap,
--    auto-select the new duo as active if the caller has none set yet.
CREATE OR REPLACE FUNCTION create_duo_invite()
RETURNS TABLE(success BOOLEAN, duo_id UUID, invite_code TEXT, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_code TEXT;
  v_duo_id UUID;
  v_count INT;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  PERFORM id FROM profiles WHERE id = v_caller FOR UPDATE;

  SELECT COUNT(*) INTO v_count FROM duos WHERE (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active');
  IF v_count >= 10 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'TOO_MANY_DUOS'::TEXT; RETURN;
  END IF;

  v_code := generate_duo_code();
  INSERT INTO duos (invite_code, member1, status) VALUES (v_code, v_caller, 'pending') RETURNING id INTO v_duo_id;

  UPDATE profiles SET active_duo_id = v_duo_id WHERE id = v_caller AND active_duo_id IS NULL;

  RETURN QUERY SELECT TRUE, v_duo_id, v_code, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION create_duo_invite() TO authenticated;

-- 2. join_duo — same guard swap, same auto-select behavior.
CREATE OR REPLACE FUNCTION join_duo(p_code TEXT)
RETURNS TABLE(success BOOLEAN, duo_id UUID, partner_id UUID, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_duo RECORD;
  v_count INT;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  PERFORM id FROM profiles WHERE id = v_caller FOR UPDATE;

  SELECT COUNT(*) INTO v_count FROM duos WHERE (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active');
  IF v_count >= 10 THEN
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

-- 3. leave_duo — now targets a specific duo (a user can be in several).
--    Reassigns active_duo_id to another remaining active duo if the one
--    being left was it, else clears it to NULL.
DROP FUNCTION IF EXISTS leave_duo();

CREATE OR REPLACE FUNCTION leave_duo(p_duo_id UUID)
RETURNS TABLE(success BOOLEAN, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_duo RECORD;
  v_next_active UUID;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  SELECT * INTO v_duo FROM duos
  WHERE id = p_duo_id AND (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active')
  FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'NOT_IN_DUO'::TEXT; RETURN; END IF;

  UPDATE duos SET status = 'left', left_at = NOW(), left_by = v_caller WHERE id = p_duo_id;

  SELECT id INTO v_next_active FROM duos
  WHERE (member1 = v_caller OR member2 = v_caller) AND status = 'active' AND id <> p_duo_id
  ORDER BY created_at DESC LIMIT 1;

  UPDATE profiles SET active_duo_id = v_next_active WHERE id = v_caller AND active_duo_id = p_duo_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION leave_duo(UUID) TO authenticated;

-- 4. duo_swipe_like — now takes an explicit "which of my duos is swiping"
--    id instead of inferring a single active duo.
DROP FUNCTION IF EXISTS duo_swipe_like(UUID);

CREATE OR REPLACE FUNCTION duo_swipe_like(p_my_duo_id UUID, p_target_duo_id UUID)
RETURNS TABLE(success BOOLEAN, matched BOOLEAN, duo_match_id UUID, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_my_duo RECORD;
  v_duo_a UUID; v_duo_b UUID; v_match_id UUID;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  SELECT * INTO v_my_duo FROM duos
  WHERE id = p_my_duo_id AND (member1 = v_caller OR member2 = v_caller) AND status = 'active';
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 'NOT_IN_ACTIVE_DUO'::TEXT; RETURN; END IF;
  IF v_my_duo.id = p_target_duo_id THEN RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 'CANNOT_LIKE_OWN_DUO'::TEXT; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM duos WHERE id = p_target_duo_id AND status = 'active') THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 'TARGET_DUO_NOT_ACTIVE'::TEXT; RETURN;
  END IF;

  INSERT INTO duo_likes (from_duo, to_duo, from_member) VALUES (v_my_duo.id, p_target_duo_id, v_caller)
  ON CONFLICT (from_duo, to_duo) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM duo_likes WHERE from_duo = p_target_duo_id AND to_duo = v_my_duo.id) THEN
    RETURN QUERY SELECT TRUE, FALSE, NULL::UUID, NULL::TEXT; RETURN;
  END IF;

  v_duo_a := LEAST(v_my_duo.id, p_target_duo_id);
  v_duo_b := GREATEST(v_my_duo.id, p_target_duo_id);

  INSERT INTO duo_matches (duo_a, duo_b) VALUES (v_duo_a, v_duo_b)
  ON CONFLICT (duo_a, duo_b) DO NOTHING RETURNING id INTO v_match_id;
  IF v_match_id IS NULL THEN
    SELECT id INTO v_match_id FROM duo_matches WHERE duo_a = v_duo_a AND duo_b = v_duo_b;
  END IF;

  RETURN QUERY SELECT TRUE, TRUE, v_match_id, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION duo_swipe_like(UUID, UUID) TO authenticated;

-- 5. set_active_duo — new RPC: pick which of the caller's own duos they're
--    currently swiping as.
CREATE OR REPLACE FUNCTION set_active_duo(p_duo_id UUID)
RETURNS TABLE(success BOOLEAN, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM duos WHERE id = p_duo_id AND (member1 = v_caller OR member2 = v_caller) AND status = 'active'
  ) THEN
    RETURN QUERY SELECT FALSE, 'NOT_YOUR_ACTIVE_DUO'::TEXT; RETURN;
  END IF;

  UPDATE profiles SET active_duo_id = p_duo_id WHERE id = v_caller;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION set_active_duo(UUID) TO authenticated;
