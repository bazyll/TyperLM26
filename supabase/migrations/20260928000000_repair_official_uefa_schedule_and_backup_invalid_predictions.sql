-- Migration: 20260928000000_repair_official_uefa_schedule_and_backup_invalid_predictions.sql
-- Description: Repairs MD2-MD8 schedule with official UEFA 2026/27 fixtures in-place, backs up 40 invalidated predictions dynamically from live DB, and executes strict pre/post assertions.

BEGIN;

-- ============================================================================
-- 1. PRE-MIGRATION SANITY ASSERTIONS
-- ============================================================================
DO $$
DECLARE
  v_total_matches INT;
  v_md1_matches INT;
  v_future_matches INT;
  v_future_preds INT;
  v_preserved_preds INT;
  v_invalid_preds INT;
  v_roma_slovan_match_id UUID;
BEGIN
  -- 1.1 Total matches count
  SELECT COUNT(*) INTO v_total_matches FROM public.matches;
  IF v_total_matches <> 144 THEN
    RAISE EXCEPTION 'Pre-migration assertion failed: total matches is %, expected 144', v_total_matches;
  END IF;

  -- 1.2 MD1 matches count
  SELECT COUNT(*) INTO v_md1_matches FROM public.matches WHERE matchday = 1 AND status = 'finished';
  IF v_md1_matches <> 18 THEN
    RAISE EXCEPTION 'Pre-migration assertion failed: finished MD1 matches is %, expected 18', v_md1_matches;
  END IF;

  -- 1.3 MD2-MD8 matches count
  SELECT COUNT(*) INTO v_future_matches FROM public.matches WHERE matchday >= 2;
  IF v_future_matches <> 126 THEN
    RAISE EXCEPTION 'Pre-migration assertion failed: MD2-MD8 matches is %, expected 126', v_future_matches;
  END IF;

  -- 1.4 Future predictions count
  SELECT COUNT(*) INTO v_future_preds
  FROM public.predictions p
  JOIN public.matches m ON p.match_id = m.id
  WHERE m.matchday >= 2;

  IF v_future_preds <> 41 THEN
    RAISE EXCEPTION 'Pre-migration assertion failed: future predictions is %, expected 41', v_future_preds;
  END IF;

  -- 1.5 Find Roma vs Slovan match ID in MD3
  SELECT m.id INTO v_roma_slovan_match_id
  FROM public.matches m
  JOIN public.teams ht ON m.home_team_id = ht.id
  JOIN public.teams at ON m.away_team_id = at.id
  WHERE m.matchday = 3 AND ht.name = 'AS Roma' AND at.name = 'Slovan Bratislava';

  IF v_roma_slovan_match_id IS NULL THEN
    RAISE EXCEPTION 'Pre-migration assertion failed: AS Roma vs Slovan Bratislava match in MD3 not found';
  END IF;

  -- 1.6 Preserved prediction check
  SELECT COUNT(*) INTO v_preserved_preds
  FROM public.predictions
  WHERE match_id = v_roma_slovan_match_id;

  IF v_preserved_preds <> 1 THEN
    RAISE EXCEPTION 'Pre-migration assertion failed: preserved predictions count is %, expected 1', v_preserved_preds;
  END IF;

  -- 1.7 Invalid predictions check
  SELECT COUNT(*) INTO v_invalid_preds
  FROM public.predictions p
  JOIN public.matches m ON p.match_id = m.id
  WHERE m.matchday >= 2 AND m.id <> v_roma_slovan_match_id;

  IF v_invalid_preds <> 40 THEN
    RAISE EXCEPTION 'Pre-migration assertion failed: invalid predictions count is %, expected 40', v_invalid_preds;
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE AUDIT BACKUP TABLE (invalidated_predictions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invalidated_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_prediction_id UUID NOT NULL,
  user_id UUID NOT NULL,
  match_id UUID NOT NULL,
  old_home_team_id UUID NOT NULL,
  old_away_team_id UUID NOT NULL,
  predicted_home_score INTEGER NOT NULL,
  predicted_away_score INTEGER NOT NULL,
  original_created_at TIMESTAMPTZ,
  original_updated_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL DEFAULT 'schedule_repair_2026_27'
);

ALTER TABLE public.invalidated_predictions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invalidated_predictions' AND policyname = 'Admin can view invalidated predictions'
  ) THEN
    CREATE POLICY "Admin can view invalidated predictions" ON public.invalidated_predictions
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invalidated_predictions' AND policyname = 'Users can view their own invalidated predictions'
  ) THEN
    CREATE POLICY "Users can view their own invalidated predictions" ON public.invalidated_predictions
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 3. DYNAMIC BACKUP OF INVALID PREDICTIONS FROM LIVE DATABASE
-- ============================================================================
INSERT INTO public.invalidated_predictions (
  original_prediction_id,
  user_id,
  match_id,
  old_home_team_id,
  old_away_team_id,
  predicted_home_score,
  predicted_away_score,
  original_created_at,
  original_updated_at,
  invalidated_at,
  reason
)
SELECT
  p.id,
  p.user_id,
  p.match_id,
  m.home_team_id,
  m.away_team_id,
  p.home_score,
  p.away_score,
  p.created_at,
  p.updated_at,
  now(),
  'schedule_repair_2026_27'
FROM public.predictions p
JOIN public.matches m ON p.match_id = m.id
WHERE m.matchday >= 2
  AND NOT (
    m.home_team_id = (SELECT id FROM public.teams WHERE name = 'AS Roma')
    AND m.away_team_id = (SELECT id FROM public.teams WHERE name = 'Slovan Bratislava')
    AND m.matchday = 3
  );

-- Delete invalidated predictions from active predictions table
DELETE FROM public.predictions
WHERE id IN (
  SELECT original_prediction_id FROM public.invalidated_predictions WHERE reason = 'schedule_repair_2026_27'
);

-- ============================================================================
-- 4. IN-PLACE REPAIR OF MATCHES (MD2 - MD8)
-- ============================================================================

-- 4.1 Clear Goal API fixture IDs for MD2-MD8 to avoid transient unique constraint collisions
UPDATE public.matches
SET goal_api_fixture_id = NULL
WHERE matchday >= 2;

-- 4.2 Update each match in-place with official UEFA 2026/27 fixtures

-- --- MATCHDAY 2 ---
UPDATE public.matches SET
  home_team_id = 'd4ad70d0-ddc4-43f4-8ac4-b6bf8b461c1f',
  away_team_id = '901f904b-2a1e-4c99-a516-4390327ee40d',
  kickoff_at = '2026-10-13T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc05y5p62alc07oclfffo3',
  updated_at = now()
WHERE id = '51baaa90-60d8-42f4-915e-ac80c743d8e1';
UPDATE public.matches SET
  home_team_id = 'f63299c4-fdb4-490d-b511-f4fdab80a694',
  away_team_id = '825775cc-40e7-472a-8984-16d085e9cf0e',
  kickoff_at = '2026-10-13T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc05y7p62clc07afgmnnm0',
  updated_at = now()
WHERE id = '96112161-3ae2-4205-b325-3c2521f2a0b6';
UPDATE public.matches SET
  home_team_id = '4f574dd9-aaf6-4fdc-80e0-6ad22addb2e1',
  away_team_id = '90476e81-c794-416e-b6df-9c6a7adc97d7',
  kickoff_at = '2026-10-13T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc05y1p628lc07t60yd4h4',
  updated_at = now()
