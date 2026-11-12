-- ── Duos: swipe & match as a pair ──────────────────────────────────────────
-- Two people team up as a "Duo" via a shareable invite code and swipe
-- together against other Duos. A match needs only one member from each
-- side to like back (not all 4). Unlocking the shared group chat costs the
-- same unlock_cost_coins as a normal match; the OTHER duo's two members
-- split reward_amount_coins between them instead of one partner getting it.

-- 0. Bugfix: 'boost' was never added to valid_tx_type, so every Boost
--    purchase (013_boost.sql's activate_boost_atomic) has been failing.
--    Bundled here since we're already extending this exact constraint.
ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS valid_tx_type;
ALTER TABLE coin_transactions ADD CONSTRAINT valid_tx_type CHECK (type IN (
  'purchase','reward','unlock_match','refund','admin_adjustment','bonus',
  'promotion','withdrawal','super_like','super_like_reward',
  'boost','duo_unlock_match','duo_reward'
));

-- 1. duos — a pair of users, formed via invite code
CREATE TABLE IF NOT EXISTS duos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  member1     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member2     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','left')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at   TIMESTAMPTZ,
  left_at     TIMESTAMPTZ,
  left_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CHECK (member1 IS DISTINCT FROM member2)
);

ALTER TABLE duos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duos_select" ON duos;
CREATE POLICY "duos_select" ON duos FOR SELECT TO authenticated
  USING (status = 'active' OR member1 = auth.uid() OR member2 = auth.uid());

-- All mutation happens inside SECURITY DEFINER RPCs below, same lockdown
-- style as matches.chat_unlocked/paid_by/match_locked.
REVOKE INSERT, UPDATE, DELETE ON duos FROM authenticated, anon;

-- 2. duo_likes — a duo-vs-duo like (reciprocity checked at the pair level,
--    regardless of which of the 2 members actually swiped)
CREATE TABLE IF NOT EXISTS duo_likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_duo    UUID NOT NULL REFERENCES duos(id) ON DELETE CASCADE,
  to_duo      UUID NOT NULL REFERENCES duos(id) ON DELETE CASCADE,
  from_member UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_duo, to_duo),
  CHECK (from_duo <> to_duo)
);

ALTER TABLE duo_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duo_likes_select" ON duo_likes;
CREATE POLICY "duo_likes_select" ON duo_likes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM duos d WHERE d.id = duo_likes.from_duo AND (d.member1 = auth.uid() OR d.member2 = auth.uid()))
    OR EXISTS (SELECT 1 FROM duos d WHERE d.id = duo_likes.to_duo AND (d.member1 = auth.uid() OR d.member2 = auth.uid()))
  );

REVOKE INSERT, UPDATE, DELETE ON duo_likes FROM authenticated, anon;

-- 3. duo_matches — two duos matching (mirrors `matches`)
CREATE TABLE IF NOT EXISTS duo_matches (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  duo_a         UUID NOT NULL REFERENCES duos(id) ON DELETE CASCADE,
  duo_b         UUID NOT NULL REFERENCES duos(id) ON DELETE CASCADE,
  chat_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  match_locked  BOOLEAN NOT NULL DEFAULT TRUE,
  paid_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (duo_a, duo_b),
  CHECK (duo_a < duo_b)
);

ALTER TABLE duo_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duo_matches_select" ON duo_matches;
CREATE POLICY "duo_matches_select" ON duo_matches FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM duos d WHERE d.id = duo_matches.duo_a AND (d.member1 = auth.uid() OR d.member2 = auth.uid()))
    OR EXISTS (SELECT 1 FROM duos d WHERE d.id = duo_matches.duo_b AND (d.member1 = auth.uid() OR d.member2 = auth.uid()))
  );

REVOKE INSERT, UPDATE, DELETE ON duo_matches FROM authenticated, anon;

-- 4. duo_messages — shared group chat for a duo_match (mirrors `messages`,
--    sent directly by clients, no RPC needed)
CREATE TABLE IF NOT EXISTS duo_messages (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  duo_match_id UUID NOT NULL REFERENCES duo_matches(id) ON DELETE CASCADE,
  sender       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name  TEXT,
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE duo_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duo_messages_select" ON duo_messages;
CREATE POLICY "duo_messages_select" ON duo_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM duo_matches dm
      JOIN duos da ON da.id = dm.duo_a
      JOIN duos db ON db.id = dm.duo_b
      WHERE dm.id = duo_messages.duo_match_id
        AND dm.chat_unlocked = TRUE
        AND auth.uid() IN (da.member1, da.member2, db.member1, db.member2)
    )
  );

