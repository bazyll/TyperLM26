-- ============================================================================
-- Migration: 20260904000000_specials_pickem_table_announcements_export.sql
-- Description: Milestone 4 - Normalized Special Prediction Correct Answers,
--              Normalized Pick'em Selections, Settlement Procedures (Special & Pick'em),
--              Lock Guard Triggers, Comment Rate Limiting, Players is_active flag,
--              and Strict RLS with Pre-Deadline Secrecy for all users (including admin).
-- ============================================================================

-- 1. PLAYERS TABLE: Support Soft Deactivation
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_players_active ON public.players(is_active);

-- 2. SPECIAL PREDICTION CATEGORIES: Add Locked State
ALTER TABLE public.special_prediction_categories ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.special_prediction_categories ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Trigger: Prevent unlocking or extending deadline once special category deadline has passed
CREATE OR REPLACE FUNCTION public.check_special_category_lock_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.deadline_at <= now() OR OLD.is_locked = TRUE) THEN
    NEW.is_locked := TRUE;
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := COALESCE(OLD.locked_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_special_category_lock_guard ON public.special_prediction_categories;
CREATE TRIGGER trg_special_category_lock_guard
BEFORE UPDATE ON public.special_prediction_categories
FOR EACH ROW
EXECUTE FUNCTION public.check_special_category_lock_transition();

-- 3. SPECIAL PREDICTION CORRECT ANSWERS (Normalized table supporting multiple winners/ties)
CREATE TABLE IF NOT EXISTS public.special_prediction_correct_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.special_prediction_categories(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE RESTRICT,
  player_id UUID REFERENCES public.players(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_single_answer_entity CHECK (
    (team_id IS NOT NULL AND player_id IS NULL) OR
    (team_id IS NULL AND player_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spec_answers_cat_team ON public.special_prediction_correct_answers(category_id, team_id) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_spec_answers_cat_player ON public.special_prediction_correct_answers(category_id, player_id) WHERE player_id IS NOT NULL;

ALTER TABLE public.special_prediction_correct_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spec_answers_select_active"
ON public.special_prediction_correct_answers FOR SELECT
TO authenticated
USING (public.is_active_user() OR public.is_admin());

CREATE POLICY "spec_answers_admin_all"
ON public.special_prediction_correct_answers FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. SPECIAL PREDICTIONS: Type Consistency Check & RLS Hardening
-- Trigger enforcing that team categories only accept team_id and player categories only accept player_id
CREATE OR REPLACE FUNCTION public.check_special_prediction_entity_type()
RETURNS TRIGGER AS $$
DECLARE
  v_target_type TEXT;
BEGIN
  SELECT target_type INTO v_target_type
  FROM public.special_prediction_categories
  WHERE id = NEW.category_id;

  IF v_target_type = 'team' THEN
    IF NEW.selected_team_id IS NULL OR NEW.selected_player_id IS NOT NULL THEN
      RAISE EXCEPTION 'Category requires selected_team_id only';
    END IF;
  ELSIF v_target_type = 'player' THEN
    IF NEW.selected_player_id IS NULL OR NEW.selected_team_id IS NOT NULL THEN
      RAISE EXCEPTION 'Category requires selected_player_id only';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid category target_type';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_special_prediction_type_check ON public.special_predictions;
CREATE TRIGGER trg_special_prediction_type_check
BEFORE INSERT OR UPDATE ON public.special_predictions
FOR EACH ROW
EXECUTE FUNCTION public.check_special_prediction_entity_type();

-- Hardened RLS for Special Predictions (Admin cannot view others before deadline via normal SELECT)
DROP POLICY IF EXISTS "spec_predictions_select_policy" ON public.special_predictions;
CREATE POLICY "spec_predictions_select_policy"
ON public.special_predictions FOR SELECT
TO authenticated
USING (
  (public.is_active_user() OR public.is_admin())
  AND (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.special_prediction_categories c
      WHERE c.id = special_predictions.category_id
        AND (c.deadline_at <= now() OR c.is_locked = TRUE)
    )
  )
);

DROP POLICY IF EXISTS "spec_predictions_insert_policy" ON public.special_predictions;
CREATE POLICY "spec_predictions_insert_policy"
ON public.special_predictions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.special_prediction_categories c
    WHERE c.id = special_predictions.category_id
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
);

DROP POLICY IF EXISTS "spec_predictions_update_policy" ON public.special_predictions;
CREATE POLICY "spec_predictions_update_policy"
ON public.special_predictions FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.special_prediction_categories c
    WHERE c.id = special_predictions.category_id
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.special_prediction_categories c
    WHERE c.id = special_predictions.category_id
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
);

-- 5. ATOMIC STORED PROCEDURE: Settle Special Prediction Category
CREATE OR REPLACE FUNCTION public.settle_special_prediction_category(
  p_category_id UUID,
  p_correct_team_ids UUID[],
  p_correct_player_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_target_type TEXT;
  v_points_value INT;
  t_id UUID;
  p_id UUID;
BEGIN
  -- 1. Validate category existence and fetch metadata
  SELECT target_type, points_value INTO v_target_type, v_points_value
  FROM public.special_prediction_categories
  WHERE id = p_category_id;

  IF v_target_type IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  -- 2. Cleanly replace correct answers in normalized table
  DELETE FROM public.special_prediction_correct_answers WHERE category_id = p_category_id;

  IF v_target_type = 'team' THEN
    IF p_correct_team_ids IS NULL OR array_length(p_correct_team_ids, 1) = 0 THEN
      RAISE EXCEPTION 'At least one correct team ID is required';
    END IF;
    FOREACH t_id IN ARRAY p_correct_team_ids LOOP
      INSERT INTO public.special_prediction_correct_answers (category_id, team_id)
      VALUES (p_category_id, t_id);
    END LOOP;
  ELSIF v_target_type = 'player' THEN
    IF p_correct_player_ids IS NULL OR array_length(p_correct_player_ids, 1) = 0 THEN
      RAISE EXCEPTION 'At least one correct player ID is required';
    END IF;
    FOREACH p_id IN ARRAY p_correct_player_ids LOOP
      INSERT INTO public.special_prediction_correct_answers (category_id, player_id)
      VALUES (p_category_id, p_id);
    END LOOP;
  END IF;

  -- 3. Lock & mark category as settled
  UPDATE public.special_prediction_categories
  SET status = 'settled',
      is_locked = TRUE,
      locked_at = COALESCE(locked_at, now())
  WHERE id = p_category_id;

  -- 4. Idempotently recalculate points from scratch for all predictions in this category
  UPDATE public.special_predictions sp
  SET points_awarded = CASE
    WHEN v_target_type = 'team' AND EXISTS (
      SELECT 1 FROM public.special_prediction_correct_answers a
      WHERE a.category_id = p_category_id AND a.team_id = sp.selected_team_id
    ) THEN v_points_value
    WHEN v_target_type = 'player' AND EXISTS (
      SELECT 1 FROM public.special_prediction_correct_answers a
      WHERE a.category_id = p_category_id AND a.player_id = sp.selected_player_id
    ) THEN v_points_value
    ELSE 0
  END,
  updated_at = now()
  WHERE sp.category_id = p_category_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) FROM anon;
REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) TO service_role;

-- ============================================================================
-- 6. PICK'EM: Config Locking, Normalized Selections & Hardened RLS
-- ============================================================================

ALTER TABLE public.pickem_config ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.pickem_config ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Trigger: Prevent unlocking once pickem deadline passed
CREATE OR REPLACE FUNCTION public.check_pickem_lock_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.deadline_at <= now() OR OLD.is_locked = TRUE) THEN
    NEW.is_locked := TRUE;
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := COALESCE(OLD.locked_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_pickem_lock_guard ON public.pickem_config;
CREATE TRIGGER trg_pickem_lock_guard
BEFORE UPDATE ON public.pickem_config
FOR EACH ROW
EXECUTE FUNCTION public.check_pickem_lock_transition();

-- Normalized table: pickem_selections
CREATE TABLE IF NOT EXISTS public.pickem_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.pickem_submissions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('first', 'top8', 'out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_pickem_sel_submission ON public.pickem_selections(submission_id);
CREATE INDEX IF NOT EXISTS idx_pickem_sel_team ON public.pickem_selections(team_id);

ALTER TABLE public.pickem_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pickem_selections_select_policy"
ON public.pickem_selections FOR SELECT
TO authenticated
USING (
  (public.is_active_user() OR public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.pickem_submissions s
    CROSS JOIN public.pickem_config c
    WHERE s.id = pickem_selections.submission_id
      AND (s.user_id = auth.uid() OR c.deadline_at <= now() OR c.is_locked = TRUE)
  )
);

CREATE POLICY "pickem_selections_admin_all"
ON public.pickem_selections FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Hardened RLS for pickem_submissions
DROP POLICY IF EXISTS "pickem_submissions_select_policy" ON public.pickem_submissions;
CREATE POLICY "pickem_submissions_select_policy"
ON public.pickem_submissions FOR SELECT
TO authenticated
USING (
  (public.is_active_user() OR public.is_admin())
  AND (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pickem_config c
      WHERE c.deadline_at <= now() OR c.is_locked = TRUE
    )
  )
);

DROP POLICY IF EXISTS "pickem_submissions_insert_policy" ON public.pickem_submissions;
CREATE POLICY "pickem_submissions_insert_policy"
ON public.pickem_submissions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_config c
    WHERE c.deadline_at > now() AND NOT c.is_locked
  )
);

