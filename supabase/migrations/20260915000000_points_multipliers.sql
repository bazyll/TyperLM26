-- ============================================================================
-- Migration: 20260915000000_points_multipliers.sql
-- Description: Milestone 7X.2 - Points Multipliers for Matches and Pick'em,
--              Hardened App Settings table & RLS, Strict Match Multiplier Ingestion
--              Lifecycle (Future scheduled only, no historical pollution),
--              Pick'em Multiplier Lock Guard (Locked upon deadline or is_locked),
--              Non-retroactive Match and Pick'em scoring procedures.
-- ============================================================================

-- 1. MATCHES TABLE: Add points_multiplier column (default 1, range 1-10)
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS points_multiplier INT NOT NULL DEFAULT 1 
CHECK (points_multiplier >= 1 AND points_multiplier <= 10);

-- 2. PICK'EM CONFIG TABLE: Add points_multiplier column (default 1, range 1-10)
ALTER TABLE public.pickem_config 
ADD COLUMN IF NOT EXISTS points_multiplier INT NOT NULL DEFAULT 1 
CHECK (points_multiplier >= 1 AND points_multiplier <= 10);

-- 3. APP SETTINGS TABLE: Central configuration for system defaults
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value_int INT,
  value_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial default multipliers and readiness marker
INSERT INTO public.app_settings (key, value_int, updated_at)
VALUES 
  ('default_match_multiplier', 1, now()),
  ('default_pickem_multiplier', 1, now()),
  ('uefa_squads_reconciliation_complete', 0, now())
ON CONFLICT (key) DO NOTHING;

-- RLS & Grants Hardening for app_settings (Server-side service_role modification only, authenticated SELECT only)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_settings FROM PUBLIC;
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.app_settings FROM authenticated;

-- Authenticated users (including regular players) can ONLY SELECT
GRANT SELECT ON public.app_settings TO authenticated;

-- Server-side admin actions & procedures use service_role for all write operations
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS "app_settings_select_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_select_authenticated" ON public.app_settings;

CREATE POLICY "app_settings_select_authenticated"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

-- 4. TRIGGER: Auto-stamp default multiplier ONLY on genuine future scheduled fixtures
-- (Historical, backfilled, or finished matches are NEVER stamped with current default multiplier)
CREATE OR REPLACE FUNCTION public.set_match_default_multiplier()
RETURNS TRIGGER AS $$
DECLARE
  v_default INT;
BEGIN
  -- Only apply active default multiplier if:
  -- 1. Caller did not specify an explicit custom multiplier > 1
  -- 2. Match is genuinely a future scheduled fixture (status = 'scheduled' AND kickoff_at > now())
  IF (NEW.points_multiplier IS NULL OR NEW.points_multiplier = 1) THEN
    IF (NEW.status = 'scheduled' AND NEW.kickoff_at > now()) THEN
      SELECT value_int INTO v_default FROM public.app_settings WHERE key = 'default_match_multiplier';
      IF v_default IS NOT NULL AND v_default >= 1 AND v_default <= 10 THEN
        NEW.points_multiplier := v_default;
      ELSE
        NEW.points_multiplier := 1;
      END IF;
    ELSE
      -- For historical backfills, past or non-scheduled fixtures, default to base x1
      NEW.points_multiplier := 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_set_match_default_multiplier ON public.matches;
CREATE TRIGGER trg_set_match_default_multiplier
BEFORE INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.set_match_default_multiplier();

-- 5. TRIGGER: Pick'em Multiplier Lock Guard
-- (Prevent changing points_multiplier once Pick'em deadline passed, is_locked = true, or status != 'open')
CREATE OR REPLACE FUNCTION public.check_pickem_multiplier_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.is_locked = TRUE OR OLD.deadline_at <= now() OR OLD.status <> 'open') THEN
    IF (NEW.points_multiplier IS DISTINCT FROM OLD.points_multiplier) THEN
      RAISE EXCEPTION 'Cannot modify points_multiplier on a locked, expired, or non-open Pickem edition';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_pickem_multiplier_lock_guard ON public.pickem_config;
CREATE TRIGGER trg_pickem_multiplier_lock_guard
BEFORE UPDATE ON public.pickem_config
FOR EACH ROW
EXECUTE FUNCTION public.check_pickem_multiplier_lock();