WHERE id = '4af84300-8cb0-46e6-8aca-0a866d0febfb';
UPDATE public.matches SET
  home_team_id = '825358c9-d449-4828-842e-2770e7d167c1',
  away_team_id = '83916c7e-bcb1-4def-9fcb-7b633b6012a1',
  kickoff_at = '2026-10-13T16:45:00.000Z',
  goal_api_fixture_id = 'cmtyc04mwp5p7lc07b40fppwu',
  updated_at = now()
WHERE id = '22ff0b8e-70de-472c-b5e9-d21364be3b2e';
UPDATE public.matches SET
  home_team_id = '4d9de743-bcc5-48a0-a211-6976385819b3',
  away_team_id = 'fb90ae34-9fe1-449a-ac2f-44b23910ba87',
  kickoff_at = '2026-10-13T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc05yhp62elc07qb86im71',
  updated_at = now()
WHERE id = 'a80c5770-219b-4189-b6be-2dc023f8799e';
UPDATE public.matches SET
  home_team_id = 'b2cf7177-8c4d-420d-9fa5-e2e23a16dddf',
  away_team_id = '64213a3d-f51d-4875-9ff8-138d98edfe76',
  kickoff_at = '2026-10-13T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc05lkp5zylc07ygt2bq98',
  updated_at = now()
WHERE id = '419cc70c-74f9-4223-9e49-6dbc963cb7cd';
UPDATE public.matches SET
  home_team_id = 'af51bc53-aeef-47af-832b-4084bd24def1',
  away_team_id = 'd06521d2-d018-48c2-9764-c7b86351ecf1',
  kickoff_at = '2026-10-13T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc05yjp62glc076kjsq4p4',
  updated_at = now()
WHERE id = 'b5c3f677-ef49-42ed-9a39-493a54c18214';
UPDATE public.matches SET
  home_team_id = 'dd72836a-9810-44d9-9954-64f6be016a01',
  away_team_id = 'cd05d490-a2f7-4a44-b244-9376024a3c01',
  kickoff_at = '2026-10-13T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc05ykp62ilc078e6c4ysd',
  updated_at = now()
WHERE id = 'b62519fb-0265-4138-b856-b5afc18566bc';
UPDATE public.matches SET
  home_team_id = '59f4846b-da90-40de-9b3b-dcb8736dc340',
  away_team_id = 'fd16f937-dea5-4ec1-bfd0-a76ff7c67946',
  kickoff_at = '2026-10-13T16:45:00.000Z',
  goal_api_fixture_id = 'cmtyc04n1p5p9lc071lvsblfz',
  updated_at = now()
WHERE id = '2dce7985-fab9-4d90-8a30-9c2b563e2976';
UPDATE public.matches SET
  home_team_id = '6b9042c4-c884-4e01-be2f-55ef6d4b6d47',
  away_team_id = '36b703cb-18e3-41ba-aa72-78ec77fb083f',
  kickoff_at = '2026-10-14T16:45:00.000Z',
  goal_api_fixture_id = 'cmtyc06vmp6colc073qldx86z',
  updated_at = now()
WHERE id = '0ead5349-3965-4471-8b44-add844fc17df';
UPDATE public.matches SET
  home_team_id = 'c57b0571-f220-4ee0-a9d9-a4c59178123f',
  away_team_id = '82243f99-d076-4bef-ba35-1041b1df8962',
  kickoff_at = '2026-10-14T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc06wpp6dslc07xob3rsq2',
  updated_at = now()
WHERE id = '4b5cf600-df06-43c5-b58f-dbcf1e4f059e';
UPDATE public.matches SET
  home_team_id = '7147accf-d286-41e4-8cd8-67c21114d616',
  away_team_id = '6fa5b301-09ce-40e2-bfac-f5be74cd9954',
  kickoff_at = '2026-10-14T16:45:00.000Z',
  goal_api_fixture_id = 'cmtyc06vop6cqlc077xdkep3r',
  updated_at = now()
WHERE id = '0f4cd708-3418-45f9-b82f-31098e2e5819';
UPDATE public.matches SET
  home_team_id = '88962b81-08d9-442e-ad26-dafef97bf900',
  away_team_id = '98a148cb-3a8b-4f4e-8287-c7e3218dfb0c',
  kickoff_at = '2026-10-14T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc06y4p6dwlc0756hcazma',
  updated_at = now()
WHERE id = '4fdccc0f-3aa2-434e-ae82-e1bc0b2d9357';
UPDATE public.matches SET
  home_team_id = '1fc30e28-7895-46d0-847d-108d127f6af7',
  away_team_id = 'a8b8b41a-b476-4c52-8707-7eafe4ed6990',
  kickoff_at = '2026-10-14T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc06yap6e2lc07hglscpt7',
  updated_at = now()
WHERE id = '9a453866-1198-43d5-8cf4-1142e33b89bb';
UPDATE public.matches SET
  home_team_id = '95eac571-737e-4365-8a7f-791c7412dc19',
  away_team_id = '1ab3fe88-b979-4eea-b6cb-7c916670ba11',
  kickoff_at = '2026-10-14T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc06y6p6dylc07izeb1l4t',
  updated_at = now()
WHERE id = '55fe2a7b-d6d7-4b96-8590-e034960e47d4';
UPDATE public.matches SET
  home_team_id = 'da295cbf-4cdd-4410-aa26-f76ca2e90f9f',
  away_team_id = 'ba72f4a6-3dd9-4e96-a4db-cae35cb5b517',
  kickoff_at = '2026-10-14T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc06y2p6dulc07q7qgj798',
  updated_at = now()
WHERE id = '4cc1bf23-2029-4c2e-9391-923ffe6a109b';
UPDATE public.matches SET
  home_team_id = '14ebae97-3a80-4690-b4a0-1372e8a27d2d',
  away_team_id = '17a6e795-3c71-4c01-853a-e7cc5c2075c0',
  kickoff_at = '2026-10-14T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc06ycp6e4lc07csvq80al',
  updated_at = now()
WHERE id = 'd54e67ec-d7cc-4c2a-993d-8330318ababb';
UPDATE public.matches SET
  home_team_id = 'a7e34254-30a6-49ab-8944-87f044e4c672',
  away_team_id = '826d0e69-2c66-4d3b-9544-36e6a25118ea',
  kickoff_at = '2026-10-14T19:00:00.000Z',
  goal_api_fixture_id = 'cmtyc06y8p6e0lc07d2ilxx4s',
  updated_at = now()
WHERE id = '6a047038-47ed-4052-9a56-4c121174ffa7';

-- --- MATCHDAY 3 ---
UPDATE public.matches SET
  home_team_id = 'cd05d490-a2f7-4a44-b244-9376024a3c01',
  away_team_id = '95eac571-737e-4365-8a7f-791c7412dc19',
  kickoff_at = '2026-10-20T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fb5dnqmyqu076urnf5kq',
  updated_at = now()
WHERE id = 'ba2397ad-c640-4909-b269-faf9185da1d9';
UPDATE public.matches SET
  home_team_id = 'c57b0571-f220-4ee0-a9d9-a4c59178123f',
  away_team_id = '14ebae97-3a80-4690-b4a0-1372e8a27d2d',
  kickoff_at = '2026-10-20T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fb4unqmpqu0719tyak4h',
  updated_at = now()
WHERE id = '0cb2c719-5c08-4e7a-b46a-3f104db9240e';
UPDATE public.matches SET
  home_team_id = '826d0e69-2c66-4d3b-9544-36e6a25118ea',
  away_team_id = '901f904b-2a1e-4c99-a516-4390327ee40d',
  kickoff_at = '2026-10-20T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fb5fnqn0qu07dxyxhsqd',
  updated_at = now()
