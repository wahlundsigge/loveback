-- Fix: add missing auth.identities for all 15 bot accounts.
-- Without these rows, signInWithPassword fails even though auth.users exists.
-- Run in Supabase SQL Editor.

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
) VALUES
  ('b0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001',
   'astrid.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000001","email":"astrid.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '18 days', NOW(), NOW()-INTERVAL '1 day'),

  ('b0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000002',
   'freya.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000002","email":"freya.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '25 days', NOW(), NOW()-INTERVAL '2 days'),

  ('b0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000003',
   'wilma.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000003","email":"wilma.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '9 days', NOW(), NOW()-INTERVAL '1 day'),

  ('b0000001-0000-0000-0000-000000000004','b0000001-0000-0000-0000-000000000004',
   'sigrid.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000004","email":"sigrid.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '33 days', NOW(), NOW()-INTERVAL '3 days'),

  ('b0000001-0000-0000-0000-000000000005','b0000001-0000-0000-0000-000000000005',
   'maja.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000005","email":"maja.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '14 days', NOW(), NOW()-INTERVAL '1 day'),

  ('b0000001-0000-0000-0000-000000000006','b0000001-0000-0000-0000-000000000006',
   'elsa.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000006","email":"elsa.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '41 days', NOW(), NOW()-INTERVAL '5 days'),

  ('b0000001-0000-0000-0000-000000000007','b0000001-0000-0000-0000-000000000007',
   'nora.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000007","email":"nora.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '6 days', NOW(), NOW()),

  ('b0000001-0000-0000-0000-000000000008','b0000001-0000-0000-0000-000000000008',
   'birgit.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000008","email":"birgit.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '52 days', NOW(), NOW()-INTERVAL '7 days'),

  ('b0000001-0000-0000-0000-000000000009','b0000001-0000-0000-0000-000000000009',
   'thea.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000009","email":"thea.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '11 days', NOW(), NOW()-INTERVAL '2 days'),

  ('b0000001-0000-0000-0000-000000000010','b0000001-0000-0000-0000-000000000010',
   'erik.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000010","email":"erik.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '20 days', NOW(), NOW()-INTERVAL '1 day'),

  ('b0000001-0000-0000-0000-000000000011','b0000001-0000-0000-0000-000000000011',
   'axel.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000011","email":"axel.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '37 days', NOW(), NOW()-INTERVAL '4 days'),

  ('b0000001-0000-0000-0000-000000000012','b0000001-0000-0000-0000-000000000012',
   'linus.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000012","email":"linus.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '5 days', NOW(), NOW()),

  ('b0000001-0000-0000-0000-000000000013','b0000001-0000-0000-0000-000000000013',
   'oscar.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000013","email":"oscar.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '28 days', NOW(), NOW()-INTERVAL '3 days'),

  ('b0000001-0000-0000-0000-000000000014','b0000001-0000-0000-0000-000000000014',
   'victor.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000014","email":"victor.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '15 days', NOW(), NOW()-INTERVAL '1 day'),

  ('b0000001-0000-0000-0000-000000000015','b0000001-0000-0000-0000-000000000015',
   'tobias.bot@loveback.test',
   '{"sub":"b0000001-0000-0000-0000-000000000015","email":"tobias.bot@loveback.test","email_verified":true,"phone_verified":false}',
   'email', NOW()-INTERVAL '44 days', NOW(), NOW()-INTERVAL '6 days')

ON CONFLICT (provider, provider_id) DO NOTHING;
