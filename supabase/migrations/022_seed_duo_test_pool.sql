-- ── Seed a pool of fake Duos to scroll-test the duo swipe deck ─────────────
-- Same technique as 008_fake_profiles.sql: insert profiles rows without
-- matching auth.users rows (these are swipe TARGETS, never logins), via a
-- temporary session_replication_role flip that bypasses the profiles->auth
-- FK check. 30 fresh fake profiles (ids 00000003-.../00000004-..., the next
-- unused prefixes after 00000001-/00000002- from 008 and a1000000- from
-- 000/003) paired into 15 already-`active` duos.

SET session_replication_role = replica;

INSERT INTO profiles (
  id, email, first_name, last_name, name,
  age, birth_date, gender, looking_for, dating_goal,
  avatar, images, profile_completed, min_age, max_age, coin_balance, distance
)
SELECT
  ('00000003-0000-0000-0000-' || lpad(n::text, 12, '0'))::UUID,
  'seed.duo.' || lower(name) || '@loveback.test',
  name, '', name,
  20 + (n % 15),
  ((2006 - (n % 15))::text || '-01-01')::date,
  'kvinna', 'alla', 'relationship',
  'https://randomuser.me/api/portraits/women/' || (n + 10) || '.jpg',
  ARRAY[
    'https://randomuser.me/api/portraits/women/' || (n + 10) || '.jpg',
    'https://randomuser.me/api/portraits/women/' || (n + 40) || '.jpg'
  ],
  true, 18, 45, 0, 25
FROM unnest(ARRAY['Alice','Anna','Elin','Frida','Sofia','Ida','Wilma','Alva','Julia','Vera','Alma','Selma','Freja','Ines','Nora'])
  WITH ORDINALITY AS t(name, n)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (
  id, email, first_name, last_name, name,
  age, birth_date, gender, looking_for, dating_goal,
  avatar, images, profile_completed, min_age, max_age, coin_balance, distance
)
SELECT
  ('00000004-0000-0000-0000-' || lpad(n::text, 12, '0'))::UUID,
  'seed.duo.' || lower(name) || '@loveback.test',
  name, '', name,
  22 + (n % 15),
  ((2004 - (n % 15))::text || '-01-01')::date,
  'man', 'alla', 'relationship',
  'https://randomuser.me/api/portraits/men/' || (n + 10) || '.jpg',
  ARRAY[
    'https://randomuser.me/api/portraits/men/' || (n + 10) || '.jpg',
    'https://randomuser.me/api/portraits/men/' || (n + 40) || '.jpg'
  ],
  true, 18, 45, 0, 25
FROM unnest(ARRAY['Oscar','Hugo','Liam','Elias','Leo','Noah','William','Axel','Vincent','Charlie','Melvin','Adam','Isak','Otto','Oliver'])
  WITH ORDINALITY AS t(name, n)
ON CONFLICT (id) DO NOTHING;

SET session_replication_role = DEFAULT;

-- Pair woman[n] with man[n] into 15 already-active duos — no RPC bypass
-- needed here since both members now genuinely exist in `profiles`.
INSERT INTO duos (id, invite_code, member1, member2, status, joined_at)
SELECT
  gen_random_uuid(),
  'SEEDD' || lpad(n::text, 2, '0'),
  ('00000003-0000-0000-0000-' || lpad(n::text, 12, '0'))::UUID,
  ('00000004-0000-0000-0000-' || lpad(n::text, 12, '0'))::UUID,
  'active',
  NOW()
FROM generate_series(1, 15) AS n
ON CONFLICT (invite_code) DO NOTHING;

-- Verify
SELECT
  (SELECT count(*) FROM profiles WHERE email LIKE 'seed.duo.%@loveback.test') AS seeded_profiles,
  (SELECT count(*) FROM duos WHERE invite_code LIKE 'SEEDD%') AS seeded_duos;
