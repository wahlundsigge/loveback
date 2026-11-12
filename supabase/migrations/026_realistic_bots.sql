-- ============================================================
-- LoveBack Migration 026 — Realistic Bot Accounts
-- Replaces all old fake/seed accounts with 15 genuine-feeling
-- Swedish personas. Run in Supabase SQL Editor.
-- Login: {name}.bot@loveback.test / <SET-LOCALLY>
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Clean up all old fake + seed accounts
-- ─────────────────────────────────────────────

-- Remove likes first (FK constraint)
DELETE FROM likes
WHERE from_user IN (
  SELECT id FROM profiles
  WHERE email LIKE '%.fake@loveback.app'
     OR email LIKE 'seed.%@loveback.test'
)
OR to_user IN (
  SELECT id FROM profiles
  WHERE email LIKE '%.fake@loveback.app'
     OR email LIKE 'seed.%@loveback.test'
);

-- Remove matches connected to old bots
DELETE FROM matches
WHERE user1 IN (SELECT id FROM profiles WHERE email LIKE '%.fake@loveback.app' OR email LIKE 'seed.%@loveback.test')
   OR user2 IN (SELECT id FROM profiles WHERE email LIKE '%.fake@loveback.app' OR email LIKE 'seed.%@loveback.test');

-- Remove messages connected to old bots
DELETE FROM messages
WHERE sender IN (SELECT id FROM profiles WHERE email LIKE '%.fake@loveback.app' OR email LIKE 'seed.%@loveback.test');

-- Remove profiles
DELETE FROM profiles
WHERE email LIKE '%.fake@loveback.app'
   OR email LIKE 'seed.%@loveback.test';

-- Remove auth users (only the 6 that had login)
DELETE FROM auth.users WHERE email LIKE '%.fake@loveback.app';

-- ─────────────────────────────────────────────
-- 2. Create auth.users for all 15 bots
-- ─────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES
  -- Women (01–09)
  ('b0000001-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'astrid.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '18 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Astrid"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'freya.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '25 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Freya"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'wilma.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '9 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Wilma"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'sigrid.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '33 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Sigrid"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'maja.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '14 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Maja"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'elsa.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '41 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Elsa"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'nora.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '6 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Nora"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'birgit.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '52 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Birgit"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'thea.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '11 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Thea"}',FALSE,'','','',''),

  -- Men (10–15)
  ('b0000001-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'erik.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '20 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Erik"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'axel.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '37 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Axel"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'linus.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '5 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Linus"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'oscar.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '28 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Oscar"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'victor.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '15 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Victor"}',FALSE,'','','',''),

  ('b0000001-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'tobias.bot@loveback.test', crypt('<SET-LOCALLY>', gen_salt('bf')), NOW(), NOW()-INTERVAL '44 days', NOW(),
   '{"provider":"email","providers":["email"]}','{"name":"Tobias"}',FALSE,'','','','')

ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. Create profiles for all 15 bots
--    Photo 1: randomuser.me portrait (face)
--    Photo 2–3: picsum lifestyle shots (personality)
-- ─────────────────────────────────────────────
INSERT INTO profiles (
  id, email, first_name, last_name, phone, birth_date,
  name, age, bio, avatar, images,
  gender, looking_for, dating_goal,
  distance, min_age, max_age,
  profile_completed, coin_balance
) VALUES

-- ASTRID, 26, Sjuksköterska
('b0000001-0000-0000-0000-000000000001','astrid.bot@loveback.test','Astrid','Lindqvist','','2000-03-14',
 'Astrid', 26,
 'Sjuksköterska på Karolinska. Laddar batterierna med yoga, bra vin och långa promenader i Djurgården. Söker någon som inte är rädd för djupa samtal.',
 'https://randomuser.me/api/portraits/women/44.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/44.jpg','https://picsum.photos/seed/astrid-yoga/600/750','https://picsum.photos/seed/astrid-park/600/750'],
 'kvinna','man','Seriöst förhållande', 20, 24, 36, TRUE, 200),

