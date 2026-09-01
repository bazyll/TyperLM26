import { z } from "zod";

export const savePickemSchema = z.object({
  firstTeamId: z.string().uuid("Wybierz drużynę na 1. miejsce (FIRST)"),
  top8TeamIds: z.array(z.string().uuid()).length(7, "Kategoria TOP 8 musi zawierać dokładnie 7 drużyn"),
  outTeamIds: z.array(z.string().uuid()).length(8, "Kategoria OUT musi zawierać dokładnie 8 drużyn"),
});

export const updatePickemDeadlineSchema = z.object({
  deadlineAt: z.string().datetime("Niepoprawny format daty deadline"),
});
