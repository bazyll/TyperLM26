import { createClient as createBrowserClient } from "./client";

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface AvatarUploadResult {
  success: boolean;
  avatarPath?: string;
  avatarUrl?: string;
  error?: string;
}

/**
 * Extracts clean relative storage path (e.g., "userId/avatar_123.jpg")
 * from either a clean path, a legacy public URL, or a legacy signed URL with ?token=...
 */
export function extractAvatarPath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  // Clean relative path without protocol or leading slashes (e.g., "user-123/avatar_1725.webp")
  if (!trimmed.includes("://") && !trimmed.startsWith("/")) {
    const clean = trimmed.split("?")[0].split("#")[0].trim();
    return clean.length > 0 ? clean : null;
  }

  // Legacy URL containing /avatars/
  const match = trimmed.match(/\/avatars\/([^?#]+)/);
  if (match && match[1]) {
    const decoded = decodeURIComponent(match[1]).trim();
    return decoded.length > 0 ? decoded : null;
  }

  return null;
}

async function getSupabaseStorageClient() {
  if (typeof window === "undefined") {
    const { createAdminClient } = await import("./admin");
    return createAdminClient();
  }
  return createBrowserClient();
}

/**
 * Resolves a short-lived signed URL (default 3600 seconds = 1 hour) for an avatar path.
 */
export async function getAvatarSignedUrl(
  pathOrUrl: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  const path = extractAvatarPath(pathOrUrl);
  if (!path) return null;

  try {
    const supabase = await getSupabaseStorageClient();
    const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Batch resolves short-lived signed URLs for multiple avatar paths in a single storage request.
 */
export async function getAvatarSignedUrls(
  pathsOrUrls: Array<string | null | undefined>,
  expiresIn = 3600
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const validEntries = pathsOrUrls
    .map((raw) => ({ raw: raw || "", clean: extractAvatarPath(raw) }))
    .filter((entry): entry is { raw: string; clean: string } => Boolean(entry.clean));

  if (validEntries.length === 0) return urlMap;

  const uniquePaths = Array.from(new Set(validEntries.map((e) => e.clean)));

  try {
    const supabase = await getSupabaseStorageClient();
    const { data, error } = await supabase.storage.from("avatars").createSignedUrls(uniquePaths, expiresIn);
    if (!error && Array.isArray(data)) {
      const pathMap = new Map<string, string>();
      data.forEach((item) => {
        if (item.signedUrl && !item.error) {
          pathMap.set(item.path, item.signedUrl);
        }
      });
      validEntries.forEach(({ raw, clean }) => {
        const signed = pathMap.get(clean);
        if (signed) {
          urlMap.set(raw, signed);
          urlMap.set(clean, signed);
        }
      });
    }
  } catch (err) {
    console.warn("Error batch resolving avatar signed URLs:", err);
  }

  return urlMap;
}

/**
 * Validates and uploads avatar to Supabase Storage in user's isolated folder.
 */
export async function uploadAvatar(userId: string, file: File): Promise<AvatarUploadResult> {
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Niedozwolony format pliku. Dozwolone formaty: JPG, PNG, WebP.",
    };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      success: false,
      error: "Plik jest zbyt duży. Maksymalny dopuszczalny rozmiar to 2 MB.",
    };
  }

  try {
    const supabase = createBrowserClient();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const filePath = `${userId}/avatar_${Date.now()}.${extension}`;

    // Upload to 'avatars' bucket
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { success: false, error: "Błąd podczas przesyłania zdjęcia do pamięci." };
    }

    // Generate short-lived signed URL for immediate UI preview (1h TTL)
    const { data: signData } = await supabase.storage
      .from("avatars")
      .createSignedUrl(filePath, 3600);

    return {
      success: true,
      avatarPath: filePath,
      avatarUrl: signData?.signedUrl || undefined,
    };
  } catch (err) {
    console.error("Unexpected upload error:", err);
    return { success: false, error: "Wystąpił nieoczekiwany błąd podczas przesyłania avatara." };
  }
}