-- FREYA, 29, Arkitekt
('b0000001-0000-0000-0000-000000000002','freya.bot@loveback.test','Freya','Ström','','1997-07-22',
 'Freya', 29,
 'Arkitekt med ett svagt för brutalistisk arkitektur och bra sushi. Vandrar hellre ett berg än sitter på en bar — men kan göra båda om det är rätt person.',
 'https://randomuser.me/api/portraits/women/47.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/47.jpg','https://picsum.photos/seed/freya-mountain/600/750','https://picsum.photos/seed/freya-city/600/750'],
 'kvinna','man','Dejta och se vart det leder', 30, 26, 38, TRUE, 200),

-- WILMA, 24, Student
('b0000001-0000-0000-0000-000000000003','wilma.bot@loveback.test','Wilma','Bergström','','2002-11-05',
 'Wilma', 24,
 'Läser psykologi i Stockholm. Hund-mamma till Diesel 🐕. Hittar mig på festivaler, kafé eller löpspåret i Hagaparken.',
 'https://randomuser.me/api/portraits/women/52.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/52.jpg','https://picsum.photos/seed/wilma-festival/600/750','https://picsum.photos/seed/wilma-dog/600/750'],
 'kvinna','man','Vänner och kanske mer', 15, 22, 32, TRUE, 200),

-- SIGRID, 31, Journalist
('b0000001-0000-0000-0000-000000000004','sigrid.bot@loveback.test','Sigrid','Hansson','','1995-01-30',
 'Sigrid', 31,
 'Frilansjournalist — skriver om kultur och samhälle. Besatt av podcast, tursamma kafébord och resor till städer de flesta aldrig hört talas om.',
 'https://randomuser.me/api/portraits/women/56.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/56.jpg','https://picsum.photos/seed/sigrid-travel/600/750','https://picsum.photos/seed/sigrid-cafe/600/750'],
 'kvinna','man','Seriöst förhållande', 25, 27, 40, TRUE, 200),

-- MAJA, 27, Barista
('b0000001-0000-0000-0000-000000000005','maja.bot@loveback.test','Maja','Eriksson','','1999-06-18',
 'Maja', 27,
 'Barista och deltids-konstnär. Trivs bäst med händerna i lera eller en penseln i hand. Mina kaffe-recept är hemliga men annars är jag ett öppet bok.',
 'https://randomuser.me/api/portraits/women/61.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/61.jpg','https://picsum.photos/seed/maja-art/600/750','https://picsum.photos/seed/maja-coffee/600/750'],
 'kvinna','man','Dejta och se vart det leder', 10, 24, 34, TRUE, 200),

-- ELSA, 33, Läkare
('b0000001-0000-0000-0000-000000000006','elsa.bot@loveback.test','Elsa','Magnusson','','1993-09-02',
 'Elsa', 33,
 'Allmänläkare. Jobbar för mycket, kompenserar med sällskapsspel, bra vin och att se på för många dokumentärer. Söker work-life balance och kärlek — ungefär i den ordningen.',
 'https://randomuser.me/api/portraits/women/65.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/65.jpg','https://picsum.photos/seed/elsa-wine/600/750','https://picsum.photos/seed/elsa-boardgame/600/750'],
 'kvinna','man','Seriöst förhållande', 20, 29, 42, TRUE, 200),

-- NORA, 28, Designer
('b0000001-0000-0000-0000-000000000007','nora.bot@loveback.test','Nora','Lindberg','','1998-04-11',
 'Nora', 28,
 'UX-designer som ser världen i pixlar och prototyper. På fritiden: gymmet, Netflix och långa telefonsamtal med min mamma. Söker ingen perfekt — söker någon äkta.',
 'https://randomuser.me/api/portraits/women/72.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/72.jpg','https://picsum.photos/seed/nora-gym/600/750','https://picsum.photos/seed/nora-design/600/750'],
 'kvinna','man','Dejta och se vart det leder', 18, 25, 36, TRUE, 200),

