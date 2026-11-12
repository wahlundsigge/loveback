-- ============================================================
-- LoveBack Migration 004 — Profile RLS fix + new columns
-- Run this in Supabase SQL Editor after 001, 002, and 003
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Allow all authenticated users to read all profiles
--    (Required for swipe cards to load — old policy only allowed own profile)
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────
-- 2. New profile columns for onboarding
-- ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for  TEXT DEFAULT 'everyone';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dating_goal  TEXT;

-- ─────────────────────────────────────────────
-- 3. Fix coin_balance for main user
--    The ON CONFLICT DO UPDATE in 003 did not include coin_balance,
--    so it was left as NULL. NULL < 5000 evaluates to NULL (not TRUE),
--    so the UPDATE was skipped. Fix by checking for IS NULL too.
-- ─────────────────────────────────────────────
UPDATE profiles
SET coin_balance = 5000
WHERE id = (SELECT id FROM auth.users WHERE email = 'wahlundsigge@gmail.com')
  AND (coin_balance IS NULL OR coin_balance < 5000);

-- ─────────────────────────────────────────────
-- 4. Update seed users with looking_for + dating_goal
-- ─────────────────────────────────────────────
UPDATE profiles SET looking_for = 'man',  dating_goal = 'Seriöst förhållande' WHERE id = 'a1000000-0000-0000-0000-000000000001';
UPDATE profiles SET looking_for = 'man',  dating_goal = 'Casual'               WHERE id = 'a1000000-0000-0000-0000-000000000002';
UPDATE profiles SET looking_for = 'man',  dating_goal = 'Vänner'               WHERE id = 'a1000000-0000-0000-0000-000000000003';
UPDATE profiles SET looking_for = 'man',  dating_goal = 'Seriöst förhållande' WHERE id = 'a1000000-0000-0000-0000-000000000004';
UPDATE profiles SET looking_for = 'alla', dating_goal = 'Casual'               WHERE id = 'a1000000-0000-0000-0000-000000000005';
UPDATE profiles SET looking_for = 'man',  dating_goal = 'Seriöst förhållande' WHERE id = 'a1000000-0000-0000-0000-000000000006';
