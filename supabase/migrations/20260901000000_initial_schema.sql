-- ============================================================================
-- TyperLM26: PostgreSQL Database Schema Migration (UEFA Champions League 2026/2027)
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 2. Drop existing triggers & functions if present (for clean idempotency)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_active_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_profile_update_permissions() CASCADE;
DROP FUNCTION IF EXISTS public.check_prediction_update_permissions() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_username_to_auth_mappings() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.check_and_record_login_attempt(TEXT, TEXT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.finalize_and_score_match(UUID, INT, INT) CASCADE;

-- 3. Helper trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Profiles Table (Public Profile Data Linked with auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  username CITEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);

-- Helper function to verify active admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to verify active user status (Used in RLS for IMMEDIATE session blocking)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to guard protected profile columns (Least Privilege)
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
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

CREATE TRIGGER trg_profiles_update_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_update_permissions();

-- ============================================================================
-- 5. Private Auth Mappings (Defence in Depth - Internal Auth Mapping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auth_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  username CITEXT NOT NULL UNIQUE,
  auth_email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_mappings_username ON public.auth_mappings(username);
CREATE INDEX IF NOT EXISTS idx_auth_mappings_user_id ON public.auth_mappings(user_id);

-- Explicitly revoke access for anon and authenticated users
ALTER TABLE public.auth_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_mappings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_mappings TO service_role;

-- Trigger to keep auth_mappings.username in sync with profiles.username atomically
CREATE OR REPLACE FUNCTION public.sync_profile_username_to_auth_mappings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username <> OLD.username THEN
    UPDATE public.auth_mappings
    SET username = NEW.username
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_profile_username
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_username_to_auth_mappings();

-- ============================================================================
-- 6. Teams & Players Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL,
  code VARCHAR(3) NOT NULL UNIQUE,
  logo_url TEXT NOT NULL,
  uefa_coefficient NUMERIC(6,3) NOT NULL DEFAULT 0.000,
  disciplinary_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_code ON public.teams(code);

CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);

-- ============================================================================
-- 7. Matches Table (With is_betting_locked and Status Constraints)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday INT,
  stage TEXT NOT NULL DEFAULT 'league' CHECK (stage IN ('league', 'playoff', 'round_of_16', 'quarter_finals', 'semi_finals', 'final')),
  home_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  away_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  is_betting_locked BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_score INT CHECK (home_score >= 0 AND home_score <= 99),
  away_score INT CHECK (away_score >= 0 AND away_score <= 99),
  live_minute INT CHECK (live_minute >= 0 AND live_minute <= 130),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_different_teams CHECK (home_team_id <> away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON public.matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_matchday ON public.matches(matchday);

CREATE TRIGGER trg_matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. Predictions Table (Score predictions) - Preserves League History
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score INT NOT NULL CHECK (home_score >= 0 AND home_score <= 99),
  away_score INT NOT NULL CHECK (away_score >= 0 AND away_score <= 99),
  points_awarded INT DEFAULT NULL,
  scoring_category TEXT CHECK (scoring_category IN ('exact', 'diff', 'outcome', 'incorrect', NULL)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON public.predictions(match_id);

-- Trigger to guard points cache on predictions
CREATE OR REPLACE FUNCTION public.check_prediction_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
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

CREATE TRIGGER trg_predictions_points_guard
BEFORE UPDATE ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.check_prediction_update_permissions();

-- ============================================================================
-- 9. Atomic Match Finalization and Points Calculation Function (PostgreSQL)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finalize_and_score_match(
  p_match_id UUID,
  p_home_score INT,
  p_away_score INT
)
RETURNS VOID AS $$
DECLARE
  pred RECORD;
  v_points INT;
  v_cat TEXT;
BEGIN
  -- 1. Update match to finished with final score and lock betting permanently
  UPDATE public.matches
  SET status = 'finished',
      home_score = p_home_score,
      away_score = p_away_score,
      is_betting_locked = TRUE,
      updated_at = now()
  WHERE id = p_match_id;

  -- 2. Recalculate all predictions for this match atomically
  FOR pred IN
    SELECT id, home_score, away_score
    FROM public.predictions
    WHERE match_id = p_match_id
  LOOP
    -- Calculate points according to official rules:
    -- Exact score (including exact draws like 1:1) -> 3 pts
    IF pred.home_score = p_home_score AND pred.away_score = p_away_score THEN
      v_points := 3;
      v_cat := 'exact';
    -- Correct goal diff & winner OR non-exact draw (1:1 vs 2:2, 0:0 vs 3:3) -> 2 pts
    ELSIF (pred.home_score - pred.away_score) = (p_home_score - p_away_score) AND
          ((pred.home_score > pred.away_score AND p_home_score > p_away_score) OR
           (pred.home_score < pred.away_score AND p_home_score < p_away_score) OR
           (pred.home_score = pred.away_score AND p_home_score = p_away_score)) THEN
      v_points := 2;
      v_cat := 'diff';
    -- Correct outcome / winner without correct goal diff -> 1 pt
    ELSIF (pred.home_score > pred.away_score AND p_home_score > p_away_score) OR
          (pred.home_score < pred.away_score AND p_home_score < p_away_score) THEN
      v_points := 1;
      v_cat := 'outcome';
    -- Incorrect outcome -> 0 pts
    ELSE
      v_points := 0;
      v_cat := 'incorrect';
    END IF;

    -- Update prediction points atomically
    UPDATE public.predictions
    SET points_awarded = v_points,
        scoring_category = v_cat,
        updated_at = now()
    WHERE id = pred.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. Special Predictions Categories & Predictions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.special_prediction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('team', 'player')),
  points_value INT NOT NULL DEFAULT 20,
  deadline_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'settled')),
  correct_team_id UUID REFERENCES public.teams(id),
  correct_player_id UUID REFERENCES public.players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.special_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.special_prediction_categories(id) ON DELETE CASCADE,
  selected_team_id UUID REFERENCES public.teams(id),
  selected_player_id UUID REFERENCES public.players(id),
  points_awarded INT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_spec_pred_user ON public.special_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_spec_pred_cat ON public.special_predictions(category_id);

