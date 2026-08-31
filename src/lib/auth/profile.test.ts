import { describe, it, expect } from "vitest";
import { usernameSchema } from "./schemas";

describe("Profile & Username Validation Logic", () => {
  it("normalizes and validates username change inputs", () => {
    const input = "  NewUser_2026  ";
    const parsed = usernameSchema.safeParse(input.trim());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.toLowerCase()).toBe("newuser_2026");
    }
  });

  it("rejects username with unauthorized symbols", () => {
    expect(usernameSchema.safeParse("user<script>").success).toBe(false);
    expect(usernameSchema.safeParse("user'--").success).toBe(false);
  });
});
