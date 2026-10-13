-- ==============================================================================
-- Migration: 20260930000000_save_batch_predictions_rpc.sql
-- Description: Transactional DB-atomic RPC for batch predictions save
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.save_batch_predictions(
    p_predictions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_item JSONB;
    v_match_id UUID;
    v_home_score INT;
    v_away_score INT;
    v_match RECORD;
    v_count INT := 0;
BEGIN
    -- 1. Identify current authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Wymagane logowanie do zapisu typów.';
    END IF;

    -- Verify active status
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_user_id AND (is_active IS NULL OR is_active = TRUE)
    ) THEN
        RAISE EXCEPTION 'Konto użytkownika jest zablokowane.';
    END IF;

    IF p_predictions IS NULL OR jsonb_array_length(p_predictions) = 0 THEN
        RAISE EXCEPTION 'Pusta lista typów do zapisania.';
    END IF;

    -- 2. Validate ALL matches atomically BEFORE saving anything
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_predictions)
    LOOP
        v_match_id := (v_item->>'match_id')::UUID;
        v_home_score := (v_item->>'home_score')::INT;
        v_away_score := (v_item->>'away_score')::INT;

        IF v_home_score < 0 OR v_home_score > 99 OR v_away_score < 0 OR v_away_score > 99 THEN
            RAISE EXCEPTION 'Wynik musi mieścić się w przedziale 0-99.';
        END IF;

        -- Lock match row in transaction
        SELECT id, kickoff_at, is_betting_locked, status,
               (SELECT name FROM public.teams WHERE id = home_team_id) as home_name,
               (SELECT name FROM public.teams WHERE id = away_team_id) as away_name
        INTO v_match
        FROM public.matches
        WHERE id = v_match_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Nie znaleziono meczu %', v_match_id;
        END IF;

        IF now() >= v_match.kickoff_at THEN
            RAISE EXCEPTION 'Typowanie dla meczu % vs % zostało zablokowane (mecz rozpoczęty).', 
                COALESCE(v_match.home_name, 'Gospodarze'), 
                COALESCE(v_match.away_name, 'Goście');
        END IF;

        IF v_match.is_betting_locked THEN
            RAISE EXCEPTION 'Typowanie dla meczu % vs % zostało zablokowane przez administratora.', 
                COALESCE(v_match.home_name, 'Gospodarze'), 
                COALESCE(v_match.away_name, 'Goście');
        END IF;

        IF v_match.status != 'scheduled' THEN
            RAISE EXCEPTION 'Typowanie dla meczu % vs % jest niedostępne (status: %).', 
                COALESCE(v_match.home_name, 'Gospodarze'), 
                COALESCE(v_match.away_name, 'Goście'),
                v_match.status;
        END IF;
    END LOOP;

    -- 3. Upsert predictions atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_predictions)
    LOOP
        v_match_id := (v_item->>'match_id')::UUID;
        v_home_score := (v_item->>'home_score')::INT;
        v_away_score := (v_item->>'away_score')::INT;

        INSERT INTO public.predictions (
            user_id,
            match_id,
            home_score,
            away_score,
            updated_at
        )
        VALUES (
            v_user_id,
            v_match_id,
            v_home_score,
            v_away_score,
            now()
        )
        ON CONFLICT (user_id, match_id)
        DO UPDATE SET
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            updated_at = now();

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_count
    );
END;
$$;
