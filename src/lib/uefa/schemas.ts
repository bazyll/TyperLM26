import { z } from "zod";

export const uefaPlayerItemSchema = z.object({
  uefaPlayerId: z.string().min(1, "Brak uefaPlayerId"),
  name: z.string().min(1, "Brak imienia i nazwiska zawodnika"),
  position: z.string().nullable().optional(),
  jerseyNumber: z.union([z.string(), z.number()]).nullable().optional().transform((v) => (v !== undefined && v !== null ? String(v) : null)),
  listType: z.enum(["A", "B"]).nullable().optional(),
});

export const uefaTeamSquadSchema = z.object({
  teamCode: z.string().min(2, "Błędny teamCode"),
  teamName: z.string().min(2, "Błędna nazwa drużyny"),
  players: z.array(uefaPlayerItemSchema),
});

export const uefaSnapshotSchema = z.object({
  competition: z.literal("UEFA Champions League"),
  season: z.literal("2026/27"),
  retrievedAt: z.string(),
  source: z.literal("UEFA"),
  version: z.string().min(1),
  teams: z.array(uefaTeamSquadSchema),
});
