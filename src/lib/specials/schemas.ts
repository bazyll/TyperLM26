import { z } from "zod";

export const saveSpecialPredictionSchema = z.object({
  categoryId: z.string().uuid("Niepoprawne ID kategorii"),
  selectedTeamId: z.string().uuid().nullable().optional(),
  selectedPlayerId: z.string().uuid().nullable().optional(),
});

export const saveAllSpecialPredictionsSchema = z.object({
  predictions: z.array(saveSpecialPredictionSchema),
});

export const updateSpecialDeadlineSchema = z.object({
  categoryId: z.string().uuid("Niepoprawne ID kategorii"),
  deadlineAt: z.string().datetime("Niepoprawny format daty deadline"),
});

export const settleSpecialCategorySchema = z.object({
  categoryId: z.string().uuid("Niepoprawne ID kategorii"),
  correctTeamIds: z.array(z.string().uuid()).optional().default([]),
  correctPlayerIds: z.array(z.string().uuid()).optional().default([]),
});

export const confirmSpecialSettlementSchema = z.object({
  categoryId: z.string().uuid("Niepoprawne ID kategorii"),
  expectedHash: z.string().optional(),
});

