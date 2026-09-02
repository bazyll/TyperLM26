-- Migration: 20260908000000_team_logo_nullable.sql
-- Description: Make teams.logo_url nullable to support clubs without badges or during imports

ALTER TABLE public.teams
ALTER COLUMN logo_url DROP NOT NULL;
