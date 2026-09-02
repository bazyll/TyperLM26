-- ==============================================================================
-- MILESTONE 6D: Refinement of get_ucl_scorers_and_assists()
-- Aggregates goals & assists strictly by external_player_id across all UCL matches
-- Picks the latest team and clean display name deterministically
-- ==============================================================================

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
      me.scorer_external_id AS ext_id,
      COUNT(*) AS g_count
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE me.event_type = 'GOAL'
      AND m.goal_api_fixture_id IS NOT NULL
      AND me.scorer_external_id IS NOT NULL
      AND TRIM(me.scorer_external_id) <> ''
      AND me.scorer_name IS NOT NULL
      AND TRIM(me.scorer_name) <> ''
      AND (me.info IS NULL OR LOWER(me.info) NOT LIKE '%own goal%')
    GROUP BY me.scorer_external_id
  ),
  assist_stats AS (
    SELECT
      me.assist_external_id AS ext_id,
      COUNT(*) AS a_count
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE me.event_type = 'GOAL'
      AND m.goal_api_fixture_id IS NOT NULL
      AND me.assist_external_id IS NOT NULL
      AND TRIM(me.assist_external_id) <> ''
      AND me.assist_name IS NOT NULL
      AND TRIM(me.assist_name) <> ''
    GROUP BY me.assist_external_id
  ),
  player_identities AS (
    SELECT DISTINCT ON (ext_id)
      ext_id,
      p_name,
      t_id
    FROM (
      SELECT
        me.scorer_external_id AS ext_id,
        me.scorer_name AS p_name,
        me.team_id AS t_id,
        m.kickoff_at,
        me.minute,
        me.created_at
      FROM public.match_events me
      JOIN public.matches m ON m.id = me.match_id
      WHERE me.event_type = 'GOAL'
        AND m.goal_api_fixture_id IS NOT NULL
        AND me.scorer_external_id IS NOT NULL
        AND TRIM(me.scorer_external_id) <> ''
        AND me.scorer_name IS NOT NULL
        AND TRIM(me.scorer_name) <> ''
        AND (me.info IS NULL OR LOWER(me.info) NOT LIKE '%own goal%')

      UNION ALL

      SELECT
        me.assist_external_id AS ext_id,
        me.assist_name AS p_name,
        me.team_id AS t_id,
        m.kickoff_at,
        me.minute,
        me.created_at
      FROM public.match_events me
      JOIN public.matches m ON m.id = me.match_id
      WHERE me.event_type = 'GOAL'
        AND m.goal_api_fixture_id IS NOT NULL
        AND me.assist_external_id IS NOT NULL
        AND TRIM(me.assist_external_id) <> ''
        AND me.assist_name IS NOT NULL
        AND TRIM(me.assist_name) <> ''
    ) all_events
    ORDER BY ext_id, kickoff_at DESC, minute DESC NULLS LAST, created_at DESC
  )
  SELECT
    pi.p_name AS player_name,
    pi.ext_id AS scorer_external_id,
    pi.t_id AS team_id,
    t.name AS team_name,
    t.code AS team_code,
    t.logo_url AS team_logo_url,
    COALESCE(ss.g_count, 0)::BIGINT AS goals_count,
    COALESCE(ast.a_count, 0)::BIGINT AS assists_count
  FROM player_identities pi
  LEFT JOIN public.teams t ON t.id = pi.t_id
  LEFT JOIN scorer_stats ss ON ss.ext_id = pi.ext_id
  LEFT JOIN assist_stats ast ON ast.ext_id = pi.ext_id
  ORDER BY goals_count DESC, assists_count DESC, player_name ASC;
END;
$$;