-- ============================================================================
-- 11. Pick'em Config & Submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pickem_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL UNIQUE DEFAULT '2026/2027',
  deadline_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pickem_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT UNIQUE,
  first_team_id UUID NOT NULL REFERENCES public.teams(id),
  top8_team_ids UUID[] NOT NULL,
  out_team_ids UUID[] NOT NULL,
  points_awarded INT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pickem_user ON public.pickem_submissions(user_id);

-- ============================================================================
-- 12. Announcements & Comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  content VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_announcement ON public.announcement_comments(announcement_id);

-- ============================================================================
-- 13. Audit Logs (Append-Only Security Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);

-- ============================================================================
-- 14. Serverless Persistent Atomic Rate Limiting (With Auto-Cleanup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  username CITEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON public.login_attempts(username, attempted_at DESC);

-- Atomic check, record and auto-cleanup in PostgreSQL
CREATE OR REPLACE FUNCTION public.check_and_record_login_attempt(
  p_ip TEXT,
  p_username TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_seconds INT DEFAULT 60
)
RETURNS TABLE (
  is_allowed BOOLEAN,
  remaining_seconds INT
) AS $$
DECLARE
  v_count_user INT := 0;
  v_count_ip INT := 0;
  v_oldest TIMESTAMPTZ;
  v_remaining INT := 0;
  v_cutoff TIMESTAMPTZ := now() - (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
  -- 1. Automatic periodic cleanup of obsolete records older than 1 hour
  DELETE FROM public.login_attempts
  WHERE attempted_at < (now() - INTERVAL '1 hour');

  -- 2. Count failed attempts for username
  IF p_username IS NOT NULL AND p_username <> '' THEN
    SELECT COUNT(*), MIN(attempted_at)
    INTO v_count_user, v_oldest
    FROM public.login_attempts
    WHERE username = p_username::citext
      AND attempted_at > v_cutoff;
  END IF;

  -- 3. Count failed attempts for IP
  IF p_ip IS NOT NULL AND p_ip <> '' THEN
    SELECT COUNT(*)
    INTO v_count_ip
    FROM public.login_attempts
    WHERE ip_address = p_ip
      AND attempted_at > v_cutoff;
  END IF;

  -- 4. Check if limit exceeded
  IF v_count_user >= p_max_attempts OR (p_ip IS NOT NULL AND p_ip <> '' AND v_count_ip >= (p_max_attempts * 3)) THEN
    v_remaining := GREATEST(1, EXTRACT(EPOCH FROM ((COALESCE(v_oldest, now()) + (p_window_seconds || ' seconds')::INTERVAL) - now()))::INT);
    RETURN QUERY SELECT FALSE, v_remaining;
  ELSE
    -- Record this attempt atomically
    INSERT INTO public.login_attempts (ip_address, username, attempted_at)
    VALUES (p_ip, p_username::citext, now());

    RETURN QUERY SELECT TRUE, 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 15. Row Level Security (RLS) Configuration
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_prediction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "profiles_select_all"
ON public.profiles FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id AND public.is_active_user())
WITH CHECK (auth.uid() = id AND public.is_active_user());

CREATE POLICY "profiles_admin_all"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- TEAMS & PLAYERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "teams_select_all"
ON public.teams FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "teams_admin_write"
ON public.teams FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "players_select_all"
ON public.players FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "players_admin_write"
ON public.players FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- MATCHES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "matches_select_all"
ON public.matches FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "matches_admin_write"
ON public.matches FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- PREDICTIONS POLICIES (Immediate is_active_user & Kickoff Enforcement)
-- ----------------------------------------------------------------------------
-- SELECT: Own prediction always, others only after kickoff or if betting is locked
CREATE POLICY "predictions_select_policy"
ON public.predictions FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = predictions.match_id
      AND (matches.kickoff_at <= now() OR matches.is_betting_locked = TRUE)
  )
);

