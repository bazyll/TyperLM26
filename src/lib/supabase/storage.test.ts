import { describe, it, expect } from "vitest";
import { ALLOWED_AVATAR_MIME_TYPES, MAX_AVATAR_SIZE_BYTES } from "./storage";

describe("Storage Avatar Validation Rules", () => {
  it("enforces allowed MIME types whitelist (JPG, PNG, WebP)", () => {
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/jpeg")).toBe(true);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/png")).toBe(true);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/webp")).toBe(true);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/gif")).toBe(false);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("application/pdf")).toBe(false);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("text/html")).toBe(false);
  });

  it("enforces 2MB maximum file size limit", () => {
    expect(MAX_AVATAR_SIZE_BYTES).toBe(2097152); // exactly 2 * 1024 * 1024
  });
});
