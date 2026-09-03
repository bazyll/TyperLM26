-- ============================================================================
-- Fix Service Role Support in PostgreSQL Trigger Guards & is_admin()
--
-- ROOT CAUSE:
-- When backend Server Actions run with createAdminClient() (SUPABASE_SECRET_KEY),
-- PostgreSQL executes as 'service_role' without a user JWT, meaning auth.uid() is NULL.
-- The check_profile_update_permissions() and check_prediction_update_permissions() triggers
-- called is_admin(), which checked `id = auth.uid()`. Since auth.uid() was NULL, is_admin()
-- returned FALSE and raised 'Unauthorized' exception even for authorized admin actions.
--
-- FIX:
-- Allow service_role / postgres / supabase_admin in is_admin() and trigger guards.
-- ============================================================================

-- 1. Update public.is_admin() helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Service role / backend admin client always has administrative privileges
  IF auth.role() = 'service_role' OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN TRUE;
  END IF;

  -- Authenticated user with role = 'admin' and is_active = TRUE
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Update check_profile_update_permissions() trigger
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role bypasses trigger checks
  IF auth.role() = 'service_role' OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.updated_at = now();
    RETURN NEW;
  END IF;

  -- If not executed by active admin, prevent modifying protected fields
  IF NOT (SELECT public.is_admin()) THEN
    IF NEW.role <> OLD.role OR
       NEW.first_name <> OLD.first_name OR
       NEW.last_name <> OLD.last_name OR
       NEW.is_active <> OLD.is_active THEN
      RAISE EXCEPTION 'Unauthorized: cannot update protected profile fields (role, name, status)';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update check_prediction_update_permissions() trigger
CREATE OR REPLACE FUNCTION public.check_prediction_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role bypasses trigger checks
  IF auth.role() = 'service_role' OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.updated_at = now();
    RETURN NEW;
  END IF;

  -- If caller is not admin, normal user cannot alter points_awarded or scoring_category directly
  IF NOT (SELECT public.is_admin()) THEN
    IF (NEW.points_awarded IS DISTINCT FROM OLD.points_awarded) OR
       (NEW.scoring_category IS DISTINCT FROM OLD.scoring_category) THEN
      RAISE EXCEPTION 'Unauthorized: points cache cannot be altered by users';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