WHERE id = 'bcc74a73-4e04-4d79-91f5-c27eb0422fd0';
UPDATE public.matches SET
  home_team_id = 'a7e34254-30a6-49ab-8944-87f044e4c672',
  away_team_id = 'a8b8b41a-b476-4c52-8707-7eafe4ed6990',
  kickoff_at = '2026-10-20T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fb5bnqmwqu0769bc8xyg',
  updated_at = now()
WHERE id = '9be4515e-ef3a-4ad0-a952-06e4722b8182';
UPDATE public.matches SET
  home_team_id = '17a6e795-3c71-4c01-853a-e7cc5c2075c0',
  away_team_id = '4f574dd9-aaf6-4fdc-80e0-6ad22addb2e1',
  kickoff_at = '2026-10-20T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fb5hnqn2qu07yxql62h1',
  updated_at = now()
WHERE id = 'fba1f4ae-6275-4ae3-9d21-6af86303b6a1';
UPDATE public.matches SET
  home_team_id = '98a148cb-3a8b-4f4e-8287-c7e3218dfb0c',
  away_team_id = 'fb90ae34-9fe1-449a-ac2f-44b23910ba87',
  kickoff_at = '2026-10-20T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fb4ynqmrqu070uubxs8s',
  updated_at = now()
WHERE id = '7d607e33-f9c6-46a0-95fb-58fbc41d08d5';
UPDATE public.matches SET
  home_team_id = '6fa5b301-09ce-40e2-bfac-f5be74cd9954',
  away_team_id = 'dd72836a-9810-44d9-9954-64f6be016a01',
  kickoff_at = '2026-10-20T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fb5anqmuqu07toz7n9f1',
  updated_at = now()
WHERE id = '861db59d-95cc-477f-b6c4-a5dae09b86ed';
UPDATE public.matches SET
  home_team_id = 'ba72f4a6-3dd9-4e96-a4db-cae35cb5b517',
  away_team_id = 'fd16f937-dea5-4ec1-bfd0-a76ff7c67946',
  kickoff_at = '2026-10-20T16:45:00.000Z',
  goal_api_fixture_id = 'cmu74fa84nqczqu07gims6288',
  updated_at = now()
WHERE id = '0df314d2-4a28-40f1-85c6-c7a4521de73e';
UPDATE public.matches SET
  home_team_id = '59f4846b-da90-40de-9b3b-dcb8736dc340',
  away_team_id = '1ab3fe88-b979-4eea-b6cb-7c916670ba11',
  kickoff_at = '2026-10-20T16:45:00.000Z',
  goal_api_fixture_id = 'cmu74fa85nqd1qu07fm6g0hzu',
  updated_at = now()
WHERE id = '15b3ffef-3d3e-4827-8e2f-e1c29e8864be';
UPDATE public.matches SET
  home_team_id = '64213a3d-f51d-4875-9ff8-138d98edfe76',
  away_team_id = 'd4ad70d0-ddc4-43f4-8ac4-b6bf8b461c1f',
  kickoff_at = '2026-10-21T16:45:00.000Z',
  goal_api_fixture_id = 'cmu74fc24nqx8qu07y1m0mfw4',
  updated_at = now()
WHERE id = '4a9757f5-729c-4364-becf-cff826a0c530';
UPDATE public.matches SET
  home_team_id = '88962b81-08d9-442e-ad26-dafef97bf900',
  away_team_id = '6b9042c4-c884-4e01-be2f-55ef6d4b6d47',
  kickoff_at = '2026-10-21T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fcfrnr2pqu07tng6xsia',
  updated_at = now()
WHERE id = '9fd6a9c9-a4c8-4d7c-b845-59ec18395f50';
UPDATE public.matches SET
  home_team_id = 'f63299c4-fdb4-490d-b511-f4fdab80a694',
  away_team_id = '1fc30e28-7895-46d0-847d-108d127f6af7',
  kickoff_at = '2026-10-21T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fcfwnr2tqu07zjqr4vmw',
  updated_at = now()
WHERE id = 'cf47822a-8a6f-4116-9f55-2eda0991b06f';
UPDATE public.matches SET
  home_team_id = '36b703cb-18e3-41ba-aa72-78ec77fb083f',
  away_team_id = '90476e81-c794-416e-b6df-9c6a7adc97d7',
  kickoff_at = '2026-10-21T16:45:00.000Z',
  goal_api_fixture_id = 'cmu74fc22nqx6qu07ieaxtwjh',
  updated_at = now()
WHERE id = '45e9eda8-228d-45d5-aa4f-8264222ae67c';
UPDATE public.matches SET
  home_team_id = 'da295cbf-4cdd-4410-aa26-f76ca2e90f9f',
  away_team_id = 'af51bc53-aeef-47af-832b-4084bd24def1',
  kickoff_at = '2026-10-21T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fcfonr2lqu07lcc2isbp',
  updated_at = now()
WHERE id = '59230255-5779-41f1-8eb9-9bd13f88f13c';
UPDATE public.matches SET
  home_team_id = '83916c7e-bcb1-4def-9fcb-7b633b6012a1',
  away_team_id = '7147accf-d286-41e4-8cd8-67c21114d616',
  kickoff_at = '2026-10-21T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fcfznr2xqu07fwezzqzf',
  updated_at = now()
WHERE id = 'e54066d4-177d-48ad-b478-e381c3b15652';
UPDATE public.matches SET
  home_team_id = 'd06521d2-d018-48c2-9764-c7b86351ecf1',
  away_team_id = 'b2cf7177-8c4d-420d-9fa5-e2e23a16dddf',
  kickoff_at = '2026-10-21T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fcfqnr2nqu07r5jkis7b',
  updated_at = now()
WHERE id = '792aed30-0ae9-4e4e-b2b1-d179e8c509b1';
UPDATE public.matches SET
  home_team_id = '82243f99-d076-4bef-ba35-1041b1df8962',
  away_team_id = '4d9de743-bcc5-48a0-a211-6976385819b3',
  kickoff_at = '2026-10-21T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fcfynr2vqu077qb814pe',
  updated_at = now()
WHERE id = 'd396bc1b-02c5-485f-8e28-b759a82a1f24';
UPDATE public.matches SET
  home_team_id = '825775cc-40e7-472a-8984-16d085e9cf0e',
  away_team_id = '825358c9-d449-4828-842e-2770e7d167c1',
  kickoff_at = '2026-10-21T19:00:00.000Z',
  goal_api_fixture_id = 'cmu74fcfunr2rqu07bghunefu',
  updated_at = now()
WHERE id = 'a17961ab-f974-464b-9307-c2da13ba33af';

-- --- MATCHDAY 4 ---
UPDATE public.matches SET
  home_team_id = '95eac571-737e-4365-8a7f-791c7412dc19',
  away_team_id = '64213a3d-f51d-4875-9ff8-138d98edfe76',
  kickoff_at = '2026-11-03T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74gzc5o9oiqu07f1sa945n',
  updated_at = now()
WHERE id = '7e4693d3-0dd6-4e33-8e7d-4e8684179522';
UPDATE public.matches SET
  home_team_id = '6b9042c4-c884-4e01-be2f-55ef6d4b6d47',
  away_team_id = 'f63299c4-fdb4-490d-b511-f4fdab80a694',
  kickoff_at = '2026-11-03T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74gzc8o9okqu076xtfgzis',
  updated_at = now()
WHERE id = '9a95eb6d-e1ca-4ad4-9ee6-617215faf961';
UPDATE public.matches SET
  home_team_id = 'dd72836a-9810-44d9-9954-64f6be016a01',
  away_team_id = '826d0e69-2c66-4d3b-9544-36e6a25118ea',
  kickoff_at = '2026-11-03T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74gzceo9oqqu07gnjcjwzi',
  updated_at = now()