-- BIRGIT, 35, Lärare
('b0000001-0000-0000-0000-000000000008','birgit.bot@loveback.test','Birgit','Olofsson','','1991-12-27',
 'Birgit', 35,
 'Lärare i svenska och historia. Cyklar till jobbet, lagar mat på söndagar och läser allt från Dostojevskij till Agatha Christie. Lat fredag = min religion.',
 'https://randomuser.me/api/portraits/women/78.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/78.jpg','https://picsum.photos/seed/birgit-bike/600/750','https://picsum.photos/seed/birgit-cook/600/750'],
 'kvinna','man','Seriöst förhållande', 22, 30, 44, TRUE, 200),

-- THEA, 25, Fotograf
('b0000001-0000-0000-0000-000000000009','thea.bot@loveback.test','Thea','Persson','','2001-08-19',
 'Thea', 25,
 'Fotograf — jobbar mest med porträtt och naturfoto. Alltid med kameran runt halsen. Musik är mitt andra språk. Söker en partner, inte ett projekt.',
 'https://randomuser.me/api/portraits/women/83.jpg',
 ARRAY['https://randomuser.me/api/portraits/women/83.jpg','https://picsum.photos/seed/thea-photo/600/750','https://picsum.photos/seed/thea-nature/600/750'],
 'kvinna','man','Dejta och se vart det leder', 12, 22, 32, TRUE, 200),

-- ERIK, 28, Kock
('b0000001-0000-0000-0000-000000000010','erik.bot@loveback.test','Erik','Svensson','','1998-02-08',
 'Erik', 28,
 'Kock på en restaurang i Södermalm. Maten är mitt hantverk — på fritiden tränar jag, lyssnar på alldeles för mycket techno och försöker bli bättre på padel.',
 'https://randomuser.me/api/portraits/men/33.jpg',
 ARRAY['https://randomuser.me/api/portraits/men/33.jpg','https://picsum.photos/seed/erik-kitchen/600/750','https://picsum.photos/seed/erik-gym/600/750'],
 'man','kvinna','Dejta och se vart det leder', 15, 22, 34, TRUE, 200),

-- AXEL, 31, Ingenjör
('b0000001-0000-0000-0000-000000000011','axel.bot@loveback.test','Axel','Karlsson','','1995-05-16',
 'Axel', 31,
 'Civilingenjör inom hållbar energi. Spelar golf dåligt men engagerat, lagar gammeldags husmanskost och drömmer om att segla runt Gotland.',
 'https://randomuser.me/api/portraits/men/40.jpg',
 ARRAY['https://randomuser.me/api/portraits/men/40.jpg','https://picsum.photos/seed/axel-golf/600/750','https://picsum.photos/seed/axel-sail/600/750'],
 'man','kvinna','Seriöst förhållande', 20, 26, 38, TRUE, 200),

-- LINUS, 26, Bartender
('b0000001-0000-0000-0000-000000000012','linus.bot@loveback.test','Linus','Nilsson','','2000-10-03',
 'Linus', 26,
 'Bartender och deltids-äventyrare. Jobbar nätter, lever på dagen. Älskar att resa hit och dit utan plan. Spelar volleyball på sommaren och för mycket FIFA på vintern.',
 'https://randomuser.me/api/portraits/men/45.jpg',
 ARRAY['https://randomuser.me/api/portraits/men/45.jpg','https://picsum.photos/seed/linus-travel/600/750','https://picsum.photos/seed/linus-volleyball/600/750'],
 'man','kvinna','Vänner och kanske mer', 10, 21, 32, TRUE, 200),

