-- ==============================================================================
-- MILESTONE 6C: Automated Live Sync Cron via pg_cron & pg_net
-- ==============================================================================

-- 1. Enable pg_cron and pg_net extensions if available in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Secure internal procedure invoked by pg_cron
-- Reads endpoint URL and cron secret dynamically from Supabase Vault (zero hardcoded plaintext credentials)
CREATE OR REPLACE FUNCTION public.invoke_goal_api_sync_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_function_url text;
  v_cron_secret text;
BEGIN
  -- Retrieve configuration from Supabase Vault if present
  BEGIN
    SELECT decrypted_secret INTO v_function_url
    FROM vault.decrypted_secrets
    WHERE name = 'goal_api_sync_edge_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_cron_secret
    FROM vault.decrypted_secrets
    WHERE name = 'goal_api_cron_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_function_url := NULL;
    v_cron_secret := NULL;
  END;

  -- If secrets are configured in Vault, trigger the Edge Function asynchronously
  IF v_function_url IS NOT NULL AND v_cron_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', v_cron_secret
      ),
      body := jsonb_build_object(
        'triggered_by', 'pg_cron',
        'timestamp', now()
      )
    );
  END IF;
END;
$$;

-- Secure execution permissions: allow only service_role
REVOKE EXECUTE ON FUNCTION public.invoke_goal_api_sync_edge_function() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_goal_api_sync_edge_function() TO service_role;

-- 3. Schedule the 60-second cron job
DO $$
BEGIN
  -- Remove previous job if it exists to avoid duplicates
  PERFORM cron.unschedule('goal-api-live-sync')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'goal-api-live-sync');

  -- Schedule job every minute (* * * * *)
  PERFORM cron.schedule(
    'goal-api-live-sync',
    '* * * * *',
    'SELECT public.invoke_goal_api_sync_edge_function();'
  );
EXCEPTION WHEN OTHERS THEN
  -- Safe fallback if pg_cron is disabled on local environment
  NULL;
END $$;