WHERE id = 'f563b2eb-c123-4381-833c-9d6146c4f2a3';
UPDATE public.matches SET
  home_team_id = '7147accf-d286-41e4-8cd8-67c21114d616',
  away_team_id = '14ebae97-3a80-4690-b4a0-1372e8a27d2d',
  kickoff_at = '2026-11-03T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74gzcao9omqu079y8ljgfr',
  updated_at = now()
WHERE id = 'c65ee379-5a2b-40a1-95f2-26c81b6e82cf';
UPDATE public.matches SET
  home_team_id = '901f904b-2a1e-4c99-a516-4390327ee40d',
  away_team_id = 'da295cbf-4cdd-4410-aa26-f76ca2e90f9f',
  kickoff_at = '2026-11-03T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74gzc4o9ogqu07s03h6how',
  updated_at = now()
WHERE id = '64db1003-aad5-496f-84ec-7a44cc37931e';
UPDATE public.matches SET
  home_team_id = '4f574dd9-aaf6-4fdc-80e0-6ad22addb2e1',
  away_team_id = 'd06521d2-d018-48c2-9764-c7b86351ecf1',
  kickoff_at = '2026-11-03T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74gzc1o9oequ07vp8ttqay',
  updated_at = now()
WHERE id = '2d4fa87a-4de3-4783-a9e7-ee72bf43bf71';
UPDATE public.matches SET
  home_team_id = 'd4ad70d0-ddc4-43f4-8ac4-b6bf8b461c1f',
  away_team_id = '17a6e795-3c71-4c01-853a-e7cc5c2075c0',
  kickoff_at = '2026-11-03T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74gz5to9mcqu07p5xr20o3',
  updated_at = now()
WHERE id = '1f04e468-3190-49d6-8111-54e54f806bca';
UPDATE public.matches SET
  home_team_id = '1fc30e28-7895-46d0-847d-108d127f6af7',
  away_team_id = '83916c7e-bcb1-4def-9fcb-7b633b6012a1',
  kickoff_at = '2026-11-03T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74gz5wo9mequ070dzfbwat',
  updated_at = now()
WHERE id = '27b2602c-7cff-4a6b-8867-3fb1db416d6a';
UPDATE public.matches SET
  home_team_id = '90476e81-c794-416e-b6df-9c6a7adc97d7',
  away_team_id = 'c57b0571-f220-4ee0-a9d9-a4c59178123f',
  kickoff_at = '2026-11-03T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74gzcco9ooqu079r5ke2cy',
  updated_at = now()
WHERE id = 'eec5ec39-0c41-4750-83e9-b5f6cdd45b71';
UPDATE public.matches SET
  home_team_id = '825358c9-d449-4828-842e-2770e7d167c1',
  away_team_id = '36b703cb-18e3-41ba-aa72-78ec77fb083f',
  kickoff_at = '2026-11-04T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74h09so9y1qu07tb55m5ux',
  updated_at = now()
WHERE id = '9aafb8a6-04ef-4f78-b56b-0f50b8a27493';
UPDATE public.matches SET
  home_team_id = 'af51bc53-aeef-47af-832b-4084bd24def1',
  away_team_id = '59f4846b-da90-40de-9b3b-dcb8736dc340',
  kickoff_at = '2026-11-04T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74h0kgoa0gqu07jimz0ytp',
  updated_at = now()
WHERE id = 'ff6d44f4-6795-40a5-9e15-de899d694326';
UPDATE public.matches SET
  home_team_id = 'fb90ae34-9fe1-449a-ac2f-44b23910ba87',
  away_team_id = '825775cc-40e7-472a-8984-16d085e9cf0e',
  kickoff_at = '2026-11-04T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74h0jtoa0aqu07o0yobrk7',
  updated_at = now()
WHERE id = 'bb56a087-b249-49db-9066-a5ec6a80a7a4';
UPDATE public.matches SET
  home_team_id = '4d9de743-bcc5-48a0-a211-6976385819b3',
  away_team_id = 'a7e34254-30a6-49ab-8944-87f044e4c672',
  kickoff_at = '2026-11-04T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74h0jwoa0cqu07v7c5l1nd',
  updated_at = now()
WHERE id = 'cba0c5f2-ebb4-42b5-a0ac-67f33e42beb8';
UPDATE public.matches SET
  home_team_id = '98a148cb-3a8b-4f4e-8287-c7e3218dfb0c',
  away_team_id = 'cd05d490-a2f7-4a44-b244-9376024a3c01',
  kickoff_at = '2026-11-04T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74h09qo9xzqu07m33u9iar',
  updated_at = now()
WHERE id = '77c5af2b-3855-45d5-9b1e-b5f24a55fc36';
UPDATE public.matches SET
  home_team_id = 'ba72f4a6-3dd9-4e96-a4db-cae35cb5b517',
  away_team_id = '6fa5b301-09ce-40e2-bfac-f5be74cd9954',
  kickoff_at = '2026-11-04T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74h08vo9xfqu078qm36p2n',
  updated_at = now()
WHERE id = '2bf4c124-87d9-45dc-b0a5-86154c36cf92';
UPDATE public.matches SET
  home_team_id = 'a8b8b41a-b476-4c52-8707-7eafe4ed6990',
  away_team_id = '82243f99-d076-4bef-ba35-1041b1df8962',
  kickoff_at = '2026-11-04T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74h08so9xdqu07g4xffhvv',
  updated_at = now()
WHERE id = '12a813a4-c831-43f0-a5c2-f1bd3f6a8b41';
UPDATE public.matches SET
  home_team_id = 'fd16f937-dea5-4ec1-bfd0-a76ff7c67946',
  away_team_id = 'b2cf7177-8c4d-420d-9fa5-e2e23a16dddf',
  kickoff_at = '2026-11-04T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74h0jzoa0equ070ao3b0wu',
  updated_at = now()
WHERE id = 'f2106bdf-e6ec-451e-b49b-5aa0da7a4db6';
UPDATE public.matches SET
  home_team_id = '1ab3fe88-b979-4eea-b6cb-7c916670ba11',
  away_team_id = '88962b81-08d9-442e-ad26-dafef97bf900',
  kickoff_at = '2026-11-04T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74h09no9xxqu071offkwws',
  updated_at = now()
WHERE id = '631b6818-a7c7-4e6b-a2f2-1df095825008';

-- --- MATCHDAY 5 ---
UPDATE public.matches SET
  home_team_id = '4d9de743-bcc5-48a0-a211-6976385819b3',
  away_team_id = '825358c9-d449-4828-842e-2770e7d167c1',
  kickoff_at = '2026-11-24T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74isuoounfqu07ogcj63dr',
  updated_at = now()
WHERE id = 'c94585f9-8011-468f-8b13-a4cbb9971fa0';
UPDATE public.matches SET
  home_team_id = 'a7e34254-30a6-49ab-8944-87f044e4c672',
  away_team_id = 'cd05d490-a2f7-4a44-b244-9376024a3c01',
  kickoff_at = '2026-11-24T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74isuloundqu07k5rs43jb',
  updated_at = now()
WHERE id = 'ae933595-3a75-46a2-9e87-1a3f6117752e';
UPDATE public.matches SET
  home_team_id = '14ebae97-3a80-4690-b4a0-1372e8a27d2d',
  away_team_id = '88962b81-08d9-442e-ad26-dafef97bf900',
  kickoff_at = '2026-11-24T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74isuuounjqu07gccoa1ww',
  updated_at = now()
WHERE id = 'f90bc82b-1f71-40e3-a0dc-938e52665c60';
UPDATE public.matches SET
  home_team_id = '95eac571-737e-4365-8a7f-791c7412dc19',
  away_team_id = '7147accf-d286-41e4-8cd8-67c21114d616',
  kickoff_at = '2026-11-24T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74is45oughqu075q4jgl9a',
  updated_at = now()
