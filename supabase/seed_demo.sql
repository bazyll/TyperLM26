-- ============================================================================
-- TyperLM26: Development / Demo Seed Data (Season 2026/2027)
-- ============================================================================

-- 1. Insert UCL Teams
INSERT INTO public.teams (id, name, short_name, code, logo_url, uefa_coefficient) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Real Madryt', 'Real Madryt', 'RMA', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 136.000),
  ('a0000000-0000-0000-0000-000000000002', 'Manchester City', 'Man City', 'MCI', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 148.000),
  ('a0000000-0000-0000-0000-000000000003', 'Bayern Monachium', 'Bayern', 'BAY', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 125.000),
  ('a0000000-0000-0000-0000-000000000004', 'Arsenal FC', 'Arsenal', 'ARS', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 88.000),
  ('a0000000-0000-0000-0000-000000000005', 'Paris Saint-Germain', 'PSG', 'PSG', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 108.000),
  ('a0000000-0000-0000-0000-000000000006', 'FC Barcelona', 'Barcelona', 'BAR', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 91.000),
  ('a0000000-0000-0000-0000-000000000007', 'Liverpool FC', 'Liverpool', 'LIV', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 114.000),
  ('a0000000-0000-0000-0000-000000000008', 'Inter Mediolan', 'Inter', 'INT', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 101.000),
  ('a0000000-0000-0000-0000-000000000009', 'Bayer Leverkusen', 'Leverkusen', 'B04', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 82.000),
  ('a0000000-0000-0000-0000-000000000010', 'Atletico Madryt', 'Atletico', 'ATM', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 89.000),
  ('a0000000-0000-0000-0000-000000000011', 'Borussia Dortmund', 'Dortmund', 'BVB', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 97.000),
  ('a0000000-0000-0000-0000-000000000012', 'Juventus FC', 'Juventus', 'JUV', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop', 80.000)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Key Players
INSERT INTO public.players (id, name, team_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Kylian Mbappé', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Vinícius Júnior', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'Erling Haaland', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000004', 'Kevin De Bruyne', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000005', 'Harry Kane', 'a0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000006', 'Bukayo Saka', 'a0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000007', 'Robert Lewandowski', 'a0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000008', 'Lamine Yamal', 'a0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000009', 'Mohamed Salah', 'a0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000010', 'Lautaro Martínez', 'a0000000-0000-0000-0000-000000000008')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Special Prediction Categories
INSERT INTO public.special_prediction_categories (id, slug, title, description, target_type, points_value, deadline_at, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'ucl_winner', 'Zwycięzca Ligi Mistrzów', 'Kto wygra finał Champions League 2026/2027?', 'team', 20, '2026-09-15 18:45:00+00', 'open'),
  ('c0000000-0000-0000-0000-000000000002', 'ucl_runner_up', 'Finalista Ligi Mistrzów', 'Kto zagra w finale i zostanie wicemistrzem?', 'team', 20, '2026-09-15 18:45:00+00', 'open'),
  ('c0000000-0000-0000-0000-000000000003', 'top_scorer', 'Król strzelców', 'Kto zdobędzie najwięcej bramek w całym sezonie LM?', 'player', 20, '2026-09-15 18:45:00+00', 'open'),
  ('c0000000-0000-0000-0000-000000000004', 'top_assists', 'Król asyst', 'Kto zaliczy najwięcej asyst w sezonie?', 'player', 20, '2026-09-15 18:45:00+00', 'open'),
  ('c0000000-0000-0000-0000-000000000005', 'top_scoring_team', 'Najwięcej zdobytych bramek', 'Która drużyna strzeli najwięcej goli?', 'team', 20, '2026-09-15 18:45:00+00', 'open'),
  ('c0000000-0000-0000-0000-000000000006', 'most_clean_sheets_team', 'Najwięcej czystych kont', 'Która drużyna zanotuje najwięcej meczów bez straty gola?', 'team', 20, '2026-09-15 18:45:00+00', 'open')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Pick'em Config
INSERT INTO public.pickem_config (id, season, deadline_at, status) VALUES
  ('d0000000-0000-0000-0000-000000000001', '2026/2027', '2026-09-15 18:45:00+00', 'open')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Sample Matches (Matching mockup & future matches)
INSERT INTO public.matches (id, matchday, stage, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, live_minute) VALUES
  ('e0000000-0000-0000-0000-000000000001', 1, 'league', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '2026-09-15 19:00:00+00', 'scheduled', NULL, NULL, NULL),
  ('e0000000-0000-0000-0000-000000000002', 1, 'league', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', '2026-09-17 16:45:00+00', 'scheduled', NULL, NULL, NULL),
  ('e0000000-0000-0000-0000-000000000003', 1, 'league', 'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006', '2026-09-17 19:00:00+00', 'scheduled', NULL, NULL, NULL),
  ('e0000000-0000-0000-0000-000000000004', 1, 'league', 'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008', '2026-09-18 19:00:00+00', 'scheduled', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
