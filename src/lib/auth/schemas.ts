import { z } from "zod";

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const usernameSchema = z
  .string()
  .min(3, "Login musi mieć co najmniej 3 znaki.")
  .max(30, "Login może mieć maksymalnie 30 znaków.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Login może zawierać tylko litery, cyfry, myślniki i podkreślenia.");

export const passwordSchema = z
  .string()
  .min(8, "Hasło musi mieć co najmniej 8 znaków.")
  .max(100, "Hasło jest zbyt długie.");

export const loginSchema = z.object({
  username: z.string().min(1, "Wprowadź login."),
  password: z.string().min(1, "Wprowadź hasło."),
});

export const createUserSchema = z.object({
  username: usernameSchema,
  firstName: z.string().min(1, "Wprowadź imię.").max(50),
  lastName: z.string().min(1, "Wprowadź nazwisko.").max(50),
  password: passwordSchema,
  role: z.enum(["user", "admin"]).default("user"),
});

export const updateUserSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  username: usernameSchema,
  isActive: z.boolean(),
});

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}