WHERE id = '3f919c0c-d815-46b6-b27a-b84fe9c714bb';
UPDATE public.matches SET
  home_team_id = '6b9042c4-c884-4e01-be2f-55ef6d4b6d47',
  away_team_id = '98a148cb-3a8b-4f4e-8287-c7e3218dfb0c',
  kickoff_at = '2026-11-24T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74isuiounbqu070p68644a',
  updated_at = now()
WHERE id = 'a2d77aa2-1bc6-41ad-95d9-4f4363ac5172';
UPDATE public.matches SET
  home_team_id = 'd4ad70d0-ddc4-43f4-8ac4-b6bf8b461c1f',
  away_team_id = 'da295cbf-4cdd-4410-aa26-f76ca2e90f9f',
  kickoff_at = '2026-11-24T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74is49ougjqu07wg5y84oo',
  updated_at = now()
WHERE id = '40b6c9a0-7365-4d0c-8a5c-2cd05ba57b6b';
UPDATE public.matches SET
  home_team_id = 'b2cf7177-8c4d-420d-9fa5-e2e23a16dddf',
  away_team_id = '1ab3fe88-b979-4eea-b6cb-7c916670ba11',
  kickoff_at = '2026-11-24T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74isudoun7qu070q41fcwt',
  updated_at = now()
WHERE id = '6e0748ca-ed40-45cb-9669-75920480a5b6';
UPDATE public.matches SET
  home_team_id = '36b703cb-18e3-41ba-aa72-78ec77fb083f',
  away_team_id = 'a8b8b41a-b476-4c52-8707-7eafe4ed6990',
  kickoff_at = '2026-11-24T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74isufoun9qu07jsynguwq',
  updated_at = now()
WHERE id = '761edc1e-c3d3-4ba3-8d1f-92ac2b00b524';
UPDATE public.matches SET
  home_team_id = '82243f99-d076-4bef-ba35-1041b1df8962',
  away_team_id = 'fb90ae34-9fe1-449a-ac2f-44b23910ba87',
  kickoff_at = '2026-11-24T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74isurounhqu07019uueew',
  updated_at = now()
WHERE id = 'de8132ed-4b5c-455d-85cf-b7bd27c75962';
UPDATE public.matches SET
  home_team_id = '64213a3d-f51d-4875-9ff8-138d98edfe76',
  away_team_id = 'd06521d2-d018-48c2-9764-c7b86351ecf1',
  kickoff_at = '2026-11-25T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74itu6ouyzqu07u88q615u',
  updated_at = now()
WHERE id = 'b10585b2-b9e9-4e37-8397-59a436f3317a';
UPDATE public.matches SET
  home_team_id = 'fd16f937-dea5-4ec1-bfd0-a76ff7c67946',
  away_team_id = 'dd72836a-9810-44d9-9954-64f6be016a01',
  kickoff_at = '2026-11-25T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74itsdouy5qu07aigkcwun',
  updated_at = now()
WHERE id = '76b93988-38d1-426d-9301-437df7511249';
UPDATE public.matches SET
  home_team_id = '4f574dd9-aaf6-4fdc-80e0-6ad22addb2e1',
  away_team_id = 'af51bc53-aeef-47af-832b-4084bd24def1',
  kickoff_at = '2026-11-25T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74ittxouytqu07z6fva3um',
  updated_at = now()
WHERE id = '8d869826-81e6-4d10-bb4a-25757f4d33fd';
UPDATE public.matches SET
  home_team_id = '59f4846b-da90-40de-9b3b-dcb8736dc340',
  away_team_id = '901f904b-2a1e-4c99-a516-4390327ee40d',
  kickoff_at = '2026-11-25T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74itsbouy3qu07zk77h47o',
  updated_at = now()
WHERE id = '241250e3-9cc9-4c9b-adc2-357ef9718376';
UPDATE public.matches SET
  home_team_id = 'f63299c4-fdb4-490d-b511-f4fdab80a694',
  away_team_id = '17a6e795-3c71-4c01-853a-e7cc5c2075c0',
  kickoff_at = '2026-11-25T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74itu4ouyxqu075mdc6acn',
  updated_at = now()
WHERE id = '9a515024-c7be-4720-aec5-ee0a3a3bd768';
UPDATE public.matches SET
  home_team_id = '826d0e69-2c66-4d3b-9544-36e6a25118ea',
  away_team_id = 'c57b0571-f220-4ee0-a9d9-a4c59178123f',
  kickoff_at = '2026-11-25T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74ituaouz1qu07jpzhz8ft',
  updated_at = now()
WHERE id = 'd72b98f2-38d6-4425-835f-efca8db8cf01';
UPDATE public.matches SET
  home_team_id = '825775cc-40e7-472a-8984-16d085e9cf0e',
  away_team_id = '6fa5b301-09ce-40e2-bfac-f5be74cd9954',
  kickoff_at = '2026-11-25T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74itu0ouyvqu073jiy6drd',
  updated_at = now()
WHERE id = '957aee7d-ee49-403c-8420-d49954cc05f0';
UPDATE public.matches SET
  home_team_id = '83916c7e-bcb1-4def-9fcb-7b633b6012a1',
  away_team_id = '90476e81-c794-416e-b6df-9c6a7adc97d7',
  kickoff_at = '2026-11-25T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74itueouz5qu078epmmjcj',
  updated_at = now()
WHERE id = 'f518bbb9-9e49-4bf9-9cab-f577a013620e';
UPDATE public.matches SET
  home_team_id = '1fc30e28-7895-46d0-847d-108d127f6af7',
  away_team_id = 'ba72f4a6-3dd9-4e96-a4db-cae35cb5b517',
  kickoff_at = '2026-11-25T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74itucouz3qu076q5w2tuo',
  updated_at = now()
WHERE id = 'f099d2fb-0848-4fff-bc70-189a38664d56';

-- --- MATCHDAY 6 ---
UPDATE public.matches SET
  home_team_id = '901f904b-2a1e-4c99-a516-4390327ee40d',
  away_team_id = 'a7e34254-30a6-49ab-8944-87f044e4c672',
  kickoff_at = '2026-12-08T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jy63p7k4qu07dffzq2bj',
  updated_at = now()
WHERE id = '6f9034d8-4f58-4751-a4e5-5be259668caf';
UPDATE public.matches SET
  home_team_id = 'd06521d2-d018-48c2-9764-c7b86351ecf1',
  away_team_id = 'fd16f937-dea5-4ec1-bfd0-a76ff7c67946',
  kickoff_at = '2026-12-08T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jy65p7k6qu07gs2rjmy2',
  updated_at = now()
WHERE id = '89ffadff-29d6-4443-a12b-0d14e2e0ffc3';
UPDATE public.matches SET
  home_team_id = 'cd05d490-a2f7-4a44-b244-9376024a3c01',
  away_team_id = '825775cc-40e7-472a-8984-16d085e9cf0e',
  kickoff_at = '2026-12-08T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jy69p7kaqu07f7u1ewkr',
  updated_at = now()
WHERE id = 'e1fc1233-d93e-4202-933d-a00a64924bc6';
UPDATE public.matches SET
  home_team_id = '90476e81-c794-416e-b6df-9c6a7adc97d7',
  away_team_id = '4d9de743-bcc5-48a0-a211-6976385819b3',
  kickoff_at = '2026-12-08T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jy66p7k8qu07i3sfqyuz',
  updated_at = now()
