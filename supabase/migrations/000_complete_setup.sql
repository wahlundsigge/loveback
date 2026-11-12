-- ============================================================
-- LoveBack — Complete Setup SQL
-- Paste this ENTIRE file into Supabase SQL Editor and run it.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================


-- ─────────────────────────────────────────────
-- 1. PROFILES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  first_name       TEXT NOT NULL DEFAULT '',
  last_name        TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  birth_date       DATE NOT NULL DEFAULT '2000-01-01',
  name             TEXT,
  age              INTEGER,
  bio              TEXT,
  avatar           TEXT,
  gender           TEXT,
  looking_for      TEXT DEFAULT 'everyone',
  dating_goal      TEXT,
  distance         INTEGER DEFAULT 10,
  min_age          INTEGER DEFAULT 18,
  max_age          INTEGER DEFAULT 45,
  images           TEXT[],
  profile_completed BOOLEAN DEFAULT FALSE,
  coin_balance     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- If table already existed, ensure all required columns are present
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name       TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name        TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone            TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date       DATE NOT NULL DEFAULT '2000-01-01';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age              INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio              TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for      TEXT DEFAULT 'everyone';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dating_goal      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS distance         INTEGER DEFAULT 10;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS min_age          INTEGER DEFAULT 18;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_age          INTEGER DEFAULT 45;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS images           TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coin_balance     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);


-- ─────────────────────────────────────────────
-- 2. AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────────
-- 3. LIKES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_user, to_user)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view likes involving themselves" ON likes;
CREATE POLICY "Users can view likes involving themselves"
  ON likes FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS "Users can create likes" ON likes;
CREATE POLICY "Users can create likes"
  ON likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user);


-- ─────────────────────────────────────────────
-- 4. MATCHES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chat_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  match_locked  BOOLEAN NOT NULL DEFAULT TRUE,
  paid_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user1, user2)
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view matches involving themselves" ON matches;
CREATE POLICY "Users can view matches involving themselves"
  ON matches FOR SELECT TO authenticated
  USING (auth.uid() = user1 OR auth.uid() = user2);

DROP POLICY IF EXISTS "Users can create matches" ON matches;
CREATE POLICY "Users can create matches"
  ON matches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);


-- ─────────────────────────────────────────────
-- 5. MESSAGES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their matches" ON messages;
CREATE POLICY "Users can view messages in their matches"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid())
        AND matches.chat_unlocked = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can send messages in their unlocked matches" ON messages;
CREATE POLICY "Users can send messages in their unlocked matches"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender AND
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid())
        AND matches.chat_unlocked = TRUE
    )
  );


-- ─────────────────────────────────────────────
-- 6. COIN PACKAGES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_packages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coins           INTEGER NOT NULL,
  price_sek       DECIMAL(10,2) NOT NULL,
  label           TEXT NOT NULL,
  bonus_coins     INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO coin_packages (coins, price_sek, label, sort_order) VALUES
  (100,  9.00,   '100 Coins',   1),
  (500,  39.00,  '500 Coins',   2),
  (1000, 69.00,  '1 000 Coins', 3),
  (2500, 149.00, '2 500 Coins', 4),
  (5000, 249.00, '5 000 Coins', 5)
ON CONFLICT DO NOTHING;

ALTER TABLE coin_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active packages" ON coin_packages;
CREATE POLICY "Anyone can view active packages"
  ON coin_packages FOR SELECT USING (is_active = TRUE);


-- ─────────────────────────────────────────────
-- 7. PLATFORM SETTINGS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('unlock_cost_coins',   '800', 'Coins to unlock a match chat'),
  ('reward_amount_coins', '200', 'Coins granted to partner on unlock'),
  ('new_user_bonus',      '0',   'Coins on first profile completion')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read settings" ON platform_settings;
CREATE POLICY "Authenticated users can read settings"
  ON platform_settings FOR SELECT TO authenticated USING (TRUE);


