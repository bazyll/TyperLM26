-- ==============================================================================
-- MILESTONE 6E.1: UEFA Player Identity & UCL Registration Flag
-- ==============================================================================

-- 1. Extend public.players with official UEFA identity and registration fields
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS uefa_player_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_ucl_registered BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uefa_list_type TEXT CHECK (uefa_list_type IN ('A', 'B'));

-- 2. Index for fast filtering in special predictions player picker
CREATE INDEX IF NOT EXISTS idx_players_is_ucl_registered ON public.players(is_ucl_registered);