WHERE id = 'c5a59059-365d-4a5a-a444-6bc7b325c252';
UPDATE public.matches SET
  home_team_id = 'da295cbf-4cdd-4410-aa26-f76ca2e90f9f',
  away_team_id = '826d0e69-2c66-4d3b-9544-36e6a25118ea',
  kickoff_at = '2026-12-08T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jy61p7k2qu07y9pcpq06',
  updated_at = now()
WHERE id = '8ed3e3f2-9ede-4e07-9a89-c27b28af7add';
UPDATE public.matches SET
  home_team_id = 'dd72836a-9810-44d9-9954-64f6be016a01',
  away_team_id = '59f4846b-da90-40de-9b3b-dcb8736dc340',
  kickoff_at = '2026-12-08T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74jxqip7faqu07ckbckhof',
  updated_at = now()
WHERE id = '31d0adca-228e-4565-bf4c-5411047cd094';
UPDATE public.matches SET
  home_team_id = 'af51bc53-aeef-47af-832b-4084bd24def1',
  away_team_id = '6b9042c4-c884-4e01-be2f-55ef6d4b6d47',
  kickoff_at = '2026-12-08T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74jxqgp7f8qu07ruo20w4i',
  updated_at = now()
WHERE id = '137379a0-3848-4f15-a9b1-8e972dc7d12a';
UPDATE public.matches SET
  home_team_id = 'a8b8b41a-b476-4c52-8707-7eafe4ed6990',
  away_team_id = 'd4ad70d0-ddc4-43f4-8ac4-b6bf8b461c1f',
  kickoff_at = '2026-12-08T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jy4np7jyqu079v1ws7sz',
  updated_at = now()
WHERE id = '46b16615-fd31-452f-90b6-bf7c3b39f083';
UPDATE public.matches SET
  home_team_id = 'c57b0571-f220-4ee0-a9d9-a4c59178123f',
  away_team_id = '83916c7e-bcb1-4def-9fcb-7b633b6012a1',
  kickoff_at = '2026-12-08T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jy4op7k0qu07g76bqedj',
  updated_at = now()
WHERE id = '55568073-ada2-417d-b28f-d4c1e7c1427f';
UPDATE public.matches SET
  home_team_id = '88962b81-08d9-442e-ad26-dafef97bf900',
  away_team_id = '36b703cb-18e3-41ba-aa72-78ec77fb083f',
  kickoff_at = '2026-12-09T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74jyv7p7rxqu07o72rf27r',
  updated_at = now()
WHERE id = '499da69d-8747-4904-95aa-50f388cbc3e8';
UPDATE public.matches SET
  home_team_id = '825358c9-d449-4828-842e-2770e7d167c1',
  away_team_id = '95eac571-737e-4365-8a7f-791c7412dc19',
  kickoff_at = '2026-12-09T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jywcp7t5qu071dybcafb',
  updated_at = now()
WHERE id = 'e3d45af3-22ac-449f-adfc-20c824fe24ad';
UPDATE public.matches SET
  home_team_id = '1ab3fe88-b979-4eea-b6cb-7c916670ba11',
  away_team_id = 'f63299c4-fdb4-490d-b511-f4fdab80a694',
  kickoff_at = '2026-12-09T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jyw8p7t1qu07ypz40c6c',
  updated_at = now()
WHERE id = 'b1dca9af-fe84-4c55-a1d3-168ac5afab04';
UPDATE public.matches SET
  home_team_id = '6fa5b301-09ce-40e2-bfac-f5be74cd9954',
  away_team_id = '98a148cb-3a8b-4f4e-8287-c7e3218dfb0c',
  kickoff_at = '2026-12-09T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jywep7t7qu07or4i181n',
  updated_at = now()
WHERE id = 'e82f0158-8907-490a-bbe9-ede15ce231ef';
UPDATE public.matches SET
  home_team_id = '14ebae97-3a80-4690-b4a0-1372e8a27d2d',
  away_team_id = '1fc30e28-7895-46d0-847d-108d127f6af7',
  kickoff_at = '2026-12-09T17:45:00.000Z',
  goal_api_fixture_id = 'cmu74jyv9p7rzqu07zfdl1pi5',
  updated_at = now()
WHERE id = 'bf764196-37aa-418e-a049-2bb9b3fd3bdd';
UPDATE public.matches SET
  home_team_id = 'b2cf7177-8c4d-420d-9fa5-e2e23a16dddf',
  away_team_id = '82243f99-d076-4bef-ba35-1041b1df8962',
  kickoff_at = '2026-12-09T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jyw5p7szqu07m4x19lqm',
  updated_at = now()
WHERE id = 'd820bac7-ec3c-40ad-9625-aa1cd63fb094';
UPDATE public.matches SET
  home_team_id = '7147accf-d286-41e4-8cd8-67c21114d616',
  away_team_id = 'ba72f4a6-3dd9-4e96-a4db-cae35cb5b517',
  kickoff_at = '2026-12-09T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jywap7t3qu07ajok4qg2',
  updated_at = now()
WHERE id = 'e20216a3-f4b0-436a-a1bf-4a9c74b9bc7d';
UPDATE public.matches SET
  home_team_id = '17a6e795-3c71-4c01-853a-e7cc5c2075c0',
  away_team_id = '64213a3d-f51d-4875-9ff8-138d98edfe76',
  kickoff_at = '2026-12-09T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jyxtp7tbqu07fmw2xms9',
  updated_at = now()
WHERE id = 'fc3e136b-5b4a-4e87-beef-9661d4aa6bf4';
UPDATE public.matches SET
  home_team_id = 'fb90ae34-9fe1-449a-ac2f-44b23910ba87',
  away_team_id = '4f574dd9-aaf6-4fdc-80e0-6ad22addb2e1',
  kickoff_at = '2026-12-09T20:00:00.000Z',
  goal_api_fixture_id = 'cmu74jywfp7t9qu07e21qlbya',
  updated_at = now()
WHERE id = 'e91f98c1-4942-4c0e-85ca-59fad77bf77b';

-- --- MATCHDAY 7 ---
UPDATE public.matches SET
  home_team_id = '17a6e795-3c71-4c01-853a-e7cc5c2075c0',
  away_team_id = '825775cc-40e7-472a-8984-16d085e9cf0e',
  kickoff_at = '2027-01-19T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75km5p4mkdkm08sb0bq511',
  updated_at = now()
WHERE id = 'f3325a3f-bc79-440b-ac46-ebc627df7834';
UPDATE public.matches SET
  home_team_id = '98a148cb-3a8b-4f4e-8287-c7e3218dfb0c',
  away_team_id = 'fd16f937-dea5-4ec1-bfd0-a76ff7c67946',
  kickoff_at = '2027-01-19T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75km474mk5km08gzr49v72',
  updated_at = now()
WHERE id = '51759c18-b210-4d70-a131-1015bcd19f71';
UPDATE public.matches SET
  home_team_id = '82243f99-d076-4bef-ba35-1041b1df8962',
  away_team_id = '7147accf-d286-41e4-8cd8-67c21114d616',
  kickoff_at = '2027-01-19T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75km5m4mkbkm08lniif7ib',
  updated_at = now()
WHERE id = 'c9ed96b5-b0cb-4dd3-952d-b9206db71854';
UPDATE public.matches SET
  home_team_id = 'd4ad70d0-ddc4-43f4-8ac4-b6bf8b461c1f',
  away_team_id = '6b9042c4-c884-4e01-be2f-55ef6d4b6d47',
  kickoff_at = '2027-01-19T17:45:00.000Z',
  goal_api_fixture_id = 'cmu75km0u4mibkm08u8pwklvk',
  updated_at = now()