DROP POLICY IF EXISTS "duo_messages_insert" ON duo_messages;
CREATE POLICY "duo_messages_insert" ON duo_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender AND
    EXISTS (
      SELECT 1 FROM duo_matches dm
      JOIN duos da ON da.id = dm.duo_a
      JOIN duos db ON db.id = dm.duo_b
      WHERE dm.id = duo_messages.duo_match_id
        AND dm.chat_unlocked = TRUE
        AND auth.uid() IN (da.member1, da.member2, db.member1, db.member2)
    )
  );

-- 5. RPC: generate_duo_code — helper, not directly callable by clients
CREATE OR REPLACE FUNCTION generate_duo_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_code TEXT;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM duos WHERE invite_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;
REVOKE EXECUTE ON FUNCTION generate_duo_code() FROM PUBLIC, authenticated, anon;

-- 6. RPC: create_duo_invite
CREATE OR REPLACE FUNCTION create_duo_invite()
RETURNS TABLE(success BOOLEAN, duo_id UUID, invite_code TEXT, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_code TEXT;
  v_duo_id UUID;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  -- Serializes concurrent calls from the same user (2 tabs/devices)
  PERFORM id FROM profiles WHERE id = v_caller FOR UPDATE;

  IF EXISTS (SELECT 1 FROM duos WHERE (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active')) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'ALREADY_IN_DUO'::TEXT; RETURN;
  END IF;

  v_code := generate_duo_code();
  INSERT INTO duos (invite_code, member1, status) VALUES (v_code, v_caller, 'pending') RETURNING id INTO v_duo_id;

  RETURN QUERY SELECT TRUE, v_duo_id, v_code, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION create_duo_invite() TO authenticated;

-- 7. RPC: join_duo
CREATE OR REPLACE FUNCTION join_duo(p_code TEXT)
RETURNS TABLE(success BOOLEAN, duo_id UUID, partner_id UUID, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_duo RECORD;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  PERFORM id FROM profiles WHERE id = v_caller FOR UPDATE;

  IF EXISTS (SELECT 1 FROM duos WHERE (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active')) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'ALREADY_IN_DUO'::TEXT; RETURN;
  END IF;

  -- Locks the target invite row — a simultaneous second joiner blocks here
  -- until this transaction commits, then re-reads status/member2 and loses.
  SELECT * INTO v_duo FROM duos WHERE invite_code = UPPER(TRIM(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'CODE_NOT_FOUND'::TEXT; RETURN; END IF;
  IF v_duo.member1 = v_caller THEN RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'CANNOT_JOIN_OWN_INVITE'::TEXT; RETURN; END IF;
  IF v_duo.status <> 'pending' OR v_duo.member2 IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'CODE_ALREADY_USED'::TEXT; RETURN;
  END IF;

  UPDATE duos SET member2 = v_caller, status = 'active', joined_at = NOW() WHERE id = v_duo.id;
  RETURN QUERY SELECT TRUE, v_duo.id, v_duo.member1, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION join_duo(TEXT) TO authenticated;

-- 8. RPC: leave_duo — dissolves the duo for both members
CREATE OR REPLACE FUNCTION leave_duo()
RETURNS TABLE(success BOOLEAN, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_duo RECORD;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;
  SELECT * INTO v_duo FROM duos WHERE (member1 = v_caller OR member2 = v_caller) AND status IN ('pending','active') FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'NOT_IN_DUO'::TEXT; RETURN; END IF;
  UPDATE duos SET status = 'left', left_at = NOW(), left_by = v_caller WHERE id = v_duo.id;
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION leave_duo() TO authenticated;

-- 9. RPC: duo_swipe_like — like + reciprocal check + match creation, atomic
CREATE OR REPLACE FUNCTION duo_swipe_like(p_target_duo_id UUID)
RETURNS TABLE(success BOOLEAN, matched BOOLEAN, duo_match_id UUID, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_my_duo RECORD;
  v_duo_a UUID; v_duo_b UUID; v_match_id UUID;
BEGIN
  IF v_caller IS NULL THEN RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  SELECT * INTO v_my_duo FROM duos WHERE (member1 = v_caller OR member2 = v_caller) AND status = 'active';
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
GRANT EXECUTE ON FUNCTION duo_swipe_like(UUID) TO authenticated;

-- 10. RPC: unlock_duo_match_atomic — mirrors unlock_match_atomic, but splits
--     the reward between the OTHER duo's two members instead of one partner
CREATE OR REPLACE FUNCTION unlock_duo_match_atomic(p_duo_match_id UUID)
RETURNS TABLE(success BOOLEAN, payer_balance INTEGER, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payer UUID := auth.uid();
  v_match RECORD; v_duo_a RECORD; v_duo_b RECORD;
  v_payer_in_a BOOLEAN;
  v_other1 UUID; v_other2 UUID;
  v_unlock_cost INTEGER; v_reward INTEGER; v_half INTEGER;
  v_payer_balance INTEGER;
BEGIN
  IF v_payer IS NULL THEN RETURN QUERY SELECT FALSE, 0, 'NOT_AUTHENTICATED'::TEXT; RETURN; END IF;

  SELECT * INTO v_match FROM duo_matches WHERE id = p_duo_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0, 'MATCH_NOT_FOUND'::TEXT; RETURN; END IF;

  SELECT * INTO v_duo_a FROM duos WHERE id = v_match.duo_a;
  SELECT * INTO v_duo_b FROM duos WHERE id = v_match.duo_b;
  v_payer_in_a := (v_payer = v_duo_a.member1 OR v_payer = v_duo_a.member2);

  IF NOT v_payer_in_a AND v_payer <> v_duo_b.member1 AND v_payer <> v_duo_b.member2 THEN
    RETURN QUERY SELECT FALSE, 0, 'NOT_MATCH_PARTICIPANT'::TEXT; RETURN;
  END IF;

  IF v_payer_in_a THEN v_other1 := v_duo_b.member1; v_other2 := v_duo_b.member2;
  ELSE v_other1 := v_duo_a.member1; v_other2 := v_duo_a.member2; END IF;

  IF v_match.chat_unlocked THEN
    SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = v_payer;
    RETURN QUERY SELECT TRUE, v_payer_balance, 'ALREADY_UNLOCKED'::TEXT; RETURN;
  END IF;

  v_unlock_cost := get_platform_setting('unlock_cost_coins');
  v_reward      := get_platform_setting('reward_amount_coins');
  v_half        := v_reward / 2; -- integer division == floor for positive ints

  SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = v_payer;
  IF v_payer_balance < v_unlock_cost THEN
    RETURN QUERY SELECT FALSE, v_payer_balance, 'INSUFFICIENT_BALANCE'::TEXT; RETURN;
  END IF;

  PERFORM grant_coins(v_payer, -v_unlock_cost, 'duo_unlock_match', p_duo_match_id, 'duo_match',
    'Låste upp Duo-matchens chatt', 'duo_unlock_deduct_' || p_duo_match_id::TEXT || '_' || v_payer::TEXT, '{}'::JSONB);
  SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = v_payer;

  IF v_other1 IS NOT NULL THEN
    PERFORM grant_coins(v_other1, v_half, 'duo_reward', p_duo_match_id, 'duo_match',
      'Er Duo-match öppnade chatten — ni fick coins som tack.', 'duo_unlock_reward_' || p_duo_match_id::TEXT || '_' || v_other1::TEXT, '{}'::JSONB);
  END IF;
  IF v_other2 IS NOT NULL THEN
    PERFORM grant_coins(v_other2, v_half, 'duo_reward', p_duo_match_id, 'duo_match',
      'Er Duo-match öppnade chatten — ni fick coins som tack.', 'duo_unlock_reward_' || p_duo_match_id::TEXT || '_' || v_other2::TEXT, '{}'::JSONB);
  END IF;

  UPDATE duo_matches SET chat_unlocked = TRUE, match_locked = FALSE, paid_by = v_payer WHERE id = p_duo_match_id;
  RETURN QUERY SELECT TRUE, v_payer_balance, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION unlock_duo_match_atomic(UUID) TO authenticated;
