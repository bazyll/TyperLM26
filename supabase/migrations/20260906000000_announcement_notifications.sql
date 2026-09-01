-- ============================================================================
-- Migration: 20260906000000_announcement_notifications.sql
-- Description: Add announcements_last_seen_at to profiles for per-user unread tracking
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS announcements_last_seen_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.announcements_last_seen_at IS 'Timestamp when user last opened the announcements feed.';
