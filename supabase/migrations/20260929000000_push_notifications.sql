-- ==============================================================================
-- Migration: 20260929000000_push_notifications.sql
-- Description: Web Push Notifications schema with atomic claim deduplication
-- ==============================================================================

-- 1. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- 2. Push Preferences Table
CREATE TABLE IF NOT EXISTS public.push_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    notify_24h BOOLEAN NOT NULL DEFAULT true,
    notify_3h BOOLEAN NOT NULL DEFAULT true,
    notify_30m BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Push Notification Logs Table (Atomic Claim & Deduplication)
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    window_type TEXT NOT NULL, -- '24h', '3h', '30m', 'test'
    window_bucket TEXT NOT NULL, -- Logical window bucket (e.g. earliest kickoff date/time)
    match_ids UUID[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'delivered', 'failed'
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT uq_push_logs_user_window_bucket UNIQUE (user_id, window_type, window_bucket)
);

CREATE INDEX IF NOT EXISTS idx_push_logs_user_window ON public.push_notification_logs(user_id, window_type, claimed_at);

-- 4. Atomic Claim Function (Resistant to Concurrent Cron Executions)
CREATE OR REPLACE FUNCTION public.claim_push_notification(
    p_user_id UUID,
    p_window_type TEXT,
    p_window_bucket TEXT,
    p_match_ids UUID[],
    p_stale_timeout_seconds INT DEFAULT 300
)
RETURNS TABLE (
    claimed BOOLEAN,
    log_id UUID,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
    v_log_id UUID;
BEGIN
    -- Check for existing claim/delivery
    SELECT id, status, claimed_at INTO v_existing
    FROM public.push_notification_logs
    WHERE user_id = p_user_id
      AND window_type = p_window_type
      AND window_bucket = p_window_bucket
    FOR UPDATE;

    IF FOUND THEN
        -- If already delivered, definitely skip
        IF v_existing.status = 'delivered' THEN
            RETURN QUERY SELECT false, v_existing.id, 'already_delivered'::TEXT;
            RETURN;
        END IF;

        -- If processing, check if claim has gone stale
        IF v_existing.status = 'processing' THEN
            IF (now() - v_existing.claimed_at) < (p_stale_timeout_seconds || ' seconds')::INTERVAL THEN
                RETURN QUERY SELECT false, v_existing.id, 'active_claim'::TEXT;
                RETURN;
            ELSE
                -- Reclaim stale lock
                UPDATE public.push_notification_logs
                SET claimed_at = now(),
                    status = 'processing',
                    match_ids = p_match_ids,
                    error_message = NULL
                WHERE id = v_existing.id
                RETURNING id INTO v_log_id;

                RETURN QUERY SELECT true, v_log_id, 'reclaimed_stale'::TEXT;
                RETURN;
            END IF;
        END IF;

        -- If failed previously, allow retry
        UPDATE public.push_notification_logs
        SET claimed_at = now(),
            status = 'processing',
            match_ids = p_match_ids,
            error_message = NULL
        WHERE id = v_existing.id
        RETURNING id INTO v_log_id;

        RETURN QUERY SELECT true, v_log_id, 'reclaimed_failed'::TEXT;
        RETURN;
    END IF;

    -- Insert new claim atomically
    BEGIN
        INSERT INTO public.push_notification_logs (
            user_id,
            window_type,
            window_bucket,
            match_ids,
            status,
            claimed_at
        )
        VALUES (
            p_user_id,
            p_window_type,
            p_window_bucket,
            p_match_ids,
            'processing',
            now()
        )
        RETURNING id INTO v_log_id;

        RETURN QUERY SELECT true, v_log_id, 'new_claim'::TEXT;
        RETURN;
    EXCEPTION WHEN unique_violation THEN
        RETURN QUERY SELECT false, NULL::UUID, 'conflict_claim'::TEXT;
        RETURN;
    END;
END;
$$;

-- 5. Complete Claim Function
CREATE OR REPLACE FUNCTION public.complete_push_notification_claim(
    p_log_id UUID,
    p_status TEXT, -- 'delivered' or 'failed'
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.push_notification_logs
    SET status = p_status,
        sent_at = CASE WHEN p_status = 'delivered' THEN now() ELSE sent_at END,
        error_message = p_error_message
    WHERE id = p_log_id;
END;
$$;

-- 6. Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Subscriptions
CREATE POLICY "Users can view their own push subscriptions"
    ON public.push_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions"
    ON public.push_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
    ON public.push_subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
    ON public.push_subscriptions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Preferences
CREATE POLICY "Users can view their own push preferences"
    ON public.push_preferences FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push preferences"
    ON public.push_preferences FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push preferences"
    ON public.push_preferences FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Logs
CREATE POLICY "Users can view their own push logs"
    ON public.push_notification_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to push tables"
    ON public.push_subscriptions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to push preferences"
    ON public.push_preferences FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to push logs"
    ON public.push_notification_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 8. Automated Push Reminders Scheduler via pg_cron, pg_net & Supabase Vault
-- ==============================================================================

-- Enable extensions in extensions schema if available
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Procedure invoked every 10 minutes by pg_cron
CREATE OR REPLACE FUNCTION public.invoke_push_reminders_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  -- Retrieve endpoint URL and secret dynamically from Supabase Vault
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'push_reminders_cron_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_reminders_cron_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
    v_secret := NULL;
  END;

  -- Safe NO-OP: if either URL or secret is missing, do not send request
  IF v_url IS NOT NULL AND v_secret IS NOT NULL AND length(trim(v_url)) > 0 AND length(trim(v_secret)) > 0 THEN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(v_secret)
      ),
      body := jsonb_build_object(
        'triggered_by', 'pg_cron',
        'timestamp', now()
      )
    );
  END IF;
END;
$$;

-- Secure execution permissions
REVOKE EXECUTE ON FUNCTION public.invoke_push_reminders_cron() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_push_reminders_cron() TO service_role;

-- Schedule the 10-minute cron job (*/10 * * * *)
DO $$
BEGIN
  -- Remove previous job if exists to prevent duplicates
  PERFORM cron.unschedule('push-reminders-cron')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-reminders-cron');

  -- Schedule push reminders job every 10 minutes
  PERFORM cron.schedule(
    'push-reminders-cron',
    '*/10 * * * *',
    'SELECT public.invoke_push_reminders_cron();'
  );
EXCEPTION WHEN OTHERS THEN
  -- Safe fallback for environments where pg_cron is disabled
  NULL;
END $$;