-- OSCAR, 30, Arkitekt
('b0000001-0000-0000-0000-000000000013','oscar.bot@loveback.test','Oscar','Johansson','','1996-07-25',
 'Oscar', 30,
 'Arkitekt med ett sidoprojekt i keramik som ingen riktigt förstår. Ser på film varje fredag, spelar padel varje lördag. Söker en som gillar ordning och kaos i lagom blandning.',
 'https://randomuser.me/api/portraits/men/50.jpg',
 ARRAY['https://randomuser.me/api/portraits/men/50.jpg','https://picsum.photos/seed/oscar-ceramics/600/750','https://picsum.photos/seed/oscar-padel/600/750'],
 'man','kvinna','Dejta och se vart det leder', 18, 25, 38, TRUE, 200),

-- VICTOR, 27, Lärare
('b0000001-0000-0000-0000-000000000014','victor.bot@loveback.test','Victor','Andersson','','1999-03-31',
 'Victor', 27,
 'Högstadielärare i NO. Gillar hiking, spelar gitarr halvdåligt och lyssnar på alldeles för mycket true crime. Söker en partner att utforska världen med — börjar gärna med en fika.',
 'https://randomuser.me/api/portraits/men/57.jpg',
 ARRAY['https://randomuser.me/api/portraits/men/57.jpg','https://picsum.photos/seed/victor-hiking/600/750','https://picsum.photos/seed/victor-guitar/600/750'],
 'man','kvinna','Seriöst förhållande', 15, 23, 34, TRUE, 200),

-- TOBIAS, 33, Läkare
('b0000001-0000-0000-0000-000000000015','tobias.bot@loveback.test','Tobias','Gustafsson','','1993-11-14',
 'Tobias', 33,
 'Ortoped. Friluftsmänniska som SUP:ar, fiskar och vandrar. Läser biografier och historieböcker. Söker någon som kan matcha min energi utomhus och min lugn inomhus.',
 'https://randomuser.me/api/portraits/men/62.jpg',
 ARRAY['https://randomuser.me/api/portraits/men/62.jpg','https://picsum.photos/seed/tobias-sup/600/750','https://picsum.photos/seed/tobias-fishing/600/750'],
 'man','kvinna','Seriöst förhållande', 25, 27, 42, TRUE, 200)

ON CONFLICT (id) DO UPDATE SET
  first_name        = EXCLUDED.first_name,
  name              = EXCLUDED.name,
  age               = EXCLUDED.age,
  bio               = EXCLUDED.bio,
  avatar            = EXCLUDED.avatar,
  images            = EXCLUDED.images,
  gender            = EXCLUDED.gender,
  looking_for       = EXCLUDED.looking_for,
  dating_goal       = EXCLUDED.dating_goal,
  profile_completed = TRUE;

-- ─────────────────────────────────────────────
-- 4. Like-graph — realistic, organic timing
-- ─────────────────────────────────────────────
DO $$
DECLARE
  main_id UUID;
