import { createClient } from "./client";

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface AvatarUploadResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
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
    const supabase = createClient();
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

    // Get URL
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

    return {
      success: true,
      avatarUrl: data.publicUrl,
    };
  } catch (err) {
    console.error("Unexpected upload error:", err);
    return { success: false, error: "Wystąpił nieoczekiwany błąd podczas przesyłania avatara." };
  }
}