WHERE id = '172d8d2d-592c-4caf-ad8d-605e695b4a5a';
UPDATE public.matches SET
  home_team_id = '95eac571-737e-4365-8a7f-791c7412dc19',
  away_team_id = '4f574dd9-aaf6-4fdc-80e0-6ad22addb2e1',
  kickoff_at = '2027-01-19T17:45:00.000Z',
  goal_api_fixture_id = 'cmu75km0s4mi9km08wr2if5zm',
  updated_at = now()
WHERE id = '0746e940-9f06-490f-936b-2cbf74794f3c';
UPDATE public.matches SET
  home_team_id = 'f63299c4-fdb4-490d-b511-f4fdab80a694',
  away_team_id = '6fa5b301-09ce-40e2-bfac-f5be74cd9954',
  kickoff_at = '2027-01-19T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75km494mk7km08ifwwp47v',
  updated_at = now()
WHERE id = '666bfd5f-5302-4bd2-8b09-aa02502b7278';
UPDATE public.matches SET
  home_team_id = 'da295cbf-4cdd-4410-aa26-f76ca2e90f9f',
  away_team_id = '1ab3fe88-b979-4eea-b6cb-7c916670ba11',
  kickoff_at = '2027-01-19T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75km434mk3km08zr6onvk1',
  updated_at = now()
WHERE id = '4ad86539-7ec0-4db6-90da-5da436144942';
UPDATE public.matches SET
  home_team_id = '64213a3d-f51d-4875-9ff8-138d98edfe76',
  away_team_id = '14ebae97-3a80-4690-b4a0-1372e8a27d2d',
  kickoff_at = '2027-01-19T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75km4d4mk9km08b15n9vf0',
  updated_at = now()
WHERE id = '9c9a07fc-3b05-4a7c-87f0-105a941e2567';
UPDATE public.matches SET
  home_team_id = 'a8b8b41a-b476-4c52-8707-7eafe4ed6990',
  away_team_id = 'c57b0571-f220-4ee0-a9d9-a4c59178123f',
  kickoff_at = '2027-01-19T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75km414mk1km08brenpd8b',
  updated_at = now()
WHERE id = '2493c95a-55ba-4cf8-82ad-413408ccd018';
UPDATE public.matches SET
  home_team_id = 'af51bc53-aeef-47af-832b-4084bd24def1',
  away_team_id = 'fb90ae34-9fe1-449a-ac2f-44b23910ba87',
  kickoff_at = '2027-01-20T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kmjl4motkm08kimgwqd4',
  updated_at = now()
WHERE id = 'feb40a97-8533-4c61-897e-dbfcc5cbfc9a';
UPDATE public.matches SET
  home_team_id = '4d9de743-bcc5-48a0-a211-6976385819b3',
  away_team_id = '1fc30e28-7895-46d0-847d-108d127f6af7',
  kickoff_at = '2027-01-20T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kmi24mopkm08fz1015yz',
  updated_at = now()
WHERE id = 'ad196724-72b6-42cb-8f71-4a5ec020833e';
UPDATE public.matches SET
  home_team_id = '59f4846b-da90-40de-9b3b-dcb8736dc340',
  away_team_id = 'cd05d490-a2f7-4a44-b244-9376024a3c01',
  kickoff_at = '2027-01-20T17:45:00.000Z',
  goal_api_fixture_id = 'cmu75kmh84mntkm08fayfikd4',
  updated_at = now()
WHERE id = '5e3e9810-eb65-4c1d-8969-11242f81611e';
UPDATE public.matches SET
  home_team_id = '83916c7e-bcb1-4def-9fcb-7b633b6012a1',
  away_team_id = '901f904b-2a1e-4c99-a516-4390327ee40d',
  kickoff_at = '2027-01-20T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kmi54morkm083w33m35t',
  updated_at = now()
WHERE id = 'b0da4329-cc68-4e88-8e6e-e7dbd66de315';
UPDATE public.matches SET
  home_team_id = '825358c9-d449-4828-842e-2770e7d167c1',
  away_team_id = 'a7e34254-30a6-49ab-8944-87f044e4c672',
  kickoff_at = '2027-01-20T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kmhy4molkm08wm30b9ea',
  updated_at = now()
WHERE id = '9d7fbdc0-d859-4613-a840-771ca63d49b8';
UPDATE public.matches SET
  home_team_id = '90476e81-c794-416e-b6df-9c6a7adc97d7',
  away_team_id = 'd06521d2-d018-48c2-9764-c7b86351ecf1',
  kickoff_at = '2027-01-20T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kmi04monkm0890z97fjq',
  updated_at = now()
WHERE id = '9f647390-fa37-406e-af5f-f8a3bc720f4a';
UPDATE public.matches SET
  home_team_id = '88962b81-08d9-442e-ad26-dafef97bf900',
  away_team_id = 'b2cf7177-8c4d-420d-9fa5-e2e23a16dddf',
  kickoff_at = '2027-01-20T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kmhv4mohkm0825j37woa',
  updated_at = now()
WHERE id = '6b78e520-641d-4ef9-b883-87dc8fc376de';
UPDATE public.matches SET
  home_team_id = '36b703cb-18e3-41ba-aa72-78ec77fb083f',
  away_team_id = '826d0e69-2c66-4d3b-9544-36e6a25118ea',
  kickoff_at = '2027-01-20T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kmhx4mojkm084s3ux11p',
  updated_at = now()
WHERE id = '7ea6fe08-ed16-46bc-98ee-628766ca7ca8';
UPDATE public.matches SET
  home_team_id = 'ba72f4a6-3dd9-4e96-a4db-cae35cb5b517',
  away_team_id = 'dd72836a-9810-44d9-9954-64f6be016a01',
  kickoff_at = '2027-01-20T17:45:00.000Z',
  goal_api_fixture_id = 'cmu75kmh64mnrkm08uw4eq78o',
  updated_at = now()
WHERE id = '31b6305d-51d6-4430-a6ba-3a505ff92aa9';

-- --- MATCHDAY 8 ---
UPDATE public.matches SET
  home_team_id = '826d0e69-2c66-4d3b-9544-36e6a25118ea',
  away_team_id = 'd4ad70d0-ddc4-43f4-8ac4-b6bf8b461c1f',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4l4qskkm08ovgklbtx',
  updated_at = now()
WHERE id = 'ae625c4c-2e62-4a9b-bde0-19dc719451fe';
UPDATE public.matches SET
  home_team_id = 'cd05d490-a2f7-4a44-b244-9376024a3c01',
  away_team_id = 'af51bc53-aeef-47af-832b-4084bd24def1',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4k4qsikm081pwitswh',
  updated_at = now()
WHERE id = 'a9531eec-d46e-428b-9e0a-d03d5dcafdc1';
UPDATE public.matches SET
  home_team_id = '6fa5b301-09ce-40e2-bfac-f5be74cd9954',
  away_team_id = '825358c9-d449-4828-842e-2770e7d167c1',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4g4qsekm08z8ucdjb8',
  updated_at = now()
WHERE id = '9043f265-c799-455a-8656-1319f50852e2';
UPDATE public.matches SET
  home_team_id = 'b2cf7177-8c4d-420d-9fa5-e2e23a16dddf',
  away_team_id = '59f4846b-da90-40de-9b3b-dcb8736dc340',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kytg4qpnkm08uhrz8n45',
  updated_at = now()
WHERE id = '060c0eb3-2611-47a9-b51f-6c4b2324458f';
UPDATE public.matches SET
  home_team_id = '1ab3fe88-b979-4eea-b6cb-7c916670ba11',
  away_team_id = 'a8b8b41a-b476-4c52-8707-7eafe4ed6990',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz2z4qs8km08xzxl5xwp',
  updated_at = now()