BEGIN
  SELECT id INTO main_id FROM auth.users WHERE email = 'wahlundsigge@gmail.com';
  IF main_id IS NULL THEN RAISE NOTICE 'Main user not found — skipping likes'; RETURN; END IF;

  -- 12/15 bots already liked the main user (instant match when swiped)
  -- Skipping Birgit (08), Thea (09), Oscar (13) — realistic non-match rate
  INSERT INTO likes (from_user, to_user, created_at) VALUES
    ('b0000001-0000-0000-0000-000000000001', main_id, NOW()-INTERVAL '17 days'),
    ('b0000001-0000-0000-0000-000000000002', main_id, NOW()-INTERVAL '24 days'),
    ('b0000001-0000-0000-0000-000000000003', main_id, NOW()-INTERVAL '8 days'),
    ('b0000001-0000-0000-0000-000000000004', main_id, NOW()-INTERVAL '31 days'),
    ('b0000001-0000-0000-0000-000000000005', main_id, NOW()-INTERVAL '13 days'),
    ('b0000001-0000-0000-0000-000000000006', main_id, NOW()-INTERVAL '40 days'),
    ('b0000001-0000-0000-0000-000000000007', main_id, NOW()-INTERVAL '5 days'),
    ('b0000001-0000-0000-0000-000000000010', main_id, NOW()-INTERVAL '19 days'),
    ('b0000001-0000-0000-0000-000000000011', main_id, NOW()-INTERVAL '36 days'),
    ('b0000001-0000-0000-0000-000000000012', main_id, NOW()-INTERVAL '4 days'),
    ('b0000001-0000-0000-0000-000000000014', main_id, NOW()-INTERVAL '14 days'),
    ('b0000001-0000-0000-0000-000000000015', main_id, NOW()-INTERVAL '43 days')
  ON CONFLICT (from_user, to_user) DO NOTHING;

  -- Bot×bot cross-likes — populates social graph, some become mutual matches
  INSERT INTO likes (from_user, to_user, created_at) VALUES
    -- Women → Men
    ('b0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000010', NOW()-INTERVAL '16 days'),
    ('b0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000015', NOW()-INTERVAL '22 days'),
    ('b0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '23 days'),
    ('b0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000013', NOW()-INTERVAL '27 days'),
    ('b0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000012', NOW()-INTERVAL '7 days'),
    ('b0000001-0000-0000-0000-000000000004','b0000001-0000-0000-0000-000000000014', NOW()-INTERVAL '30 days'),
    ('b0000001-0000-0000-0000-000000000004','b0000001-0000-0000-0000-000000000015', NOW()-INTERVAL '35 days'),
    ('b0000001-0000-0000-0000-000000000005','b0000001-0000-0000-0000-000000000010', NOW()-INTERVAL '12 days'),
    ('b0000001-0000-0000-0000-000000000006','b0000001-0000-0000-0000-000000000011', NOW()-INTERVAL '39 days'),
    ('b0000001-0000-0000-0000-000000000007','b0000001-0000-0000-0000-000000000013', NOW()-INTERVAL '4 days'),
    ('b0000001-0000-0000-0000-000000000008','b0000001-0000-0000-0000-000000000014', NOW()-INTERVAL '50 days'),
    ('b0000001-0000-0000-0000-000000000009','b0000001-0000-0000-0000-000000000012', NOW()-INTERVAL '10 days'),
    ('b0000001-0000-0000-0000-000000000009','b0000001-0000-0000-0000-000000000010', NOW()-INTERVAL '9 days'),
    -- Men → Women (some mutual = instant match between bots)
    ('b0000001-0000-0000-0000-000000000010','b0000001-0000-0000-0000-000000000001', NOW()-INTERVAL '15 days'),
    ('b0000001-0000-0000-0000-000000000010','b0000001-0000-0000-0000-000000000003', NOW()-INTERVAL '18 days'),
    ('b0000001-0000-0000-0000-000000000011','b0000001-0000-0000-0000-000000000004', NOW()-INTERVAL '34 days'),
    ('b0000001-0000-0000-0000-000000000011','b0000001-0000-0000-0000-000000000006', NOW()-INTERVAL '38 days'),
    ('b0000001-0000-0000-0000-000000000012','b0000001-0000-0000-0000-000000000009', NOW()-INTERVAL '9 days'),
    ('b0000001-0000-0000-0000-000000000013','b0000001-0000-0000-0000-000000000002', NOW()-INTERVAL '26 days'),
    ('b0000001-0000-0000-0000-000000000014','b0000001-0000-0000-0000-000000000008', NOW()-INTERVAL '49 days'),
    ('b0000001-0000-0000-0000-000000000014','b0000001-0000-0000-0000-000000000005', NOW()-INTERVAL '13 days'),
    ('b0000001-0000-0000-0000-000000000015','b0000001-0000-0000-0000-000000000007', NOW()-INTERVAL '42 days')
  ON CONFLICT (from_user, to_user) DO NOTHING;

END $$;
