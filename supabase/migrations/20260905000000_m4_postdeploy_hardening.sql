-- ============================================================================
-- Migration: 20260905000000_m4_postdeploy_hardening.sql
-- Description: Post-deployment hardening for Milestone 4 (Fair Play, Direct RLS & NOT NULL config_id)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SPECIAL PREDICTION CORRECT ANSWERS: Restrict visibility & prevent client mutations
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "spec_answers_admin_all" ON public.special_prediction_correct_answers;

DROP POLICY IF EXISTS "spec_answers_select_active" ON public.special_prediction_correct_answers;
CREATE POLICY "spec_answers_select_active"
ON public.special_prediction_correct_answers FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.special_prediction_categories c
      WHERE c.id = special_prediction_correct_answers.category_id
        AND c.status = 'settled'
    )
  )
);

-- ----------------------------------------------------------------------------
-- 2. FAIR PLAY HARDENING: Drop legacy admin ALL policies that bypassed deadline secrecy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "spec_predictions_admin_all" ON public.special_predictions;
DROP POLICY IF EXISTS "pickem_submissions_admin_all" ON public.pickem_submissions;
DROP POLICY IF EXISTS "pickem_selections_admin_all" ON public.pickem_selections;

-- ----------------------------------------------------------------------------
-- 3. EXPLICIT RELATION: Mandatory config_id & UNIQUE(user_id, config_id)
-- ----------------------------------------------------------------------------
-- Add column config_id
ALTER TABLE public.pickem_submissions
ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES public.pickem_config(id) ON DELETE RESTRICT;

-- Strict backfill: assign current pickem_config, abort if no config exists
DO $$
DECLARE
  v_default_config_id UUID;
BEGIN
  SELECT id INTO v_default_config_id FROM public.pickem_config ORDER BY created_at ASC LIMIT 1;
  IF v_default_config_id IS NULL THEN
    RAISE EXCEPTION 'Cannot backfill pickem_submissions: no pickem_config record found';
  END IF;
  UPDATE public.pickem_submissions SET config_id = v_default_config_id WHERE config_id IS NULL;
END $$;

-- Enforce NOT NULL on config_id
ALTER TABLE public.pickem_submissions ALTER COLUMN config_id SET NOT NULL;

-- Replace UNIQUE(user_id) with UNIQUE(user_id, config_id)
ALTER TABLE public.pickem_submissions DROP CONSTRAINT IF EXISTS pickem_submissions_user_id_key;
ALTER TABLE public.pickem_submissions DROP CONSTRAINT IF EXISTS pickem_submissions_user_config_key;
ALTER TABLE public.pickem_submissions ADD CONSTRAINT pickem_submissions_user_config_key UNIQUE (user_id, config_id);

-- Index on config_id
CREATE INDEX IF NOT EXISTS idx_pickem_sub_config ON public.pickem_submissions(config_id);

-- ----------------------------------------------------------------------------
-- 4. PICK'EM SUBMISSIONS: Clean, Direct RLS (Zero Fallbacks)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pickem_submissions_select_policy" ON public.pickem_submissions;
CREATE POLICY "pickem_submissions_select_policy"
ON public.pickem_submissions FOR SELECT
TO authenticated
USING (
  public.is_active_user()
  AND (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pickem_config c
      WHERE c.id = pickem_submissions.config_id
        AND (c.deadline_at <= now() OR c.is_locked = TRUE)
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
    WHERE c.id = pickem_submissions.config_id
      AND c.deadline_at > now()
      AND NOT c.is_locked
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
    WHERE c.id = pickem_submissions.config_id
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_config c
    WHERE c.id = pickem_submissions.config_id
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
);

-- ----------------------------------------------------------------------------
-- 5. PICK'EM SELECTIONS: Clean, Direct RLS Linked to Submission config_id
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pickem_selections_select_policy" ON public.pickem_selections;
CREATE POLICY "pickem_selections_select_policy"
ON public.pickem_selections FOR SELECT
TO authenticated
USING (
  public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_submissions s
    JOIN public.pickem_config c ON c.id = s.config_id
    WHERE s.id = pickem_selections.submission_id
      AND (s.user_id = auth.uid() OR c.deadline_at <= now() OR c.is_locked = TRUE)
  )
);

DROP POLICY IF EXISTS "pickem_selections_insert_policy" ON public.pickem_selections;
CREATE POLICY "pickem_selections_insert_policy"
ON public.pickem_selections FOR INSERT
TO authenticated
WITH CHECK (
  public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_submissions s
    JOIN public.pickem_config c ON c.id = s.config_id
    WHERE s.id = pickem_selections.submission_id
      AND s.user_id = auth.uid()
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
);

DROP POLICY IF EXISTS "pickem_selections_update_policy" ON public.pickem_selections;
CREATE POLICY "pickem_selections_update_policy"
ON public.pickem_selections FOR UPDATE
TO authenticated
USING (
  public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_submissions s
    JOIN public.pickem_config c ON c.id = s.config_id
    WHERE s.id = pickem_selections.submission_id
      AND s.user_id = auth.uid()
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
)
WITH CHECK (
  public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_submissions s
    JOIN public.pickem_config c ON c.id = s.config_id
    WHERE s.id = pickem_selections.submission_id
      AND s.user_id = auth.uid()
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
);

DROP POLICY IF EXISTS "pickem_selections_delete_policy" ON public.pickem_selections;
CREATE POLICY "pickem_selections_delete_policy"
ON public.pickem_selections FOR DELETE
TO authenticated
USING (
  public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_submissions s
    JOIN public.pickem_config c ON c.id = s.config_id
    WHERE s.id = pickem_selections.submission_id
      AND s.user_id = auth.uid()
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
);

-- ----------------------------------------------------------------------------
-- 6. SERVICE ROLE PERMISSIONS FOR BACKEND PROCEDURES
-- ----------------------------------------------------------------------------
GRANT ALL ON public.special_prediction_correct_answers TO service_role;
GRANT ALL ON public.special_predictions TO service_role;
GRANT ALL ON public.pickem_submissions TO service_role;
GRANT ALL ON public.pickem_selections TO service_role;
