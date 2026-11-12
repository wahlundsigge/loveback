-- 010_linear_coin_economy.sql
-- 1 coin = 0.10 SEK (linear, no discounts)
-- Match unlock: 80 coins = 8 kr  |  Reward: 20 coins = 2 kr
-- Rose:        300 coins = 30 kr  |  Reply reward: 150 coins = 15 kr

-- Clear old packages (removes duplicates)
DELETE FROM coin_packages;

-- Clean linear packages
INSERT INTO coin_packages (coins, price_sek, label, bonus_coins, sort_order, is_active) VALUES
  (  80,    8, '80 Coins',      0, 1, true),
  ( 300,   30, '300 Coins',     0, 2, true),
  ( 500,   50, '500 Coins',     0, 3, true),
  (1000,  100, '1 000 Coins',   0, 4, true),
  (2500,  250, '2 500 Coins',   0, 5, true),
  (5000,  500, '5 000 Coins',   0, 6, true);

-- Update platform settings
UPDATE platform_settings SET value = '80'  WHERE key = 'unlock_cost_coins';
UPDATE platform_settings SET value = '20'  WHERE key = 'reward_amount_coins';
UPDATE platform_settings SET value = '300' WHERE key = 'super_like_cost_coins';
UPDATE platform_settings SET value = '150' WHERE key = 'super_like_reward_coins';

-- Verify
SELECT key, value FROM platform_settings
WHERE key IN ('unlock_cost_coins','reward_amount_coins','super_like_cost_coins','super_like_reward_coins');
SELECT id, coins, price_sek FROM coin_packages ORDER BY sort_order;
