-- Migration: 20260907000000_goal_api_integration.sql
-- Description: Milestone 6B.1 - GOAL API Data Layer, Schemas, Match Events, Sync Leases, and State

-- 1. Extend teams table with external provider ID
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS goal_api_id TEXT UNIQUE;

-- 2. Extend matches table with external fixture ID, manual override flag, and sync timestamp
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS goal_api_fixture_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 3. Table: match_events
CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  goal_api_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  minute INTEGER,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  side TEXT, -- 'home' | 'away'
  scorer_external_id TEXT,
  scorer_name TEXT,
  assist_external_id TEXT,
  assist_name TEXT,
  info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON public.match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_goal_api_id ON public.match_events(goal_api_event_id);
CREATE INDEX IF NOT EXISTS idx_match_events_team_id ON public.match_events(team_id);
CREATE INDEX IF NOT EXISTS idx_match_events_scorer ON public.match_events(scorer_name);

-- 4. Table: external_api_sync_state
CREATE TABLE IF NOT EXISTS public.external_api_sync_state (
  provider VARCHAR(50) PRIMARY KEY,
  quota_limit INTEGER,
  quota_remaining INTEGER,
  quota_reset_at TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial record for goal_api
INSERT INTO public.external_api_sync_state (provider, quota_limit, quota_remaining)
VALUES ('goal_api', 1000, 1000)
ON CONFLICT (provider) DO NOTHING;

-- 5. Table: sync_leases (Distributed atomic lock for serverless/connection pooling)
CREATE TABLE IF NOT EXISTS public.sync_leases (
  sync_name VARCHAR(50) PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  locked_by VARCHAR(100) NOT NULL,
  last_started_at TIMESTAMPTZ NOT NULL,
  last_finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'idle'
);

-- Insert initial record for goal_api_sync
INSERT INTO public.sync_leases (sync_name, locked_until, locked_by, last_started_at, status)
VALUES ('goal_api_sync', NOW() - INTERVAL '1 hour', 'init', NOW() - INTERVAL '1 hour', 'idle')
ON CONFLICT (sync_name) DO NOTHING;

-- 6. Helper function for atomic lease acquisition (handles both initial insert and atomic updates)
CREATE OR REPLACE FUNCTION public.acquire_sync_lease(
  p_sync_name VARCHAR,
  p_locked_by VARCHAR,
  p_duration_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acquired BOOLEAN := false;
BEGIN
  INSERT INTO public.sync_leases (sync_name, locked_until, locked_by, last_started_at, status)
  VALUES (p_sync_name, NOW() + (p_duration_seconds || ' seconds')::INTERVAL, p_locked_by, NOW(), 'running')
  ON CONFLICT (sync_name) DO UPDATE
  SET
    locked_until = EXCLUDED.locked_until,
    locked_by = EXCLUDED.locked_by,
    last_started_at = EXCLUDED.last_started_at,
    status = 'running'
  WHERE (sync_leases.locked_until < NOW() OR sync_leases.status = 'idle');

  IF FOUND THEN
    v_acquired := true;
  END IF;

  RETURN v_acquired;
END;
$$;

-- 7. Helper function for releasing sync lease (only current owner can release)
CREATE OR REPLACE FUNCTION public.release_sync_lease(
  p_sync_name VARCHAR,
  p_locked_by VARCHAR,
  p_status VARCHAR DEFAULT 'idle'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sync_leases
  SET
    locked_until = NOW(),
    last_finished_at = NOW(),
    status = p_status
  WHERE sync_name = p_sync_name
    AND locked_by = p_locked_by;
END;
$$;

-- 8. Stored function for Native Scorers and Assists Aggregation
CREATE OR REPLACE FUNCTION public.get_ucl_scorers_and_assists()
RETURNS TABLE (
  player_name TEXT,
  scorer_external_id TEXT,
  team_id UUID,
  team_name TEXT,
  team_code VARCHAR,
  team_logo_url TEXT,
  goals_count BIGINT,
  assists_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: inactive or unauthenticated user.';
  END IF;

  RETURN QUERY
  WITH scorer_stats AS (
    SELECT
      me.scorer_name AS p_name,
      me.scorer_external_id AS p_ext_id,
      me.team_id AS t_id,
      COUNT(*) AS g_count
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE me.event_type = 'GOAL'
      AND m.goal_api_fixture_id IS NOT NULL
      AND me.scorer_name IS NOT NULL
      AND TRIM(me.scorer_name) <> ''
      AND me.scorer_external_id IS NOT NULL
      AND TRIM(me.scorer_external_id) <> ''
      AND (me.info IS NULL OR LOWER(me.info) NOT LIKE '%own goal%')
    GROUP BY me.scorer_name, me.scorer_external_id, me.team_id
  ),
  assist_stats AS (
    SELECT
      me.assist_name AS p_name,
      me.assist_external_id AS p_ext_id,
      me.team_id AS t_id,
      COUNT(*) AS a_count
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE me.event_type = 'GOAL'
      AND m.goal_api_fixture_id IS NOT NULL
      AND me.assist_name IS NOT NULL
      AND TRIM(me.assist_name) <> ''
      AND me.assist_external_id IS NOT NULL
      AND TRIM(me.assist_external_id) <> ''
    GROUP BY me.assist_name, me.assist_external_id, me.team_id
  ),
  all_players AS (
    SELECT p_name, p_ext_id, t_id FROM scorer_stats
    UNION
    SELECT p_name, p_ext_id, t_id FROM assist_stats
  )
  SELECT
    ap.p_name AS player_name,
    ap.p_ext_id AS scorer_external_id,
    ap.t_id AS team_id,
    t.name AS team_name,
    t.code AS team_code,
    t.logo_url AS team_logo_url,
    COALESCE(ss.g_count, 0) AS goals_count,
    COALESCE(ast.a_count, 0) AS assists_count
  FROM all_players ap
  LEFT JOIN public.teams t ON t.id = ap.t_id
  LEFT JOIN scorer_stats ss ON ss.p_name = ap.p_name AND ss.t_id IS NOT DISTINCT FROM ap.t_id
  LEFT JOIN assist_stats ast ON ast.p_name = ap.p_name AND ast.t_id IS NOT DISTINCT FROM ap.t_id
  ORDER BY goals_count DESC, assists_count DESC, player_name ASC;
END;
$$;

-- 9. Row Level Security (RLS)
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_leases ENABLE ROW LEVEL SECURITY;

-- Read policy for match_events: active users can read
CREATE POLICY "match_events_select_active"
ON public.match_events
FOR SELECT
TO authenticated
USING (public.is_active_user());

-- Read policy for external_api_sync_state: active users can read
CREATE POLICY "external_api_sync_state_select_active"
ON public.external_api_sync_state
FOR SELECT
TO authenticated
USING (public.is_active_user());

-- Read policy for sync_leases: active users can read
CREATE POLICY "sync_leases_select_active"
ON public.sync_leases
FOR SELECT
TO authenticated
USING (public.is_active_user());

-- 10. RPC Permissions Hardening
-- Revoke lease management from PUBLIC, anon, and authenticated users
REVOKE EXECUTE ON FUNCTION public.acquire_sync_lease(VARCHAR, VARCHAR, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_sync_lease(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_sync_lease(VARCHAR, VARCHAR, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_sync_lease(VARCHAR, VARCHAR, VARCHAR) TO service_role;

-- Revoke scorers RPC from PUBLIC and anon, allow authenticated (with internal is_active_user check) & service_role
REVOKE EXECUTE ON FUNCTION public.get_ucl_scorers_and_assists() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ucl_scorers_and_assists() TO authenticated, service_role;
