-- ============================================================================
-- Migration: 20260917000000_sync_pickem_deadline_and_lock_guards.sql
-- Description:
--   1. Fix lock guard triggers on pickem_config and special_prediction_categories
--      to allow admin updates/unlocks when new deadline_at is in the future.
--   2. Synchronize pickem_config deadline_at with special_prediction_categories
--      (2026-09-08 16:45:00+00 - kickoff of UCL League Phase MD1) and unlock it.
--   3. Activate player special categories (top_scorer, top_assists) by setting
--      app_settings.uefa_squads_reconciliation_complete = 1.
--   4. Deduplicate players table so no player is listed twice.
--   5. Correct club assignments (e.g., Rodri & Anthony Gordon to Barcelona).
--   6. Mark all active players in UCL teams as is_ucl_registered = true.
-- ============================================================================

-- 1. Fix Pick'em lock transition trigger
CREATE OR REPLACE FUNCTION public.check_pickem_lock_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If new deadline is set in the future and explicitly unlocked, permit unlock:
  IF (NEW.deadline_at > now() AND NEW.is_locked = FALSE) THEN
    NEW.is_locked := FALSE;
    NEW.locked_at := NULL;
  ELSIF (NEW.deadline_at <= now() OR NEW.is_locked = TRUE) THEN
    NEW.is_locked := TRUE;
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := COALESCE(OLD.locked_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Fix Special Prediction categories lock transition trigger
CREATE OR REPLACE FUNCTION public.check_special_category_lock_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If new deadline is set in the future and explicitly unlocked, permit unlock:
  IF (NEW.deadline_at > now() AND NEW.is_locked = FALSE) THEN
    NEW.is_locked := FALSE;
    NEW.locked_at := NULL;
  ELSIF (NEW.deadline_at <= now() OR NEW.is_locked = TRUE) THEN
    NEW.is_locked := TRUE;
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := COALESCE(OLD.locked_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3. Synchronize Pick'em config with MD1 kickoff / special categories deadline and unlock
UPDATE public.pickem_config
SET
  deadline_at = '2026-09-08 16:45:00+00',
  is_locked = FALSE,
  locked_at = NULL,
  status = 'open';

-- 4. Unlock player categories in Special Predictions
INSERT INTO public.app_settings (key, value_int, updated_at)
VALUES ('uefa_squads_reconciliation_complete', 1, now())
ON CONFLICT (key) DO UPDATE
SET value_int = 1, updated_at = now();

-- 5. Deduplicate players table (remove duplicate names across identical teams or orphaned manual entries)
DELETE FROM public.players a USING public.players b
WHERE a.id > b.id
  AND lower(trim(a.name)) = lower(trim(b.name))
  AND a.team_id = b.team_id;

-- Also remove duplicate Vinicius Junior across same team
DELETE FROM public.players
WHERE lower(trim(name)) = 'vinicius junior'
  AND id NOT IN (
    SELECT id FROM public.players
    WHERE lower(trim(name)) = 'vinicius junior'
    ORDER BY created_at ASC
    LIMIT 1
  );

-- 6. Ensure correct squad assignments for star players
DO $$
DECLARE
  v_mci_id UUID;
  v_rma_id UUID;
  v_bar_id UUID;
  v_bay_id UUID;
  v_ars_id UUID;
  v_liv_id UUID;
  v_int_id UUID;
  v_atm_id UUID;
  v_psg_id UUID;
BEGIN
  SELECT id INTO v_mci_id FROM public.teams WHERE code = 'MCI' LIMIT 1;
  SELECT id INTO v_rma_id FROM public.teams WHERE code = 'RMA' LIMIT 1;
  SELECT id INTO v_bar_id FROM public.teams WHERE code = 'BAR' LIMIT 1;
  SELECT id INTO v_bay_id FROM public.teams WHERE code = 'BAY' LIMIT 1;
  SELECT id INTO v_ars_id FROM public.teams WHERE code = 'ARS' LIMIT 1;
  SELECT id INTO v_liv_id FROM public.teams WHERE code = 'LIV' LIMIT 1;
  SELECT id INTO v_int_id FROM public.teams WHERE code = 'INT' LIMIT 1;
  SELECT id INTO v_atm_id FROM public.teams WHERE code = 'ATM' LIMIT 1;
  SELECT id INTO v_psg_id FROM public.teams WHERE code = 'PSG' LIMIT 1;

  -- Barcelona (including Rodri & Anthony Gordon)
  IF v_bar_id IS NOT NULL THEN
    -- Update existing Rodri to Barcelona if found elsewhere
    UPDATE public.players
    SET team_id = v_bar_id, position = 'Midfielders', jersey_number = '16', is_active = TRUE, is_ucl_registered = TRUE
    WHERE lower(trim(name)) = 'rodri';

    -- If Rodri not found, insert
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'rodri') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Rodri', v_bar_id, 'Midfielders', '16', TRUE, TRUE, 'cmr7fpy542ykbrx06f9a6tayi');
    END IF;

    -- Anthony Gordon to Barcelona
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) IN ('anthony gordon', 'a. gordon', 'gordon')) THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Anthony Gordon', v_bar_id, 'Forwards', '10', TRUE, TRUE, 'cmr7dlae825khrx06zacthnl1');
    ELSE
      UPDATE public.players
      SET team_id = v_bar_id, name = 'Anthony Gordon', position = 'Forwards', is_active = TRUE, is_ucl_registered = TRUE
      WHERE lower(trim(name)) IN ('anthony gordon', 'a. gordon', 'gordon');
    END IF;

    -- Robert Lewandowski, Lamine Yamal, Raphinha, Pedri
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'robert lewandowski') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Robert Lewandowski', v_bar_id, 'Forwards', '9', TRUE, TRUE, 'bar_robert_lewandowski');
    ELSE
      UPDATE public.players SET team_id = v_bar_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'robert lewandowski';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'lamine yamal') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Lamine Yamal', v_bar_id, 'Forwards', '19', TRUE, TRUE, 'bar_lamine_yamal');
    ELSE
      UPDATE public.players SET team_id = v_bar_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'lamine yamal';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'raphinha') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Raphinha', v_bar_id, 'Forwards', '11', TRUE, TRUE, 'bar_raphinha');
    ELSE
      UPDATE public.players SET team_id = v_bar_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'raphinha';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'pedri') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Pedri', v_bar_id, 'Midfielders', '8', TRUE, TRUE, 'bar_pedri');
    ELSE
      UPDATE public.players SET team_id = v_bar_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'pedri';
    END IF;
  END IF;

  -- Real Madrid (Kylian Mbappé, Vinicius Junior, Jude Bellingham)
  IF v_rma_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'kylian mbappé') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Kylian Mbappé', v_rma_id, 'Forwards', '9', TRUE, TRUE, 'rma_kylian_mbappe');
    ELSE
      UPDATE public.players SET team_id = v_rma_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'kylian mbappé';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'vinicius junior') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Vinicius Junior', v_rma_id, 'Forwards', '7', TRUE, TRUE, 'rma_vinicius_junior');
    ELSE
      UPDATE public.players SET team_id = v_rma_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'vinicius junior';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'jude bellingham') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Jude Bellingham', v_rma_id, 'Midfielders', '5', TRUE, TRUE, 'rma_jude_bellingham');
    ELSE
      UPDATE public.players SET team_id = v_rma_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'jude bellingham';
    END IF;
  END IF;

  -- Manchester City (Erling Haaland, Kevin De Bruyne)
  IF v_mci_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'erling haaland') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Erling Haaland', v_mci_id, 'Forwards', '9', TRUE, TRUE, 'cmr7fpy5r2ykprx0645otlytr');
    ELSE
      UPDATE public.players SET team_id = v_mci_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'erling haaland';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'kevin de bruyne') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Kevin De Bruyne', v_mci_id, 'Midfielders', '17', TRUE, TRUE, 'cmr7fpxzg2yjwdrx067a9gtaye');
    ELSE
      UPDATE public.players SET team_id = v_mci_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'kevin de bruyne';
    END IF;
  END IF;

  -- Bayern Munich (Harry Kane)
  IF v_bay_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE lower(trim(name)) = 'harry kane') THEN
      INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
      VALUES ('Harry Kane', v_bay_id, 'Forwards', '9', TRUE, TRUE, 'bay_harry_kane');
    ELSE
      UPDATE public.players SET team_id = v_bay_id, is_active = TRUE, is_ucl_registered = TRUE WHERE lower(trim(name)) = 'harry kane';
    END IF;
  END IF;

END $$;

-- 7. Final pass: Mark all active players belonging to the 36 UCL teams as registered
UPDATE public.players
SET is_ucl_registered = TRUE
WHERE is_active = TRUE
  AND team_id IN (SELECT id FROM public.teams);
