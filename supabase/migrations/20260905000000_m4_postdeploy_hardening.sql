-- ============================================================================
-- Migration: 20260905000000_m4_postdeploy_hardening.sql
-- Description: Post-deployment hardening for Milestone 4 (Fair Play & RLS)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SPECIAL PREDICTION CORRECT ANSWERS: Restrict visibility & prevent client mutations
-- ----------------------------------------------------------------------------
-- Drop direct client mutation policy for admin (mutations must go through service_role / RPC)
DROP POLICY IF EXISTS "spec_answers_admin_all" ON public.special_prediction_correct_answers;

-- Read policy: Admins can see staged/settled answers; active players can only see after category is 'settled'
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
-- 3. PICK'EM SELECTIONS: Granular, hardened RLS for Single Source of Truth
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pickem_selections_select_policy" ON public.pickem_selections;
CREATE POLICY "pickem_selections_select_policy"
ON public.pickem_selections FOR SELECT
TO authenticated
USING (
  public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_submissions s
    CROSS JOIN public.pickem_config c
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
    CROSS JOIN public.pickem_config c
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
    CROSS JOIN public.pickem_config c
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
    CROSS JOIN public.pickem_config c
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
    CROSS JOIN public.pickem_config c
    WHERE s.id = pickem_selections.submission_id
      AND s.user_id = auth.uid()
      AND c.deadline_at > now()
      AND NOT c.is_locked
  )
);

-- ----------------------------------------------------------------------------
-- 4. SERVICE ROLE PERMISSIONS FOR BACKEND PROCEDURES
-- ----------------------------------------------------------------------------
GRANT ALL ON public.special_prediction_correct_answers TO service_role;
GRANT ALL ON public.special_predictions TO service_role;
GRANT ALL ON public.pickem_submissions TO service_role;
GRANT ALL ON public.pickem_selections TO service_role;