-- ─────────────────────────────────────────────
-- 8. COIN TRANSACTIONS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_transactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  type            TEXT NOT NULL,
  CONSTRAINT valid_tx_type CHECK (type IN (
    'purchase','reward','unlock_match','refund',
    'admin_adjustment','bonus','promotion','withdrawal'
  )),
  ref_id          UUID,
  ref_type        TEXT,
  description     TEXT,
  idempotency_key TEXT UNIQUE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id, created_at DESC);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON coin_transactions;
CREATE POLICY "Users can view own transactions"
  ON coin_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- 9. SECURITY: lock coin_balance from direct client writes
-- ─────────────────────────────────────────────
REVOKE UPDATE (coin_balance) ON profiles FROM authenticated;
REVOKE UPDATE (coin_balance) ON profiles FROM anon;
REVOKE UPDATE (chat_unlocked, paid_by, match_locked) ON matches FROM authenticated;
REVOKE UPDATE (chat_unlocked, paid_by, match_locked) ON matches FROM anon;


-- ─────────────────────────────────────────────
-- 10. RPC FUNCTIONS
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_platform_setting(p_key TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_value TEXT;
BEGIN
  SELECT value INTO v_value FROM platform_settings WHERE key = p_key;
  IF v_value IS NULL THEN RAISE EXCEPTION 'Platform setting not found: %', p_key; END IF;
  RETURN v_value::INTEGER;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'Platform setting % is not a valid integer', p_key;
END;
$$;
REVOKE EXECUTE ON FUNCTION get_platform_setting(TEXT) FROM PUBLIC, authenticated, anon;


CREATE OR REPLACE FUNCTION grant_coins(
  p_user_id UUID, p_amount INTEGER, p_type TEXT,
  p_ref_id UUID DEFAULT NULL, p_ref_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (new_balance INTEGER, transaction_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_balance INTEGER; v_tx_id UUID;
  v_existing_tx UUID; v_existing_bal INTEGER;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, balance_after INTO v_existing_tx, v_existing_bal
    FROM coin_transactions WHERE idempotency_key = p_idempotency_key;
    IF v_existing_tx IS NOT NULL THEN
      RETURN QUERY SELECT v_existing_bal, v_existing_tx; RETURN;
    END IF;
  END IF;
  SELECT coin_balance INTO v_new_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found: %', p_user_id; END IF;
  v_new_balance := v_new_balance + p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: current %, attempted deduction %',
      (v_new_balance - p_amount), (-p_amount);
  END IF;
  UPDATE profiles SET coin_balance = v_new_balance WHERE id = p_user_id;
  INSERT INTO coin_transactions (user_id, amount, balance_after, type, ref_id, ref_type, description, idempotency_key, metadata)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_ref_id, p_ref_type, p_description, p_idempotency_key, p_metadata)
  RETURNING id INTO v_tx_id;
  RETURN QUERY SELECT v_new_balance, v_tx_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION grant_coins(UUID, INTEGER, TEXT, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, authenticated, anon;


CREATE OR REPLACE FUNCTION unlock_match_atomic(p_match_id UUID, p_payer_id UUID)
RETURNS TABLE (success BOOLEAN, payer_balance INTEGER, partner_balance INTEGER, error_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_match RECORD; v_partner_id UUID;
  v_unlock_cost INTEGER; v_reward_amount INTEGER;
  v_payer_balance INTEGER; v_partner_balance INTEGER;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0, 0, 'MATCH_NOT_FOUND'::TEXT; RETURN; END IF;
  IF v_match.user1 != p_payer_id AND v_match.user2 != p_payer_id THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'NOT_MATCH_PARTICIPANT'::TEXT; RETURN;
  END IF;
  v_partner_id := CASE WHEN v_match.user1 = p_payer_id THEN v_match.user2 ELSE v_match.user1 END;
  IF v_match.chat_unlocked = TRUE THEN
    SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = p_payer_id;
    SELECT coin_balance INTO v_partner_balance FROM profiles WHERE id = v_partner_id;
    RETURN QUERY SELECT TRUE, v_payer_balance, v_partner_balance, 'ALREADY_UNLOCKED'::TEXT; RETURN;
  END IF;
  v_unlock_cost   := get_platform_setting('unlock_cost_coins');
  v_reward_amount := get_platform_setting('reward_amount_coins');
  SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = p_payer_id;
  IF v_payer_balance < v_unlock_cost THEN
    RETURN QUERY SELECT FALSE, v_payer_balance, 0, 'INSUFFICIENT_BALANCE'::TEXT; RETURN;
  END IF;
  PERFORM grant_coins(p_payer_id, -v_unlock_cost, 'unlock_match', p_match_id, 'match', 'Unlocked match chat', 'unlock_deduct_' || p_match_id::TEXT || '_' || p_payer_id::TEXT, '{}'::JSONB);
  SELECT coin_balance INTO v_payer_balance FROM profiles WHERE id = p_payer_id;
  PERFORM grant_coins(v_partner_id, v_reward_amount, 'reward', p_match_id, 'match', 'Din match öppnade chatten — du fick coins som tack.', 'unlock_reward_' || p_match_id::TEXT, '{}'::JSONB);
  SELECT coin_balance INTO v_partner_balance FROM profiles WHERE id = v_partner_id;
  UPDATE matches SET chat_unlocked = TRUE, match_locked = FALSE, paid_by = p_payer_id WHERE id = p_match_id;
  RETURN QUERY SELECT TRUE, v_payer_balance, v_partner_balance, NULL::TEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION unlock_match_atomic(UUID, UUID) FROM PUBLIC, authenticated, anon;


-- ─────────────────────────────────────────────
-- 11. SEED DATA — 6 fake test users
-- ─────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ('a1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','emma.fake@loveback.app', crypt('<SET-LOCALLY>',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"name":"Emma"}',FALSE,'','','',''),
  ('a1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sara.fake@loveback.app', crypt('<SET-LOCALLY>',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"name":"Sara"}',FALSE,'','','',''),
  ('a1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','julia.fake@loveback.app',crypt('<SET-LOCALLY>',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"name":"Julia"}',FALSE,'','','',''),
  ('a1000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','maja.fake@loveback.app', crypt('<SET-LOCALLY>',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"name":"Maja"}',FALSE,'','','',''),
  ('a1000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lina.fake@loveback.app', crypt('<SET-LOCALLY>',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"name":"Lina"}',FALSE,'','','',''),
  ('a1000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ida.fake@loveback.app',  crypt('<SET-LOCALLY>',gen_salt('bf')),NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}','{"name":"Ida"}',FALSE,'','','','')
ON CONFLICT (id) DO NOTHING;

-- Fake user profiles (trigger may have created rows; fill in the details)
INSERT INTO profiles (id, email, first_name, last_name, phone, birth_date, name, age, bio, avatar, gender, looking_for, dating_goal, distance, profile_completed) VALUES
  ('a1000000-0000-0000-0000-000000000001','emma.fake@loveback.app', 'Emma', '','','2002-06-15','Emma', 24,'Yogalärare och kaffe-älskare ☕ Drömmer om att resa hela världen.','https://randomuser.me/api/portraits/women/1.jpg','kvinna','man','Seriöst förhållande',3, TRUE),
  ('a1000000-0000-0000-0000-000000000002','sara.fake@loveback.app', 'Sara', '','','1999-03-22','Sara', 27,'Journalist och äventyrare ✈️ Söker någon som kan hänga med.','https://randomuser.me/api/portraits/women/2.jpg','kvinna','man','Casual',7, TRUE),
  ('a1000000-0000-0000-0000-000000000003','julia.fake@loveback.app','Julia','','','2001-09-08','Julia',25,'Katt-mamma × 2. Jobbar på café och älskar konst 🎨','https://randomuser.me/api/portraits/women/3.jpg','kvinna','man','Vänner',5, TRUE),
  ('a1000000-0000-0000-0000-000000000004','maja.fake@loveback.app', 'Maja', '','','2003-01-30','Maja', 23,'Student i Göteborg. Spotify-drottning och sushi-fan 🎧','https://randomuser.me/api/portraits/women/4.jpg','kvinna','man','Seriöst förhållande',12,TRUE),
  ('a1000000-0000-0000-0000-000000000005','lina.fake@loveback.app', 'Lina', '','','1997-11-05','Lina', 29,'Läkare. Söker work-life balance och kärlek ❤️ Gillar löpning.','https://randomuser.me/api/portraits/women/5.jpg','kvinna','alla','Casual',8, TRUE),
  ('a1000000-0000-0000-0000-000000000006','ida.fake@loveback.app',  'Ida',  '','','2000-07-19','Ida',  26,'Gillar vandring, sushi och dåliga skräckfilmer 🎬','https://randomuser.me/api/portraits/women/6.jpg','kvinna','man','Seriöst förhållande',15,TRUE)
ON CONFLICT (id) DO UPDATE SET
  first_name      = EXCLUDED.first_name,
  name            = EXCLUDED.name,
  age             = EXCLUDED.age,
  bio             = EXCLUDED.bio,
  avatar          = EXCLUDED.avatar,
  gender          = EXCLUDED.gender,
  looking_for     = EXCLUDED.looking_for,
  dating_goal     = EXCLUDED.dating_goal,
  distance        = EXCLUDED.distance,
  profile_completed = TRUE;


-- ─────────────────────────────────────────────
-- 12. MAIN TEST USER — wahlundsigge@gmail.com / <SET-LOCALLY>
--     (only created if they haven't signed up yet;
--      if they signed up manually the INSERT is skipped but the UPDATE runs)
-- ─────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'wahlundsigge@gmail.com',
  crypt('<SET-LOCALLY>', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Sigge"}',
  FALSE, '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'wahlundsigge@gmail.com'
);

-- Update main user's profile with full data + 5000 coins
-- (runs as postgres/superadmin, bypasses the REVOKE on coin_balance)
UPDATE profiles SET
  first_name        = 'Sigge',
  name              = 'Sigge',
  age               = 28,
  birth_date        = '1998-01-01',
  bio               = 'Gillar fotboll, resor och att laga mat. Söker någon att dela livet med ❤️',
  avatar            = 'https://randomuser.me/api/portraits/men/32.jpg',
  gender            = 'man',
  looking_for       = 'kvinna',
  dating_goal       = 'Seriöst förhållande',
  profile_completed = TRUE,
  coin_balance      = 5000,
  min_age           = 18,
  max_age           = 45
WHERE id = (SELECT id FROM auth.users WHERE email = 'wahlundsigge@gmail.com');

-- Record the coin grant in the ledger
INSERT INTO coin_transactions (user_id, amount, balance_after, type, description)
SELECT au.id, 5000, 5000, 'bonus', 'Välkomstbonus – testning'
FROM auth.users au
WHERE au.email = 'wahlundsigge@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM coin_transactions ct
    WHERE ct.user_id = au.id AND ct.type = 'bonus' AND ct.description = 'Välkomstbonus – testning'
  );


-- ─────────────────────────────────────────────
-- 13. PRE-CREATED LIKES — fake users → main user
--     Sigge gets instant matches when swiping right
-- ─────────────────────────────────────────────
DO $$
DECLARE
  main_id UUID;
  fake_ids UUID[] := ARRAY[
    'a1000000-0000-0000-0000-000000000001'::UUID,
    'a1000000-0000-0000-0000-000000000002'::UUID,
    'a1000000-0000-0000-0000-000000000003'::UUID,
    'a1000000-0000-0000-0000-000000000004'::UUID,
    'a1000000-0000-0000-0000-000000000005'::UUID,
    'a1000000-0000-0000-0000-000000000006'::UUID
  ];
  fid UUID;
BEGIN
  SELECT id INTO main_id FROM auth.users WHERE email = 'wahlundsigge@gmail.com';
  IF main_id IS NULL THEN RETURN; END IF;
  FOREACH fid IN ARRAY fake_ids LOOP
    INSERT INTO likes (from_user, to_user) VALUES (fid, main_id)
    ON CONFLICT (from_user, to_user) DO NOTHING;
  END LOOP;
END $$;
