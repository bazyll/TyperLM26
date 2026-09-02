-- ==============================================================================
-- MILESTONE 6C: Enable Supabase Realtime for Matches
-- ==============================================================================

-- Enable Supabase Realtime publication on 'matches' table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
END $$;
