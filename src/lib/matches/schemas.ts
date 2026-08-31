import { z } from "zod";

export const scoreInputSchema = z.number().int().min(0, "Wynik nie może być ujemny.").max(99, "Maksymalny wynik to 99.");

export const savePredictionSchema = z.object({
  matchId: z.string().uuid("Niepoprawny identyfikator meczu."),
  homeScore: scoreInputSchema,
  awayScore: scoreInputSchema,
});

export const createMatchSchema = z.object({
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  kickoffAt: z.string().min(1, "Wprowadź datę i godzinę rozpoczęcia."),
  stage: z.enum(["league", "playoff", "round_of_16", "quarter_finals", "semi_finals", "final"]).default("league"),
  matchday: z.number().int().min(1).max(8).optional().nullable(),
}).refine((data) => data.homeTeamId !== data.awayTeamId, {
  message: "Gospodarz i gość muszą być różnymi drużynami.",
  path: ["awayTeamId"],
});

export const updateMatchSchema = z.object({
  matchId: z.string().uuid(),
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  kickoffAt: z.string(),
  stage: z.enum(["league", "playoff", "round_of_16", "quarter_finals", "semi_finals", "final"]),
  matchday: z.number().int().min(1).max(8).optional().nullable(),
  status: z.enum(["scheduled", "live", "finished", "postponed", "cancelled"]),
  homeScore: scoreInputSchema.optional().nullable(),
  awayScore: scoreInputSchema.optional().nullable(),
  liveMinute: z.number().int().min(0).max(130).optional().nullable(),
  isBettingLocked: z.boolean().optional(),
}).refine((data) => data.homeTeamId !== data.awayTeamId, {
  message: "Gospodarz i gość muszą być różnymi drużynami.",
  path: ["awayTeamId"],
});

export const liveScoreSchema = z.object({
  matchId: z.string().uuid(),
  homeScore: scoreInputSchema,
  awayScore: scoreInputSchema,
  liveMinute: z.number().int().min(0).max(130),
});

export const finalizeMatchSchema = z.object({
  matchId: z.string().uuid(),
  homeScore: scoreInputSchema,
  awayScore: scoreInputSchema,
});