WHERE id = '6da7b06f-6b11-457c-8d8a-e111bc0a87e1';
UPDATE public.matches SET
  home_team_id = 'dd72836a-9810-44d9-9954-64f6be016a01',
  away_team_id = '90476e81-c794-416e-b6df-9c6a7adc97d7',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4v4qsukm08x4sag5bj',
  updated_at = now()
WHERE id = 'f1b4165a-bede-4872-b9c1-09ff39c9949a';
UPDATE public.matches SET
  home_team_id = '7147accf-d286-41e4-8cd8-67c21114d616',
  away_team_id = '98a148cb-3a8b-4f4e-8287-c7e3218dfb0c',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4d4qsckm085ol4qey5',
  updated_at = now()
WHERE id = '823d679e-df8a-4d99-9e3f-e4ea0b533f9a';
UPDATE public.matches SET
  home_team_id = '6b9042c4-c884-4e01-be2f-55ef6d4b6d47',
  away_team_id = '4d9de743-bcc5-48a0-a211-6976385819b3',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4b4qsakm08tvjtuvvz',
  updated_at = now()
WHERE id = '776bfe61-dbaf-417e-aae7-66a19571fba5';
UPDATE public.matches SET
  home_team_id = 'a7e34254-30a6-49ab-8944-87f044e4c672',
  away_team_id = '83916c7e-bcb1-4def-9fcb-7b633b6012a1',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4h4qsgkm08xspy5nne',
  updated_at = now()
WHERE id = 'a94f9e8b-510d-4289-a4a9-50f8175b1a44';
UPDATE public.matches SET
  home_team_id = '1fc30e28-7895-46d0-847d-108d127f6af7',
  away_team_id = '82243f99-d076-4bef-ba35-1041b1df8962',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4p4qsokm08ck59cca3',
  updated_at = now()
WHERE id = 'de8654f1-f040-453d-be22-deefeba2b765';
UPDATE public.matches SET
  home_team_id = 'c57b0571-f220-4ee0-a9d9-a4c59178123f',
  away_team_id = '64213a3d-f51d-4875-9ff8-138d98edfe76',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kyth4qppkm08i6j9htqz',
  updated_at = now()
WHERE id = '2928efeb-26c4-4a54-9018-1598ee5087a0';
UPDATE public.matches SET
  home_team_id = '825775cc-40e7-472a-8984-16d085e9cf0e',
  away_team_id = '95eac571-737e-4365-8a7f-791c7412dc19',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz2p4qs6km08f1bzj074',
  updated_at = now()
WHERE id = '6886cca2-2c18-4058-bb6d-fe1ed636d7ab';
UPDATE public.matches SET
  home_team_id = 'fb90ae34-9fe1-449a-ac2f-44b23910ba87',
  away_team_id = '17a6e795-3c71-4c01-853a-e7cc5c2075c0',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4o4qsmkm08ata1g97n',
  updated_at = now()
WHERE id = 'af8350a4-01cb-436b-a8df-3753952ad106';
UPDATE public.matches SET
  home_team_id = '4f574dd9-aaf6-4fdc-80e0-6ad22addb2e1',
  away_team_id = 'ba72f4a6-3dd9-4e96-a4db-cae35cb5b517',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kytk4qprkm08je5vxypl',
  updated_at = now()
WHERE id = '4a1fcbcf-2e25-4262-b66a-aa5ca344bf6c';
UPDATE public.matches SET
  home_team_id = '901f904b-2a1e-4c99-a516-4390327ee40d',
  away_team_id = '36b703cb-18e3-41ba-aa72-78ec77fb083f',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz2l4qs2km083umone02',
  updated_at = now()
WHERE id = '54f9b8f7-0c71-4518-806a-f484e001e8ce';
UPDATE public.matches SET
  home_team_id = 'fd16f937-dea5-4ec1-bfd0-a76ff7c67946',
  away_team_id = 'da295cbf-4cdd-4410-aa26-f76ca2e90f9f',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4s4qsqkm0821gwn1mq',
  updated_at = now()
WHERE id = 'eb2524cc-feb8-4f47-a3fa-429e0d60d2fa';
UPDATE public.matches SET
  home_team_id = '14ebae97-3a80-4690-b4a0-1372e8a27d2d',
  away_team_id = 'f63299c4-fdb4-490d-b511-f4fdab80a694',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz4t4qsskm08ibcrtzxd',
  updated_at = now()
WHERE id = 'eff613f2-b415-49aa-a18f-4852b74c5005';
UPDATE public.matches SET
  home_team_id = 'd06521d2-d018-48c2-9764-c7b86351ecf1',
  away_team_id = '88962b81-08d9-442e-ad26-dafef97bf900',
  kickoff_at = '2027-01-27T20:00:00.000Z',
  goal_api_fixture_id = 'cmu75kz2n4qs4km088m7t6uli',
  updated_at = now()
WHERE id = '648e5c15-cec1-4d59-a7ca-82bf53978743';

-- ============================================================================
-- 5. POST-MIGRATION SANITY ASSERTIONS
-- ============================================================================
DO $$
DECLARE
  v_total_matches INT;
  v_md1_matches INT;
  v_future_matches INT;
  v_total_goal_ids INT;
  v_distinct_goal_ids INT;
  v_invalidated_count INT;
  v_active_future_preds INT;
BEGIN
  -- 5.1 Match count assertions
  SELECT COUNT(*) INTO v_total_matches FROM public.matches;
  IF v_total_matches <> 144 THEN
    RAISE EXCEPTION 'Post-migration assertion failed: total matches is %, expected 144', v_total_matches;
  END IF;

  SELECT COUNT(*) INTO v_md1_matches FROM public.matches WHERE matchday = 1 AND status = 'finished';
  IF v_md1_matches <> 18 THEN
    RAISE EXCEPTION 'Post-migration assertion failed: finished MD1 matches is %, expected 18', v_md1_matches;
  END IF;

  SELECT COUNT(*) INTO v_future_matches FROM public.matches WHERE matchday >= 2;
  IF v_future_matches <> 126 THEN
    RAISE EXCEPTION 'Post-migration assertion failed: MD2-MD8 matches is %, expected 126', v_future_matches;
  END IF;

  -- 5.2 Goal API fixture IDs uniqueness and completeness (144 total, 144 distinct, 0 nulls)
  SELECT COUNT(goal_api_fixture_id), COUNT(DISTINCT goal_api_fixture_id)
  INTO v_total_goal_ids, v_distinct_goal_ids
  FROM public.matches;

  IF v_total_goal_ids <> 144 OR v_distinct_goal_ids <> 144 THEN
    RAISE EXCEPTION 'Post-migration assertion failed: Goal API fixture IDs not unique/complete (total=%, distinct=%)', v_total_goal_ids, v_distinct_goal_ids;
  END IF;

  -- 5.3 Invalidation backup count assertion (exactly 40)
  SELECT COUNT(*) INTO v_invalidated_count
  FROM public.invalidated_predictions
  WHERE reason = 'schedule_repair_2026_27';

  IF v_invalidated_count <> 40 THEN
    RAISE EXCEPTION 'Post-migration assertion failed: invalidated predictions count is %, expected 40', v_invalidated_count;
  END IF;

  -- 5.4 Active future predictions assertion (exactly 1 preserved)
  SELECT COUNT(*) INTO v_active_future_preds
  FROM public.predictions p
  JOIN public.matches m ON p.match_id = m.id
  WHERE m.matchday >= 2;

  IF v_active_future_preds <> 1 THEN
    RAISE EXCEPTION 'Post-migration assertion failed: remaining active future predictions is %, expected 1', v_active_future_preds;
  END IF;
END $$;

COMMIT;
