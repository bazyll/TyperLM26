import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Tytuł musi mieć minimum 3 znaki")
    .max(120, "Tytuł może mieć maksymalnie 120 znaków"),
  content: z
    .string()
    .trim()
    .min(5, "Treść musi mieć minimum 5 znaków")
    .max(5000, "Treść może mieć maksymalnie 5000 znaków"),
  isPinned: z.boolean().default(false),
});

export const updateAnnouncementSchema = createAnnouncementSchema.extend({
  id: z.string().uuid("Niepoprawne ID ogłoszenia"),
});