-- INSERT: Only active user, only own prediction, strictly before kickoff & not locked
CREATE POLICY "predictions_insert_policy"
ON public.predictions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = predictions.match_id
      AND matches.kickoff_at > now()
      AND matches.is_betting_locked = FALSE
  )
);

-- UPDATE: Only active user, only own prediction, strictly before kickoff & not locked
CREATE POLICY "predictions_update_policy"
ON public.predictions FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = predictions.match_id
      AND matches.kickoff_at > now()
      AND matches.is_betting_locked = FALSE
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = predictions.match_id
      AND matches.kickoff_at > now()
      AND matches.is_betting_locked = FALSE
  )
);

CREATE POLICY "predictions_admin_all"
ON public.predictions FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- SPECIAL PREDICTIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "spec_categories_select_all"
ON public.special_prediction_categories FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "spec_categories_admin_write"
ON public.special_prediction_categories FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "spec_predictions_select_policy"
ON public.special_predictions FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.special_prediction_categories
    WHERE special_prediction_categories.id = special_predictions.category_id
      AND special_prediction_categories.deadline_at <= now()
  )
);

CREATE POLICY "spec_predictions_insert_policy"
ON public.special_predictions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.special_prediction_categories
    WHERE special_prediction_categories.id = special_predictions.category_id
      AND special_prediction_categories.deadline_at > now()
  )
);

CREATE POLICY "spec_predictions_update_policy"
ON public.special_predictions FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.special_prediction_categories
    WHERE special_prediction_categories.id = special_predictions.category_id
      AND special_prediction_categories.deadline_at > now()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.special_prediction_categories
    WHERE special_prediction_categories.id = special_predictions.category_id
      AND special_prediction_categories.deadline_at > now()
  )
);

CREATE POLICY "spec_predictions_admin_all"
ON public.special_predictions FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- PICK'EM POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "pickem_config_select_all"
ON public.pickem_config FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "pickem_config_admin_write"
ON public.pickem_config FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "pickem_submissions_select_policy"
ON public.pickem_submissions FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.pickem_config
    WHERE pickem_config.deadline_at <= now()
  )
);

CREATE POLICY "pickem_submissions_insert_policy"
ON public.pickem_submissions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_config
    WHERE pickem_config.deadline_at > now()
  )
);

CREATE POLICY "pickem_submissions_update_policy"
ON public.pickem_submissions FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_config
    WHERE pickem_config.deadline_at > now()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_active_user()
  AND EXISTS (
    SELECT 1 FROM public.pickem_config
    WHERE pickem_config.deadline_at > now()
  )
);

CREATE POLICY "pickem_submissions_admin_all"
ON public.pickem_submissions FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- ANNOUNCEMENTS & COMMENTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "announcements_select_all"
ON public.announcements FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "announcements_admin_all"
ON public.announcements FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "comments_select_all"
ON public.announcement_comments FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "comments_insert_own"
ON public.announcement_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_active_user());

CREATE POLICY "comments_update_own"
ON public.announcement_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.is_active_user())
WITH CHECK (auth.uid() = user_id AND public.is_active_user());

CREATE POLICY "comments_delete_own"
ON public.announcement_comments FOR DELETE
TO authenticated
USING ((auth.uid() = user_id AND public.is_active_user()) OR public.is_admin());

-- ----------------------------------------------------------------------------
-- AUDIT LOGS POLICIES (Append-Only, Admin-only read, NO UPDATE / NO DELETE)
-- ----------------------------------------------------------------------------
CREATE POLICY "audit_logs_select_admin"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "audit_logs_insert_admin"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR auth.uid() = actor_id);

-- ----------------------------------------------------------------------------
-- LOGIN ATTEMPTS (Server-Only Security)
-- ----------------------------------------------------------------------------
CREATE POLICY "login_attempts_admin_all"
ON public.login_attempts FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- 16. Storage Configuration (Avatars Bucket with Storage RLS & is_active_user)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
  END IF;
END $$;

-- Storage RLS on storage.objects (RLS is already enabled by Supabase by default)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "storage_avatars_select" ON storage.objects;
    CREATE POLICY "storage_avatars_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'avatars');

    DROP POLICY IF EXISTS "storage_avatars_insert" ON storage.objects;
    CREATE POLICY "storage_avatars_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_active_user()
    );

    DROP POLICY IF EXISTS "storage_avatars_update" ON storage.objects;
    CREATE POLICY "storage_avatars_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_active_user()
    )
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_active_user()
    );

    DROP POLICY IF EXISTS "storage_avatars_delete" ON storage.objects;
    CREATE POLICY "storage_avatars_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (
        ((storage.foldername(name))[1] = auth.uid()::text AND public.is_active_user())
        OR public.is_admin()
      )
    );
  END IF;
END $$;
