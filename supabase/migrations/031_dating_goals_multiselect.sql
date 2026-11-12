-- Multi-select dating goals.
-- profiles.dating_goal was a single free-text value, written once at
-- onboarding only. Product now wants multi-select (e.g. "Seriöst förhållande"
-- + "Öppen för allt" together), editable later from the profile page.
--
-- New column rather than widening the old one: several seed/migration files
-- still write single-string values into dating_goal, and repurposing it in
-- place risks a stale cached client sending a bare string into what's now an
-- array column mid-rollout. Matches this codebase's established pattern of
-- leaving old columns in place (avatar/images coexist the same way).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dating_goals TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing rows (including seeded/bot profiles) from the old scalar
-- column so they aren't blank under the new UI.
UPDATE profiles
SET dating_goals = ARRAY[dating_goal]
WHERE dating_goal IS NOT NULL
  AND dating_goal <> ''
  AND dating_goals = '{}';

-- No RLS/RPC changes needed: the existing "own row" UPDATE policy already
-- covers this column like it does name/age/images — dating_goals carries no
-- column-level REVOKE the way coin_balance/is_admin do.
