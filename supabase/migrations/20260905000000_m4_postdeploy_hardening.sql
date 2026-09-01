-- ============================================================================
-- Migration: 20260905000000_m4_postdeploy_hardening.sql
-- Description: Post-deployment hardening for Milestone 4 (Fair Play & RLS)
-- ============================================================================

-- 1. SPECIAL PREDICTION CORRECT ANSWERS: Restrict visibility before settlement
-- Non-admin active users can ONLY see correct answers once category status is 'settled'
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

-- 2. FAIR PLAY HARDENING: Drop legacy admin ALL policies that bypassed deadline secrecy
-- Regular SELECT queries for admins will now respect spec_predictions_select_policy and pickem_submissions_select_policy
DROP POLICY IF EXISTS "spec_predictions_admin_all" ON public.special_predictions;
DROP POLICY IF EXISTS "pickem_submissions_admin_all" ON public.pickem_submissions;

-- Ensure service_role retains full access for backend procedures
GRANT ALL ON public.special_prediction_correct_answers TO service_role;
GRANT ALL ON public.special_predictions TO service_role;
GRANT ALL ON public.pickem_submissions TO service_role;
GRANT ALL ON public.pickem_selections TO service_role;