DROP POLICY IF EXISTS "pickem_submissions_update_policy" ON public.pickem_submissions;
CREATE POLICY "pickem_submissions_update_policy"
ON public.pickem_submissions FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_config c
    WHERE c.deadline_at > now() AND NOT c.is_locked
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_config c
    WHERE c.deadline_at > now() AND NOT c.is_locked
  )
);

-- 7. ATOMIC STORED PROCEDURE: Settle Pick'em
CREATE OR REPLACE FUNCTION public.settle_pickem(
  p_final_standings UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_sub RECORD;
  v_sel RECORD;
  v_team_rank INT;
  v_score INT;
  v_chosen_teams UUID[];
  t_id UUID;
  v_idx INT;
BEGIN
  IF p_final_standings IS NULL OR array_length(p_final_standings, 1) < 36 THEN
    RAISE EXCEPTION 'Final standings array must contain 36 teams';
  END IF;

  -- 1. Lock & mark pickem as settled
  UPDATE public.pickem_config
  SET status = 'settled',
      is_locked = TRUE,
      locked_at = COALESCE(locked_at, now());

  -- 2. Recalculate each submission
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

    -- Update submission points atomically
    UPDATE public.pickem_submissions
    SET points_awarded = v_score,
        updated_at = now()
    WHERE id = v_sub.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM anon;
REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_pickem(UUID[]) TO service_role;

-- ============================================================================
-- 8. ANNOUNCEMENTS & COMMENTS: Rate Limiting & RLS Hardening
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comment_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_rate_user ON public.comment_rate_limits(user_id, created_at DESC);

ALTER TABLE public.comment_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.comment_rate_limits FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.comment_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_and_record_comment_attempt(
  p_user_id UUID,
  p_max_attempts INT DEFAULT 5,
  p_window_seconds INT DEFAULT 30
)
RETURNS TABLE (
  is_allowed BOOLEAN,
  remaining_seconds INT
) AS $$
DECLARE
  v_count INT := 0;
  v_oldest TIMESTAMPTZ;
  v_remaining INT := 0;
  v_cutoff TIMESTAMPTZ := now() - (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
  -- Cleanup older than 1 hour
  DELETE FROM public.comment_rate_limits
  WHERE created_at < (now() - INTERVAL '1 hour');

  SELECT COUNT(*), MIN(created_at)
  INTO v_count, v_oldest
  FROM public.comment_rate_limits
  WHERE user_id = p_user_id AND created_at > v_cutoff;

  IF v_count >= p_max_attempts THEN
    v_remaining := GREATEST(1, EXTRACT(EPOCH FROM ((COALESCE(v_oldest, now()) + (p_window_seconds || ' seconds')::INTERVAL) - now()))::INT);
    RETURN QUERY SELECT FALSE, v_remaining;
  ELSE
    INSERT INTO public.comment_rate_limits (user_id, created_at)
    VALUES (p_user_id, now());
    RETURN QUERY SELECT TRUE, 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) TO service_role;

-- ANNOUNCEMENTS RLS
DROP POLICY IF EXISTS "announcements_select_all" ON public.announcements;
CREATE POLICY "announcements_select_active"
ON public.announcements FOR SELECT
TO authenticated
USING (public.is_active_user() OR public.is_admin());

-- COMMENTS RLS
DROP POLICY IF EXISTS "comments_select_all" ON public.announcement_comments;
CREATE POLICY "comments_select_active"
ON public.announcement_comments FOR SELECT
TO authenticated
USING (public.is_active_user() OR public.is_admin());

DROP POLICY IF EXISTS "comments_insert_own" ON public.announcement_comments;
CREATE POLICY "comments_insert_own"
ON public.announcement_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "comments_update_own" ON public.announcement_comments;
CREATE POLICY "comments_update_own"
ON public.announcement_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.is_active_user())
WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "comments_delete_own" ON public.announcement_comments;
CREATE POLICY "comments_delete_own"
ON public.announcement_comments FOR DELETE
TO authenticated
USING ((auth.uid() = user_id AND public.is_active_user()) OR public.is_admin());