-- 6. PROCEDURE: Atomic Match Finalization with Multiplier Support
CREATE OR REPLACE FUNCTION public.finalize_and_score_match(
  p_match_id UUID,
  p_home_score INT,
  p_away_score INT
)
RETURNS VOID AS $$
DECLARE
  pred RECORD;
  v_points INT;
  v_final_points INT;
  v_cat TEXT;
  v_user_diff INT;
  v_actual_diff INT;
  v_user_outcome INT;
  v_actual_outcome INT;
  v_match_multiplier INT;
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

  -- 2. Read snapshotted match multiplier
  SELECT COALESCE(points_multiplier, 1) INTO v_match_multiplier
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match_multiplier IS NULL OR v_match_multiplier < 1 THEN
    v_match_multiplier := 1;
  END IF;

  v_actual_diff := p_home_score - p_away_score;
  IF v_actual_diff > 0 THEN
    v_actual_outcome := 1;
  ELSIF v_actual_diff < 0 THEN
    v_actual_outcome := -1;
  ELSE
    v_actual_outcome := 0;
  END IF;

  -- 3. Recalculate all predictions for this match atomically with multiplier
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
      -- 3. Draw outcome: non-exact draw -> 2 points ('diff')
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

    -- Apply match multiplier
    v_final_points := v_points * v_match_multiplier;

    -- Update prediction points atomically
    UPDATE public.predictions
    SET points_awarded = v_final_points,
        scoring_category = v_cat,
        updated_at = now()
    WHERE id = pred.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_and_score_match(UUID, INT, INT) TO service_role;

-- 7. PROCEDURE: Settle Pick'em with Multiplier Support
CREATE OR REPLACE FUNCTION public.settle_pickem(
  p_final_standings UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_sub RECORD;
  v_sel RECORD;
  v_team_rank INT;
  v_score INT;
  v_final_score INT;
  v_chosen_teams UUID[];
  t_id UUID;
  v_idx INT;
  v_pickem_multiplier INT;
BEGIN
  IF p_final_standings IS NULL OR array_length(p_final_standings, 1) < 36 THEN
    RAISE EXCEPTION 'Final standings array must contain 36 teams';
  END IF;

  -- 1. Read pickem multiplier from active config
  SELECT COALESCE(points_multiplier, 1) INTO v_pickem_multiplier
  FROM public.pickem_config
  LIMIT 1;

  IF v_pickem_multiplier IS NULL OR v_pickem_multiplier < 1 THEN
    v_pickem_multiplier := 1;
  END IF;

  -- 2. Lock & mark pickem as settled
  UPDATE public.pickem_config
  SET status = 'settled',
      is_locked = TRUE,
      locked_at = COALESCE(locked_at, now());

  -- 3. Recalculate each submission with multiplier
  FOR v_sub IN
    SELECT id, user_id FROM public.pickem_submissions
  LOOP
    v_score := 0;
    v_chosen_teams := ARRAY[]::UUID[];

    -- Score explicit selections (first, top8, out)
    FOR v_sel IN
      SELECT team_id, category FROM public.pickem_selections WHERE submission_id = v_sub.id
    LOOP
      v_chosen_teams := array_append(v_chosen_teams, v_sel.team_id);
      
      -- Find rank in 1..36
      v_team_rank := 0;
      FOR v_idx IN 1..array_length(p_final_standings, 1) LOOP
        IF p_final_standings[v_idx] = v_sel.team_id THEN
          v_team_rank := v_idx;
          EXIT;
        END IF;
      END LOOP;

      IF v_sel.category = 'first' AND v_team_rank = 1 THEN
        v_score := v_score + 3;
      ELSIF v_sel.category = 'top8' AND v_team_rank >= 1 AND v_team_rank <= 8 THEN
        v_score := v_score + 3;
      ELSIF v_sel.category = 'out' AND v_team_rank >= 25 AND v_team_rank <= 36 THEN
        v_score := v_score + 3;
      END IF;
    END LOOP;

    -- Score MIDDLE teams (remaining 20 teams not explicitly chosen, ranks 9..24)
    FOREACH t_id IN ARRAY p_final_standings LOOP
      IF NOT (t_id = ANY(v_chosen_teams)) THEN
        -- Find rank
        FOR v_idx IN 1..array_length(p_final_standings, 1) LOOP
          IF p_final_standings[v_idx] = t_id THEN
            IF v_idx >= 9 AND v_idx <= 24 THEN
              v_score := v_score + 3;
            END IF;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    -- Apply multiplier
    v_final_score := v_score * v_pickem_multiplier;

    -- Update submission points atomically
    UPDATE public.pickem_submissions
    SET points_awarded = v_final_score,
        updated_at = now()
    WHERE id = v_sub.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM anon;
REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_pickem(UUID[]) TO service_role;
