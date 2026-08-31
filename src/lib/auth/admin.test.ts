import { describe, it, expect } from "vitest";
import { createUserSchema, updateUserSchema } from "./schemas";

describe("Admin User Management Schemas & Guards", () => {
  it("validates valid admin user creation form", () => {
    const data = {
      username: "player10",
      firstName: "Jan",
      lastName: "Kowalski",
      password: "Password2026!",
      role: "user" as const,
    };
    expect(createUserSchema.safeParse(data).success).toBe(true);
  });

  it("rejects user creation with missing name or weak password", () => {
    const data = {
      username: "p1", // too short
      firstName: "",
      lastName: "Kowalski",
      password: "123", // too short
      role: "user" as const,
    };
    expect(createUserSchema.safeParse(data).success).toBe(false);
  });

  it("validates update user schema", () => {
    const data = {
      userId: "123e4567-e89b-12d3-a456-426614174000",
      firstName: "Piotr",
      lastName: "Nowak",
      username: "pnowak",
      isActive: false, // deactivation
    };
    expect(updateUserSchema.safeParse(data).success).toBe(true);
  });
});
