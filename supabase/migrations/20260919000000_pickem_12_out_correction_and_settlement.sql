-- ==============================================================================
-- MILESTONE: Pick'em League Phase Correction (12 OUT / 16 MIDDLE) & Atomic RPC
-- ==============================================================================

-- 1. Atomic RPC: correct_legacy_pickem_submission
-- Atomically validates and corrects a legacy 8-OUT submission to 12 OUT by adding exactly 4 teams from MIDDLE.
-- Uses standard pickem_config.deadline_at (blocked when deadline_at IS NULL OR now() >= deadline_at OR is_locked = TRUE).
CREATE OR REPLACE FUNCTION public.correct_legacy_pickem_submission(
  p_additional_out_team_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_config RECORD;
  v_sub RECORD;
  v_first_id UUID;
  v_top8_ids UUID[];
  v_curr_out_ids UUID[];
  v_combined_out_ids UUID[];
  v_new_team UUID;
  v_duplicate_count INT;
BEGIN
  -- 1. Verify authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Wymagane logowanie do wykonania korekty.';
  END IF;

  -- 2. Verify config & deadline (strictly blocked after deadline_at or when locked)
  SELECT * INTO v_config
  FROM public.pickem_config
  LIMIT 1
  FOR SHARE;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Brak konfiguracji Pick''em.';
  END IF;

  IF v_config.deadline_at IS NULL OR now() >= v_config.deadline_at OR v_config.is_locked = TRUE THEN
    IF v_config.deadline_at IS NULL THEN
      RAISE EXCEPTION 'Termin zapisywania typów Pick''em nie został skonfigurowany.';
    ELSE
      RAISE EXCEPTION 'Termin zapisywania typów Pick''em minął (%s).', to_char(v_config.deadline_at, 'YYYY-MM-DD HH24:MI:SS TZ');
    END IF;
  END IF;

  -- 3. Verify exactly 4 additional OUT teams provided
  IF p_additional_out_team_ids IS NULL OR array_length(p_additional_out_team_ids, 1) <> 4 THEN
    RAISE EXCEPTION 'Musisz wybrać dokładnie 4 dodatkowe drużyny OUT (przekazano %s).', 
      COALESCE(array_length(p_additional_out_team_ids, 1), 0);
  END IF;

  -- Verify all 4 additional teams are distinct
  SELECT count(DISTINCT t) INTO v_duplicate_count FROM unnest(p_additional_out_team_ids) t;
  IF v_duplicate_count <> 4 THEN
    RAISE EXCEPTION 'Wskazane 4 dodatkowe drużyny OUT muszą być unikalne.';
  END IF;

  -- 4. Lock and load user submission
  SELECT * INTO v_sub
  FROM public.pickem_submissions
  WHERE user_id = v_user_id AND config_id = v_config.id
  FOR UPDATE;

  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono Twojego wcześniejszego wyboru Pick''em do korekty.';
  END IF;

  v_first_id := v_sub.first_team_id;
  v_top8_ids := v_sub.top8_team_ids;
  v_curr_out_ids := v_sub.out_team_ids;

  -- Verify submission currently has EXACTLY 8 OUT teams (legacy incomplete status)
  IF array_length(v_curr_out_ids, 1) <> 8 THEN
    IF array_length(v_curr_out_ids, 1) = 12 THEN
      RAISE EXCEPTION 'Twój Pick''em zawiera już 12 drużyn OUT i jest kompletny.';
    ELSE
      RAISE EXCEPTION 'Nieprawidłowa liczba dotychczasowych drużyn OUT (%s). Wymagane 8.', 
        array_length(v_curr_out_ids, 1);
    END IF;
  END IF;

  -- 5. Validate that all 4 additional teams exist in teams table and were in implicit MIDDLE
  FOREACH v_new_team IN ARRAY p_additional_out_team_ids LOOP
    -- Team must exist in teams table
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = v_new_team) THEN
      RAISE EXCEPTION 'Drużyna % nie istnieje w bazie danych.', v_new_team;
    END IF;

    -- Team cannot be the FIRST team
    IF v_new_team = v_first_id THEN
      RAISE EXCEPTION 'Drużyna wyznaczona na 1. miejsce (FIRST) nie może zostać przeniesiona do OUT.';
    END IF;

    -- Team cannot be in TOP 8
    IF v_new_team = ANY(v_top8_ids) THEN
      RAISE EXCEPTION 'Drużyna z kategorii TOP 8 nie może zostać przeniesiona do OUT.';
    END IF;

    -- Team cannot already be in original 8 OUT
    IF v_new_team = ANY(v_curr_out_ids) THEN
      RAISE EXCEPTION 'Drużyna % znajduje się już w Twoich pierwotnych 8 typach OUT.', v_new_team;
    END IF;
  END LOOP;

  -- 6. Combine original 8 OUT + 4 new OUT = 12 OUT
  v_combined_out_ids := v_curr_out_ids || p_additional_out_team_ids;

  -- 7. Update pickem_submissions atomically
  UPDATE public.pickem_submissions
  SET out_team_ids = v_combined_out_ids,
      updated_at = now()
  WHERE id = v_sub.id;

  -- 8. Insert the 4 new selections into pickem_selections
  FOREACH v_new_team IN ARRAY p_additional_out_team_ids LOOP
    INSERT INTO public.pickem_selections (submission_id, team_id, category, created_at)
    VALUES (v_sub.id, v_new_team, 'out', now());
  END LOOP;

  -- 9. Audit log
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (
    v_user_id,
    'PICKEM_LEGACY_CORRECTED',
    'pickem_submissions',
    v_sub.id::text,
    jsonb_build_object(
      'previousOutCount', 8,
      'newOutCount', 12,
      'addedTeamIds', p_additional_out_team_ids
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'submissionId', v_sub.id,
    'outCount', 12,
    'middleCount', 16
  );
END;
$$;

-- Security & Permissions
REVOKE ALL ON FUNCTION public.correct_legacy_pickem_submission(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.correct_legacy_pickem_submission(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.correct_legacy_pickem_submission(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_legacy_pickem_submission(UUID[]) TO service_role;


-- 2. Procedure: Settle Pick'em with strict 12 OUT / 16 MIDDLE guard and 108 max points
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
  v_out_count INT;
  v_top8_count INT;
  v_first_count INT;
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

  -- 3. Calculate each submission with strict completeness check
  FOR v_sub IN
    SELECT id, user_id, first_team_id, top8_team_ids, out_team_ids
    FROM public.pickem_submissions
  LOOP
    v_score := 0;
    v_chosen_teams := ARRAY[]::UUID[];

    -- Check completeness: MUST have 1 FIRST, 7 TOP 8, 12 OUT (Total 20 explicit teams)
    v_first_count := CASE WHEN v_sub.first_team_id IS NOT NULL THEN 1 ELSE 0 END;
    v_top8_count := COALESCE(array_length(v_sub.top8_team_ids, 1), 0);
    v_out_count := COALESCE(array_length(v_sub.out_team_ids, 1), 0);

    -- Also check pickem_selections row count
    IF v_first_count <> 1 OR v_top8_count <> 7 OR v_out_count <> 12 THEN
      -- Incomplete legacy submission (e.g. 8 OUT) -> DO NOT settle, leave points_awarded as NULL
      UPDATE public.pickem_submissions
      SET points_awarded = NULL,
          updated_at = now()
      WHERE id = v_sub.id;
      CONTINUE;
    END IF;

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

      -- 1. FIRST: rank 1 (3 base pts)
      IF v_sel.category = 'first' AND v_team_rank = 1 THEN
        v_score := v_score + 3;
      -- 2. TOP8: rank 1..8 (3 base pts each)
      ELSIF v_sel.category = 'top8' AND v_team_rank >= 1 AND v_team_rank <= 8 THEN
        v_score := v_score + 3;
      -- 3. OUT: rank 25..36 (3 base pts each)
      ELSIF v_sel.category = 'out' AND v_team_rank >= 25 AND v_team_rank <= 36 THEN
        v_score := v_score + 3;
      END IF;
    END LOOP;

    -- 4. Score MIDDLE teams (remaining 16 teams not explicitly chosen, ranks 9..24) -> 3 base pts each
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
