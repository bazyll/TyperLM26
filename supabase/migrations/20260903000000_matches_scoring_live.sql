-- ============================================================================
-- Migration: 20260903000000_matches_scoring_live.sql
-- Description: Milestone 3 - Matches Management, Postponed Lock, Immutable Points Trigger,
--              PostgreSQL Finalize Stored Procedure with SECURITY DEFINER & Search Path Isolation,
--              and Active User Enforcement on All SELECT Policies.
-- ============================================================================

-- 1. Matches Table Extensions
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS betting_locked_at TIMESTAMPTZ;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_betting_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Postponed Lock Protection Trigger
-- Guarantees that if a match's original kickoff has passed or betting was already locked,
-- shifting kickoff_at to the future does NOT reopen betting without explicit lock management.
CREATE OR REPLACE FUNCTION public.check_match_betting_lock_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If previous kickoff had already passed (or was already locked), preserve betting lock
  IF (OLD.kickoff_at <= now() OR OLD.is_betting_locked = TRUE) THEN
    NEW.is_betting_locked := TRUE;
    IF NEW.betting_locked_at IS NULL THEN
      NEW.betting_locked_at := COALESCE(OLD.betting_locked_at, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_matches_lock_guard ON public.matches;
CREATE TRIGGER trg_matches_lock_guard
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.check_match_betting_lock_transition();

-- 3. Atomic Match Finalization and Scoring Procedure in PostgreSQL
-- Strictly isolated: SET search_path = '', REVOKE from anon/authenticated/public, GRANT to service_role.
CREATE OR REPLACE FUNCTION public.finalize_and_score_match(
  p_match_id UUID,
  p_home_score INT,
  p_away_score INT
)
RETURNS VOID AS $$
DECLARE
  pred RECORD;
  v_points INT;
  v_cat TEXT;
  v_user_diff INT;
  v_actual_diff INT;
  v_user_outcome INT;
  v_actual_outcome INT;
BEGIN
  -- 1. Update match to finished with final score and permanently lock betting
  UPDATE public.matches
  SET status = 'finished',
      home_score = p_home_score,
      away_score = p_away_score,
      is_betting_locked = TRUE,
      betting_locked_at = COALESCE(betting_locked_at, now()),
      updated_at = now()
  WHERE id = p_match_id;

  v_actual_diff := p_home_score - p_away_score;
  IF v_actual_diff > 0 THEN
    v_actual_outcome := 1;
  ELSIF v_actual_diff < 0 THEN
    v_actual_outcome := -1;
  ELSE
    v_actual_outcome := 0;
  END IF;

  -- 2. Recalculate all predictions for this match atomically
  FOR pred IN
    SELECT id, home_score, away_score
    FROM public.predictions
    WHERE match_id = p_match_id
  LOOP
    -- 1. Exact score check -> 3 points ('exact')
    IF pred.home_score = p_home_score AND pred.away_score = p_away_score THEN
      v_points := 3;
      v_cat := 'exact';
    ELSE
      v_user_diff := pred.home_score - pred.away_score;
      IF v_user_diff > 0 THEN
        v_user_outcome := 1;
      ELSIF v_user_diff < 0 THEN
        v_user_outcome := -1;
      ELSE
        v_user_outcome := 0;
      END IF;

      -- 2. Incorrect outcome -> 0 points ('incorrect')
      IF v_user_outcome <> v_actual_outcome THEN
        v_points := 0;
        v_cat := 'incorrect';
      -- 3. Draw outcome: non-exact draw (e.g. 1:1 vs 2:2, 0:0 vs 3:3) -> 2 points ('diff')
      ELSIF v_user_outcome = 0 AND v_actual_outcome = 0 THEN
        v_points := 2;
        v_cat := 'diff';
      -- 4. Correct winner + correct goal difference -> 2 points ('diff')
      ELSIF v_user_diff = v_actual_diff THEN
        v_points := 2;
        v_cat := 'diff';
      -- 5. Correct winner only with different goal difference -> 1 point ('outcome')
      ELSE
        v_points := 1;
        v_cat := 'outcome';
      END IF;
    END IF;

    -- Update prediction points atomically
    UPDATE public.predictions
    SET points_awarded = v_points,
        scoring_category = v_cat,
        updated_at = now()
    WHERE id = pred.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Explicit Privilege Hardening: REVOKE from public, anon, authenticated; GRANT to service_role only
REVOKE ALL ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) TO service_role;

-- 4. Row Level Security Policy Hardening (Active User Required on SELECT)

-- MATCHES POLICIES
DROP POLICY IF EXISTS "matches_select_all" ON public.matches;
CREATE POLICY "matches_select_active"
ON public.matches FOR SELECT
TO authenticated
USING (public.is_active_user() OR public.is_admin());

-- PREDICTIONS POLICIES
DROP POLICY IF EXISTS "predictions_select_policy" ON public.predictions;
CREATE POLICY "predictions_select_policy"
ON public.predictions FOR SELECT
TO authenticated
USING (
  (public.is_active_user() OR public.is_admin())
  AND (
    auth.uid() = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = predictions.match_id
        AND (matches.kickoff_at <= now() OR matches.is_betting_locked = TRUE)
    )
  )
);

-- TEAMS POLICIES
DROP POLICY IF EXISTS "teams_select_all" ON public.teams;
CREATE POLICY "teams_select_active"
ON public.teams FOR SELECT
TO authenticated
USING (public.is_active_user() OR public.is_admin());

-- PLAYERS POLICIES
DROP POLICY IF EXISTS "players_select_all" ON public.players;
CREATE POLICY "players_select_active"
ON public.players FOR SELECT
TO authenticated
USING (public.is_active_user() OR public.is_admin());
