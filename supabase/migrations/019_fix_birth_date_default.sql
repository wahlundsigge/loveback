-- ── Fix missing default on profiles.birth_date ─────────────────────────────
-- Live schema had drifted from 000_complete_setup.sql: birth_date is
-- NOT NULL but its DEFAULT '2000-01-01' was missing, so handle_new_user()'s
-- trigger insert (which doesn't specify birth_date) has been silently
-- failing for every new signup — new users got no profiles row at all until
-- completing onboarding (which does specify birth_date explicitly).
ALTER TABLE profiles ALTER COLUMN birth_date SET DEFAULT '2000-01-01';
