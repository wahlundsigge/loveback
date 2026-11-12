-- ── Fix missing defaults on profiles.first_name / last_name ────────────────
-- Same schema drift as 019 (birth_date): the migration files specify
-- DEFAULT '' but the live columns had none, so any INSERT/upsert that
-- omits these NOT NULL columns fails outright. No current app code path
-- hits this (handle_new_user() and onboarding.tsx both supply them
-- explicitly), but it's a landmine for anything written later.
ALTER TABLE profiles ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN last_name SET DEFAULT '';
