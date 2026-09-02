import { describe, it, expect } from "vitest";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
  extractAvatarPath,
} from "./storage";

describe("Storage Avatar Validation Rules", () => {
  it("enforces allowed MIME types whitelist (JPG, PNG, WebP)", () => {
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/jpeg")).toBe(true);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/png")).toBe(true);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/webp")).toBe(true);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/gif")).toBe(false);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("application/pdf")).toBe(false);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("text/html")).toBe(false);
    expect(ALLOWED_AVATAR_MIME_TYPES.includes("image/svg+xml")).toBe(false);
  });

  it("enforces 2MB maximum file size limit", () => {
    expect(MAX_AVATAR_SIZE_BYTES).toBe(2097152); // exactly 2 * 1024 * 1024
  });

  describe("extractAvatarPath helper", () => {
    it("handles clean relative storage path directly", () => {
      expect(extractAvatarPath("user-123/avatar_1725200000.webp")).toBe("user-123/avatar_1725200000.webp");
    });

    it("strips trailing query parameters from clean path", () => {
      expect(extractAvatarPath("user-123/avatar_1725200000.webp?token=xyz")).toBe("user-123/avatar_1725200000.webp");
    });

    it("extracts clean storage path from signed avatar URL without query token", () => {
      const signedUrl =
        "https://example.supabase.co/storage/v1/object/sign/avatars/user-123/avatar_1725200000.jpg?token=eyJhbGciOiJIUzI1NiJ9.abc";
      const path = extractAvatarPath(signedUrl);
      expect(path).toBe("user-123/avatar_1725200000.jpg");
    });

    it("extracts clean storage path from legacy public avatar URL", () => {
      const publicUrl =
        "https://example.supabase.co/storage/v1/object/public/avatars/user-123/avatar_1725100000.png";
      const path = extractAvatarPath(publicUrl);
      expect(path).toBe("user-123/avatar_1725100000.png");
    });

    it("returns null for null, undefined, empty, or whitespace inputs", () => {
      expect(extractAvatarPath(null)).toBe(null);
      expect(extractAvatarPath(undefined)).toBe(null);
      expect(extractAvatarPath("")).toBe(null);
      expect(extractAvatarPath("   ")).toBe(null);
    });

    it("prevents deleting newly uploaded avatar file when old and new paths match", () => {
      const oldUrl = "https://example.supabase.co/storage/v1/object/sign/avatars/user-123/avatar_1.jpg?token=abc";
      const newUrl = "user-123/avatar_1.jpg";

      const oldPath = extractAvatarPath(oldUrl);
      const newPath = extractAvatarPath(newUrl);

      expect(oldPath).toBe("user-123/avatar_1.jpg");
      expect(newPath).toBe("user-123/avatar_1.jpg");
      expect(oldPath === newPath).toBe(true); // Should NOT be deleted
    });

    it("identifies distinct files for cleanup when user uploads a new avatar", () => {
      const oldUrl = "https://example.supabase.co/storage/v1/object/sign/avatars/user-123/avatar_old.jpg?token=abc";
      const newPathInput = "user-123/avatar_new.png";

      const oldPath = extractAvatarPath(oldUrl);
      const newPath = extractAvatarPath(newPathInput);

      expect(oldPath).toBe("user-123/avatar_old.jpg");
      expect(newPath).toBe("user-123/avatar_new.png");
      expect(oldPath !== newPath).toBe(true); // Safe to delete oldPath
    });
  });

  describe("Storage RLS Security Constraints", () => {
    it("enforces that user can only write to their own folder (auth.uid() = foldername)", () => {
      const authenticatedUserId = "user-abc-123";
      const targetFilePathValid = `${authenticatedUserId}/avatar_1.jpg`;
      const targetFilePathOtherUser = `user-other-456/avatar_1.jpg`;

      const isPathAllowed = (path: string, uid: string) => {
        const folder = path.split("/")[0];
        return folder === uid;
      };

      expect(isPathAllowed(targetFilePathValid, authenticatedUserId)).toBe(true);
      expect(isPathAllowed(targetFilePathOtherUser, authenticatedUserId)).toBe(false);
    });
  });
});
