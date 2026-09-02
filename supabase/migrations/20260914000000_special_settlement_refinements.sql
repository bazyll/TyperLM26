-- ==============================================================================
-- MILESTONE 6E.2: Special Predictions Settlement & Single-Transaction Audit
-- ==============================================================================

-- 1. Ensure matches table supports explicit winner_team_id and events_reconciled_at marker
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS winner_team_id UUID REFERENCES public.teams(id),
  ADD COLUMN IF NOT EXISTS events_reconciled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_winner_team_id ON public.matches(winner_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_events_reconciled_at ON public.matches(events_reconciled_at);

-- 2. Stored Procedure for Atomic Settlement + Points Recalculation + Audit Log in ONE Transaction
CREATE OR REPLACE FUNCTION public.settle_special_prediction_category(
  p_category_id UUID,
  p_admin_id UUID,
  p_correct_team_ids UUID[],
  p_correct_player_ids UUID[],
  p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_category_title TEXT;
  v_category_slug TEXT;
  v_target_type TEXT;
  v_points_value INT;
  v_is_correction BOOLEAN;
  v_impacted_count INT := 0;
  v_winning_count INT := 0;
  v_total_points_awarded INT := 0;
  t_id UUID;
  p_id UUID;
BEGIN
  -- 1. Validate category existence and fetch metadata
  SELECT title, slug, target_type, points_value, (status = 'settled')
  INTO v_category_title, v_category_slug, v_target_type, v_points_value, v_is_correction
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
      INSERT INTO public.special_prediction_correct_answers (category_id, team_id, settled_at, settled_by)
      VALUES (p_category_id, t_id, now(), p_admin_id);
    END LOOP;
  ELSIF v_target_type = 'player' THEN
    IF p_correct_player_ids IS NULL OR array_length(p_correct_player_ids, 1) = 0 THEN
      RAISE EXCEPTION 'At least one correct player ID is required';
    END IF;
    FOREACH p_id IN ARRAY p_correct_player_ids LOOP
      INSERT INTO public.special_prediction_correct_answers (category_id, player_id, settled_at, settled_by)
      VALUES (p_category_id, p_id, now(), p_admin_id);
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

  -- 5. Calculate statistics for audit and return summary
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE points_awarded > 0),
    COALESCE(SUM(points_awarded), 0)
  INTO v_impacted_count, v_winning_count, v_total_points_awarded
  FROM public.special_predictions
  WHERE category_id = p_category_id;

  -- 6. Insert audit log within the exact same atomic transaction
  IF p_admin_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      details
    ) VALUES (
      p_admin_id,
      CASE WHEN v_is_correction THEN 'SPECIAL_RESULT_CORRECTED' ELSE 'SPECIAL_SETTLED' END,
      'special_category',
      p_category_id,
      jsonb_build_object(
        'categoryTitle', v_category_title,
        'categorySlug', v_category_slug,
        'targetType', v_target_type,
        'pointsValue', v_points_value,
        'correctTeamIds', p_correct_team_ids,
        'correctPlayerIds', p_correct_player_ids,
        'impactedPredictionsCount', v_impacted_count,
        'winningUsersCount', v_winning_count,
        'totalPointsAwarded', v_total_points_awarded,
        'extraDetails', p_details
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'categoryId', p_category_id,
    'categorySlug', v_category_slug,
    'impactedPredictionsCount', v_impacted_count,
    'winningUsersCount', v_winning_count,
    'totalPointsAwarded', v_total_points_awarded
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3. Hardened permissions: revoke from public/anon/authenticated, grant only to service_role
REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) TO service_role;
