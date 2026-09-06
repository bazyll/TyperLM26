-- ============================================================================
-- Migration: 20260917000000_sync_pickem_deadline_and_lock_guards.sql
-- Description:
--   1. Fix lock guard triggers on pickem_config and special_prediction_categories
--      to allow admin updates/unlocks when new deadline_at is in the future.
--   2. Synchronize pickem_config deadline_at with special_prediction_categories
--      (2026-09-08 16:45:00+00 - kickoff of UCL League Phase MD1) and unlock it.
--   3. Activate player special categories (top_scorer, top_assists) by setting
--      app_settings.uefa_squads_reconciliation_complete = 1.
--   4. Ensure all active players are marked is_ucl_registered = true and
--      seed/update marquee UCL star players (Rodri, Haaland, Mbappé, Lewandowski, etc.).
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

-- 5. Mark all active players as is_ucl_registered = true
UPDATE public.players
SET is_ucl_registered = TRUE
WHERE is_active = TRUE;

-- 6. Ensure marquee UCL players exist and are assigned to their UCL teams
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

  -- Manchester City
  IF v_mci_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Rodri', v_mci_id, 'Midfielders', '16', TRUE, TRUE, 'cmr7fpy542ykbrx06f9a6tayi'),
      ('Erling Haaland', v_mci_id, 'Forwards', '9', TRUE, TRUE, 'cmr7fpy5r2ykprx0645otlytr'),
      ('Kevin De Bruyne', v_mci_id, 'Midfielders', '17', TRUE, TRUE, 'cmr7fpxzg2yjwdrx067a9gtaye'),
      ('Phil Foden', v_mci_id, 'Midfielders', '47', TRUE, TRUE, 'mci_phil_foden')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Real Madrid
  IF v_rma_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Kylian Mbappé', v_rma_id, 'Forwards', '9', TRUE, TRUE, 'rma_kylian_mbappe'),
      ('Vinicius Junior', v_rma_id, 'Forwards', '7', TRUE, TRUE, 'rma_vinicius_junior'),
      ('Jude Bellingham', v_rma_id, 'Midfielders', '5', TRUE, TRUE, 'rma_jude_bellingham'),
      ('Rodrygo', v_rma_id, 'Forwards', '11', TRUE, TRUE, 'rma_rodrygo')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Barcelona
  IF v_bar_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Robert Lewandowski', v_bar_id, 'Forwards', '9', TRUE, TRUE, 'bar_robert_lewandowski'),
      ('Lamine Yamal', v_bar_id, 'Forwards', '19', TRUE, TRUE, 'bar_lamine_yamal'),
      ('Raphinha', v_bar_id, 'Forwards', '11', TRUE, TRUE, 'bar_raphinha'),
      ('Pedri', v_bar_id, 'Midfielders', '8', TRUE, TRUE, 'bar_pedri')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bayern Munich
  IF v_bay_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Harry Kane', v_bay_id, 'Forwards', '9', TRUE, TRUE, 'bay_harry_kane'),
      ('Jamal Musiala', v_bay_id, 'Midfielders', '42', TRUE, TRUE, 'bay_jamal_musiala'),
      ('Michael Olise', v_bay_id, 'Forwards', '17', TRUE, TRUE, 'bay_michael_olise')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Arsenal
  IF v_ars_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Bukayo Saka', v_ars_id, 'Forwards', '7', TRUE, TRUE, 'ars_bukayo_saka'),
      ('Kai Havertz', v_ars_id, 'Forwards', '29', TRUE, TRUE, 'ars_kai_havertz'),
      ('Martin Ødegaard', v_ars_id, 'Midfielders', '8', TRUE, TRUE, 'ars_martin_odegaard')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Liverpool
  IF v_liv_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Mohamed Salah', v_liv_id, 'Forwards', '11', TRUE, TRUE, 'liv_mohamed_salah'),
      ('Darwin Núñez', v_liv_id, 'Forwards', '9', TRUE, TRUE, 'liv_darwin_nunez')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Inter
  IF v_int_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Lautaro Martínez', v_int_id, 'Forwards', '10', TRUE, TRUE, 'int_lautaro_martinez'),
      ('Marcus Thuram', v_int_id, 'Forwards', '9', TRUE, TRUE, 'int_marcus_thuram')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Atletico Madrid
  IF v_atm_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Antoine Griezmann', v_atm_id, 'Forwards', '7', TRUE, TRUE, 'atm_antoine_griezmann'),
      ('Julián Alvarez', v_atm_id, 'Forwards', '19', TRUE, TRUE, 'atm_julian_alvarez')
    ON CONFLICT DO NOTHING;
  END IF;

  -- PSG
  IF v_psg_id IS NOT NULL THEN
    INSERT INTO public.players (name, team_id, position, jersey_number, is_active, is_ucl_registered, goal_api_player_id)
    VALUES
      ('Ousmane Dembélé', v_psg_id, 'Forwards', '10', TRUE, TRUE, 'psg_ousmane_dembele'),
      ('Bradley Barcola', v_psg_id, 'Forwards', '29', TRUE, TRUE, 'psg_bradley_barcola')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
