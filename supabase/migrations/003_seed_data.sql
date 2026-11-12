-- ============================================================
-- LoveBack Migration 003 — Schema Fixes + Seed Data
-- Run this in Supabase SQL Editor after 001 and 002
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Fix likes column names (app uses from_user / to_user)
-- ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='likes' AND column_name='from_user_id'
  ) THEN
    ALTER TABLE likes RENAME COLUMN from_user_id TO from_user;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='likes' AND column_name='to_user_id'
  ) THEN
    ALTER TABLE likes RENAME COLUMN to_user_id TO to_user;
  END IF;
END $$;

-- Update likes RLS to use new column names
DROP POLICY IF EXISTS "Users can view likes involving themselves" ON likes;
DROP POLICY IF EXISTS "Users can create likes" ON likes;

CREATE POLICY "Users can view likes involving themselves"
  ON likes FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "Users can create likes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = from_user);

-- ─────────────────────────────────────────────
-- 2. Fix messages column names (app uses sender / text / sender_name)
-- ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='messages' AND column_name='sender_id'
  ) THEN
    ALTER TABLE messages RENAME COLUMN sender_id TO sender;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='messages' AND column_name='content'
  ) THEN
    ALTER TABLE messages RENAME COLUMN content TO text;
  END IF;
END $$;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Update messages RLS to reference new column name
DROP POLICY IF EXISTS "Users can send messages in their unlocked matches" ON messages;

CREATE POLICY "Users can send messages in their unlocked matches"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid())
        AND matches.chat_unlocked = TRUE
    )
    AND auth.uid() = sender
  );

-- ─────────────────────────────────────────────
-- 3. Add missing profile columns
-- ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age        INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS distance   INTEGER DEFAULT 10;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS min_age    INTEGER DEFAULT 18;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_age    INTEGER DEFAULT 45;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS images     TEXT[];

-- ─────────────────────────────────────────────
-- 4. Main user: wahlundsigge@gmail.com / <SET-LOCALLY>
-- ─────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change,
  email_change_token_new, recovery_token
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

-- Create/update profile for main user
INSERT INTO profiles (id, email, first_name, last_name, phone, birth_date, name, age, bio, avatar, gender, distance, min_age, max_age, profile_completed, coin_balance)
SELECT
  au.id,
  'wahlundsigge@gmail.com',
  'Sigge', '', '',
  '1998-01-01',
  'Sigge', 28,
  'Gillar fotboll, resor och att laga mat. Söker någon att dela livet med ❤️',
  'https://randomuser.me/api/portraits/men/32.jpg',
  'man', 10, 18, 45, TRUE, 5000
FROM auth.users au
WHERE au.email = 'wahlundsigge@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  first_name        = EXCLUDED.first_name,
  name              = EXCLUDED.name,
  age               = EXCLUDED.age,
  bio               = EXCLUDED.bio,
  avatar            = EXCLUDED.avatar,
  profile_completed = TRUE,
  min_age           = EXCLUDED.min_age,
  max_age           = EXCLUDED.max_age;

-- Give main user 5000 coins (direct SQL runs as superadmin, bypasses REVOKE)
UPDATE profiles
SET coin_balance = 5000
WHERE id = (SELECT id FROM auth.users WHERE email = 'wahlundsigge@gmail.com')
  AND coin_balance < 5000;

-- Record coin grant in ledger
INSERT INTO coin_transactions (user_id, amount, balance_after, type, description)
SELECT au.id, 5000, 5000, 'bonus', 'Välkomstbonus – testning'
FROM auth.users au
WHERE au.email = 'wahlundsigge@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM coin_transactions ct
    WHERE ct.user_id = au.id AND ct.type = 'bonus' AND ct.description = 'Välkomstbonus – testning'
  );

-- ─────────────────────────────────────────────
-- 5. Fake test users (deterministic UUIDs)
-- ─────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'emma.fake@loveback.app', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"name":"Emma"}', FALSE, '', '', '', ''),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sara.fake@loveback.app', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"name":"Sara"}', FALSE, '', '', '', ''),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'julia.fake@loveback.app', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"name":"Julia"}', FALSE, '', '', '', ''),
  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'maja.fake@loveback.app', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"name":"Maja"}', FALSE, '', '', '', ''),
  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lina.fake@loveback.app', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"name":"Lina"}', FALSE, '', '', '', ''),
  ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ida.fake@loveback.app', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW(), NOW(),
   '{"provider":"email","providers":["email"]}', '{"name":"Ida"}', FALSE, '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Create profiles for fake users
INSERT INTO profiles (id, email, first_name, last_name, phone, birth_date, name, age, bio, avatar, gender, distance, profile_completed, coin_balance) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'emma.fake@loveback.app',  'Emma',  '', '', '2002-06-15', 'Emma',  24, 'Yogalärare och kaffe-älskare ☕ Drömmer om att resa hela världen.', 'https://randomuser.me/api/portraits/women/1.jpg',  'kvinna', 3,  TRUE, 0),
  ('a1000000-0000-0000-0000-000000000002', 'sara.fake@loveback.app',  'Sara',  '', '', '1999-03-22', 'Sara',  27, 'Journalist och äventyrare ✈️ Söker någon som kan hänga med.',      'https://randomuser.me/api/portraits/women/2.jpg',  'kvinna', 7,  TRUE, 0),
  ('a1000000-0000-0000-0000-000000000003', 'julia.fake@loveback.app', 'Julia', '', '', '2001-09-08', 'Julia', 25, 'Katt-mamma × 2. Jobbar på café och älskar konst 🎨',               'https://randomuser.me/api/portraits/women/3.jpg',  'kvinna', 5,  TRUE, 0),
  ('a1000000-0000-0000-0000-000000000004', 'maja.fake@loveback.app',  'Maja',  '', '', '2003-01-30', 'Maja',  23, 'Student i Göteborg. Spotify-drottning och sushi-fan 🎧',            'https://randomuser.me/api/portraits/women/4.jpg',  'kvinna', 12, TRUE, 0),
  ('a1000000-0000-0000-0000-000000000005', 'lina.fake@loveback.app',  'Lina',  '', '', '1997-11-05', 'Lina',  29, 'Läkare. Söker work-life balance och kärlek ❤️ Gillar löpning.',    'https://randomuser.me/api/portraits/women/5.jpg',  'kvinna', 8,  TRUE, 0),
  ('a1000000-0000-0000-0000-000000000006', 'ida.fake@loveback.app',   'Ida',   '', '', '2000-07-19', 'Ida',   26, 'Gillar vandring, sushi och dåliga skräckfilmer 🎬',                 'https://randomuser.me/api/portraits/women/6.jpg',  'kvinna', 15, TRUE, 0)
ON CONFLICT (id) DO UPDATE SET
  first_name       = EXCLUDED.first_name,
  name             = EXCLUDED.name,
  age              = EXCLUDED.age,
  bio              = EXCLUDED.bio,
  avatar           = EXCLUDED.avatar,
  gender           = EXCLUDED.gender,
  distance         = EXCLUDED.distance,
  profile_completed = TRUE;

-- ─────────────────────────────────────────────
-- 6. Pre-created likes: fake users → main user
--    When Sigge swipes right on any of them = instant match
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
    IF NOT EXISTS (SELECT 1 FROM likes WHERE from_user = fid AND to_user = main_id) THEN
      INSERT INTO likes (from_user, to_user) VALUES (fid, main_id);
    END IF;
  END LOOP;
END $$;
