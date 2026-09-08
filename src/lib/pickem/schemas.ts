import { z } from "zod";

export const savePickemSchema = z.object({
  firstTeamId: z.string().uuid("Wybierz drużynę na 1. miejsce (FIRST)"),
  top8TeamIds: z.array(z.string().uuid()).length(7, "Kategoria TOP 8 musi zawierać dokładnie 7 drużyn"),
  outTeamIds: z.array(z.string().uuid()).length(12, "Kategoria OUT musi zawierać dokładnie 12 drużyn"),
});

export const correctLegacyPickemSchema = z.object({
  additionalOutTeamIds: z
    .array(z.string().uuid())
    .length(4, "Musisz wybrać dokładnie 4 dodatkowe drużyny z kategorii MIDDLE do OUT"),
});

export const updatePickemDeadlineSchema = z.object({
  deadlineAt: z.string().datetime("Niepoprawny format daty deadline"),
});

