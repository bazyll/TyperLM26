import { z } from "zod";

/**
 * Strict Zod Schemas for GOAL API validation.
 * We never trust incoming JSON without validating its shape first.
 */

export const goalApiRawEventSchema = z.object({
  id: z.string(),
  fixtureId: z.string().optional(),
  time: z.union([z.string(), z.number()]).optional().nullable(),
  timeNum: z.number().optional().nullable(),
  type: z.string(),
  homeScorer: z.string().optional().nullable(),
  homeScorerId: z.string().optional().nullable(),
  homeAssist: z.string().optional().nullable(),
  homeAssistId: z.string().optional().nullable(),
  awayScorer: z.string().optional().nullable(),
  awayScorerId: z.string().optional().nullable(),
  awayAssist: z.string().optional().nullable(),
  awayAssistId: z.string().optional().nullable(),
  score: z.string().optional().nullable(),
  info: z.string().optional().nullable(),
  scoreInfoTime: z.string().optional().nullable(),
});

export const goalApiFixtureSchema = z.object({
  id: z.string(),
  apiId: z.string().optional().nullable(),
  leagueId: z.string(),
  leagueName: z.string().default("UEFA Champions League"),
  leagueYear: z.string().optional().nullable(),
  matchDate: z.string(),
  matchTime: z.string().default("00:00"),
  kickoffUtc: z.string(),
  matchStatus: z.string(),
  matchLive: z.union([z.string(), z.number()]).optional().nullable(),
  homeTeamId: z.string().optional().default(""),
  homeTeamName: z.string(),
  homeTeamScore: z.union([z.string(), z.number()]).optional().nullable(),
  homeTeamHalftimeScore: z.union([z.string(), z.number()]).optional().nullable(),
  homeTeamFtScore: z.union([z.string(), z.number()]).optional().nullable(),
  awayTeamId: z.string().optional().default(""),
  awayTeamName: z.string(),
  awayTeamScore: z.union([z.string(), z.number()]).optional().nullable(),
  awayTeamHalftimeScore: z.union([z.string(), z.number()]).optional().nullable(),
  awayTeamFtScore: z.union([z.string(), z.number()]).optional().nullable(),
  matchRound: z.string().optional().nullable(),
  stageName: z.string().optional().nullable(),
  teamHomeBadge: z.string().optional().nullable(),
  teamAwayBadge: z.string().optional().nullable(),
  homeTeam: z
    .object({
      id: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
      badge: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  awayTeam: z
    .object({
      id: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
      badge: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  events: z.array(goalApiRawEventSchema).optional().default([]),
});

export const goalApiFixturesResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(goalApiFixtureSchema).default([]),
});

export const goalApiSingleFixtureResponseSchema = z.object({
  success: z.boolean().default(true),
  data: goalApiFixtureSchema.nullable().optional(),
});

export const goalApiEventsResponseSchema = z.object({
  status: z.union([z.number(), z.string()]).optional(),
  message: z.string().optional(),
  data: z.union([
    z.array(goalApiRawEventSchema),
    z.object({
      goals: z.array(goalApiRawEventSchema).optional().default([]),
    }),
  ]),
});

export const goalApiPlayerItemSchema = z.object({
  id: z.string(),
  apiId: z.union([z.string(), z.number()]).transform((val) => String(val)),
  name: z.string(),
  number: z.union([z.string(), z.number()]).optional().nullable().transform((val) => (val !== undefined && val !== null ? String(val) : null)),
  type: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable().default(true),
});

export const goalApiTeamPlayersResponseSchema = z.object({
  status: z.union([z.number(), z.string()]).optional(),
  message: z.string().optional(),
  data: z.array(goalApiPlayerItemSchema).default([]),
});
