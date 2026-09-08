-- ============================================================================
-- Migration: 20260917000000_sync_pickem_deadline_and_lock_guards.sql
-- Description:
--   1. Fix lock guard triggers on pickem_config and special_prediction_categories
--      to allow admin updates/unlocks when new deadline_at is in the future.
--   2. Synchronize pickem_config deadline_at with special_prediction_categories
--      (2026-09-08 16:45:00+00 - kickoff of UCL League Phase MD1) and unlock it.
-- ============================================================================

-- 1. Fix Pick'em lock transition trigger
CREATE OR REPLACE FUNCTION public.check_pickem_lock_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If new deadline is set in the future and explicitly unlocked, permit unlock:
  IF (NEW.deadline_at > now() AND NEW.is_locked = FALSE) THEN
    NEW.is_locked := FALSE;
    NEW.locked_at := NULL;
  ELSIF (NEW.deadline_at <= now() OR NEW.is_locked = TRUE) THEN
    NEW.is_locked := TRUE;
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := COALESCE(OLD.locked_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Fix Special Prediction categories lock transition trigger
CREATE OR REPLACE FUNCTION public.check_special_category_lock_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If new deadline is set in the future and explicitly unlocked, permit unlock:
  IF (NEW.deadline_at > now() AND NEW.is_locked = FALSE) THEN
    NEW.is_locked := FALSE;
    NEW.locked_at := NULL;
  ELSIF (NEW.deadline_at <= now() OR NEW.is_locked = TRUE) THEN
    NEW.is_locked := TRUE;
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := COALESCE(OLD.locked_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

