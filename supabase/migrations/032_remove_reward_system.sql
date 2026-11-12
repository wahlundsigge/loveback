-- Remove the daily-login / referral / new-user-bonus reward system entirely.
-- These all minted coins from nothing (not funded by any other user's
-- transaction), which distorts the coin economy — coins should only move
-- between users, not be created for free. Historical coin_transactions rows
-- and any coin_balance already granted are left untouched (coin_balance is a
-- stored, incrementally-updated column, not recomputed from history, so
-- removing these functions has no retroactive effect on anyone's balance —
-- it only stops new grants of this kind going forward).

DROP FUNCTION IF EXISTS claim_daily_reward();
DROP FUNCTION IF EXISTS get_daily_claim_status();
DROP FUNCTION IF EXISTS claim_new_user_bonus();
DROP FUNCTION IF EXISTS get_or_create_referral_code();
DROP FUNCTION IF EXISTS apply_referral_code(TEXT);

DROP TABLE IF EXISTS daily_claims;
DROP TABLE IF EXISTS referral_uses;
DROP TABLE IF EXISTS referral_codes;

DELETE FROM platform_settings WHERE key IN (
  'daily_reward_base_coins',
  'daily_reward_streak_bonus',
  'new_user_bonus_coins',
  'referral_reward_coins',
  'referral_bonus_coins'
);
