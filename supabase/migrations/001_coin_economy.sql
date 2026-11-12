-- ============================================================
-- LoveBack Coin Economy — Migration 001
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────────
-- 0. Align matches table with app code
--    Live DB has: user1_id, user2_id, unlocked
--    App code expects: user1, user2, chat_unlocked, paid_by, match_locked
-- ─────────────────────────────────────────────

ALTER TABLE matches RENAME COLUMN user1_id TO user1;
ALTER TABLE matches RENAME COLUMN user2_id TO user2;
ALTER TABLE matches RENAME COLUMN unlocked TO chat_unlocked;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS paid_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_locked BOOLEAN NOT NULL DEFAULT TRUE;

-- Drop old RLS policies that used the old column names
DROP POLICY IF EXISTS "Users can view matches involving themselves" ON matches;
DROP POLICY IF EXISTS "Users can update matches involving themselves" ON matches;

CREATE POLICY "Users can view matches involving themselves"
  ON matches FOR SELECT
  USING (auth.uid() = user1 OR auth.uid() = user2);

-- Recreate messages RLS — referenced matches.unlocked which is now chat_unlocked
DROP POLICY IF EXISTS "Users can view messages in their matches" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their unlocked matches" ON messages;

CREATE POLICY "Users can view messages in their matches"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid())
        AND matches.chat_unlocked = TRUE
    )
  );

CREATE POLICY "Users can send messages in their unlocked matches"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid())
        AND matches.chat_unlocked = TRUE
    )
    AND auth.uid() = sender_id
  );


-- ─────────────────────────────────────────────
-- 1. Add coin_balance to profiles
-- ─────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 0;

-- Zero out any existing balances (old wallet_balance was client-side fake data)
UPDATE profiles SET coin_balance = 0;

-- Block all direct client writes to coin_balance
-- (coin mutations must go through SECURITY DEFINER functions only)
REVOKE UPDATE (coin_balance) ON profiles FROM authenticated;
REVOKE UPDATE (coin_balance) ON profiles FROM anon;

-- NOTE: DROP wallet_balance only after the new frontend is confirmed working in production.
-- Run manually when ready:
--   ALTER TABLE profiles DROP COLUMN IF EXISTS wallet_balance;


-- ─────────────────────────────────────────────
-- 2. Lock matches financial columns from direct client writes
-- ─────────────────────────────────────────────
-- The unlock flow must go through the Edge Function → RPC, never the client directly.
-- Column-level REVOKE enforces this as a second layer after RLS.
REVOKE UPDATE (chat_unlocked, paid_by, match_locked) ON matches FROM authenticated;
REVOKE UPDATE (chat_unlocked, paid_by, match_locked) ON matches FROM anon;


-- ─────────────────────────────────────────────
-- 3. coin_packages — configurable purchase options
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_packages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coins           INTEGER NOT NULL,
  price_sek       DECIMAL(10,2) NOT NULL,
  label           TEXT NOT NULL,
  bonus_coins     INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial packages (matches the business doc)
INSERT INTO coin_packages (coins, price_sek, label, sort_order) VALUES
  (100,  9.00,   '100 Coins',   1),
  (500,  39.00,  '500 Coins',   2),
  (1000, 69.00,  '1 000 Coins', 3),
  (2500, 149.00, '2 500 Coins', 4),
  (5000, 249.00, '5 000 Coins', 5)
ON CONFLICT DO NOTHING;

ALTER TABLE coin_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active packages" ON coin_packages;
CREATE POLICY "Anyone can view active packages"
  ON coin_packages FOR SELECT
  USING (is_active = TRUE);


-- ─────────────────────────────────────────────
-- 4. platform_settings — economy config (server-side only writes)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('unlock_cost_coins',   '800', 'Coins required to unlock a match chat'),
  ('reward_amount_coins', '200', 'Coins granted to the non-paying partner on unlock'),
  ('new_user_bonus',      '0',   'Coins granted on first profile completion (0 = disabled)')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read settings" ON platform_settings;
CREATE POLICY "Authenticated users can read settings"
  ON platform_settings FOR SELECT
  TO authenticated
  USING (TRUE);


-- ─────────────────────────────────────────────
-- 5. coin_transactions — immutable ledger
-- Every coin movement is recorded here. Balances are NEVER modified
-- directly; coin_balance in profiles is updated atomically alongside
-- each ledger entry by SECURITY DEFINER functions.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_transactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  type            TEXT NOT NULL,
  CONSTRAINT valid_tx_type CHECK (type IN (
    'purchase',
    'reward',
    'unlock_match',
    'refund',
    'admin_adjustment',
    'bonus',
    'promotion',
    'withdrawal'
  )),
  ref_id          UUID,
  ref_type        TEXT,
  description     TEXT,
  idempotency_key TEXT UNIQUE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_tx_ref  ON coin_transactions(ref_id);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON coin_transactions;
CREATE POLICY "Users can view own transactions"
  ON coin_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated — only SECURITY DEFINER functions write here.
