-- ==============================================================================
-- MILESTONE 6E: Players GOAL API Identity & Special Predictions Categories
-- ==============================================================================

-- 1. Extend public.players table with stable external IDs and metadata
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS goal_api_player_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS goal_api_player_api_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS jersey_number TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Indexes for relational filtering (UNIQUE constraint already creates index for external IDs)
CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_is_active ON public.players(is_active);

-- 3. Seed / Update the 6 Official Special Prediction Categories
-- Uses actual League Phase minimum kickoff_at as the true deadline
DO $$
DECLARE
  v_deadline TIMESTAMPTZ;
BEGIN
  -- Retrieve true first kickoff of the league phase
  SELECT MIN(kickoff_at) INTO v_deadline
  FROM public.matches
  WHERE stage = 'league';

  -- Only proceed if genuine schedule deadline exists
  IF v_deadline IS NOT NULL THEN
    INSERT INTO public.special_prediction_categories (slug, title, description, target_type, points_value, deadline_at, status)
    VALUES
      (
        'winner',
        'Zwycięzca Ligi Mistrzów',
        'Kto wygra finał Champions League 2026/2027?',
        'team',
        20,
        v_deadline,
        'open'
      ),
      (
        'finalist',
        'Finalista Ligi Mistrzów',
        'Kto zagra w finale Champions League? (obie drużyny grające w finale są poprawnymi odpowiedziami)',
        'team',
        20,
        v_deadline,
        'open'
      ),
      (
        'top_scorer',
        'Król strzelców',
        'Kto zdobędzie najwięcej bramek w całym sezonie LM? (w przypadku remisu wszyscy współliderzy są poprawni)',
        'player',
        20,
        v_deadline,
        'open'
      ),
      (
        'top_assists',
        'Król asyst',
        'Kto zaliczy najwięcej asyst w sezonie? (w przypadku remisu wszyscy współliderzy są poprawni)',
        'player',
        20,
        v_deadline,
        'open'
      ),
      (
        'team_most_goals',
        'Najwięcej strzelonych goli',
        'Która drużyna strzeli najwięcej goli w sezonie? (w przypadku remisu wszystkie drużyny na 1. miejscu są poprawne)',
        'team',
        20,
        v_deadline,
        'open'
      ),
      (
        'team_most_clean_sheets',
        'Najwięcej czystych kont',
        'Która drużyna zanotuje najwięcej meczów bez straty gola? (w przypadku remisu wszystkie drużyny na 1. miejscu są poprawne)',
        'team',
        20,
        v_deadline,
        'open'
      )
    ON CONFLICT (slug) DO UPDATE
    SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      target_type = EXCLUDED.target_type,
      points_value = EXCLUDED.points_value;
  END IF;
END $$;
