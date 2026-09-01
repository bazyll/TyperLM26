import { z } from "zod";

export const createPlayerSchema = z.object({
  name: z.string().trim().min(2, "Imię i nazwisko musi mieć minimum 2 znaki"),
  teamId: z.string().uuid("Wybierz poprawny klub"),
});

export const updatePlayerSchema = createPlayerSchema.extend({
  id: z.string().uuid("Niepoprawne ID zawodnika"),
  isActive: z.boolean().default(true),
});
