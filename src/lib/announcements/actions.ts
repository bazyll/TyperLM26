"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile, requireAdminRole } from "@/lib/auth/actions";
import { ActionResult } from "@/lib/auth/schemas";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "./schemas";
import { AnnouncementItem } from "@/types";
import { Database } from "@/types/database.types";

type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Fetches all announcements with author metadata (pinned first, newest first)
 * No comments are fetched.
 */
export async function getAnnouncementsAction(): Promise<AnnouncementItem[]> {
  const supabase = await createClient();

  const { data: rawAnnouncements, error } = await supabase
    .from("announcements")
    .select(`
      *,
      author:profiles!announcements_author_id_fkey(username, first_name, last_name, avatar_url)
    `)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !rawAnnouncements) {
    console.error("Error fetching announcements:", error);
    return [];
  }

  const items = rawAnnouncements as unknown as Array<
    AnnouncementRow & {
      author?: ProfileRow | null;
    }
  >;

  return items.map((a) => ({
    id: a.id,
    authorId: a.author_id,
    authorName: a.author ? `${a.author.first_name} ${a.author.last_name}` : "Organizator",
    authorAvatarUrl: a.author?.avatar_url || null,
    title: a.title,
    content: a.content,
    isPinned: a.is_pinned,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }));
}

/**
 * Calculates unread announcements count for the current user
 * Based strictly on announcement.created_at > user.announcements_last_seen_at
 */
export async function getUnreadAnnouncementsCountAction(): Promise<number> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return 0;

  const supabase = await createClient();

  let query = supabase
    .from("announcements")
    .select("*", { count: "exact", head: true });

  if (currentUser.announcementsLastSeenAt) {
    query = query.gt("created_at", currentUser.announcementsLastSeenAt);
  }

  const { count, error } = await query;
  if (error) {
    console.error("Error fetching unread announcements count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Marks announcements as seen for the current user up to the latest announcement in the feed (MAX created_at)
 * Server-side safely caps the timestamp so clients cannot set arbitrary future times.
 */
export async function markAnnouncementsAsSeenAction(upToCreatedAt?: string): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) {
    return { success: false, error: "Wymagane logowanie." };
  }

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    // 1. Fetch the latest actual announcement created_at from DB
    const { data: latestAnnRaw } = await supabase
      .from("announcements")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestAnn = latestAnnRaw as { created_at: string } | null;

    if (!latestAnn?.created_at) {
      // No announcements exist in DB
      return { success: true };
    }

    const maxDbTime = new Date(latestAnn.created_at).getTime();
    let targetTimestamp = latestAnn.created_at;

    // If client supplied upToCreatedAt from rendered feed, ensure it does not exceed DB's max created_at
    if (upToCreatedAt) {
      const clientTime = new Date(upToCreatedAt).getTime();
      if (!isNaN(clientTime) && clientTime <= maxDbTime) {
        targetTimestamp = upToCreatedAt;
      }
    }

    // Only update if targetTimestamp is strictly newer than user's current announcements_last_seen_at
    if (currentUser.announcementsLastSeenAt) {
      const currentSeenTime = new Date(currentUser.announcementsLastSeenAt).getTime();
      const targetTime = new Date(targetTimestamp).getTime();
      if (currentSeenTime >= targetTime) {
        return { success: true };
      }
    }

    const { error } = await adminSupabase
      .from("profiles")
      .update({
        announcements_last_seen_at: targetTimestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentUser.id);

    if (error) throw error;

    revalidatePath("/ogloszenia");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Error marking announcements as seen:", err);
    return { success: false, error: "Nie udało się zaktualizować statusu przeczytania." };
  }
}

/**
 * Server Action: Admin creates announcement
 */
export async function adminCreateAnnouncementAction(
  input: z.infer<typeof createAnnouncementSchema>
): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdminRole();
  } catch (err: any) {
    return { success: false, error: err.message || "Brak uprawnień administratora." };
  }

  const parsed = createAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane ogłoszenia." };
  }

  const { title, content, isPinned } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { data: newAnn, error } = await adminSupabase
      .from("announcements")
      .insert({
        author_id: admin.id,
        title,
        content,
        is_pinned: isPinned,
      })
      .select("id")
      .single();

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "ANNOUNCEMENT_CREATED",
      target_type: "announcement",
      target_id: newAnn?.id || null,
      details: { title, isPinned },
    });

    revalidatePath("/ogloszenia");
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Error creating announcement:", err);
    return { success: false, error: "Nie udało się utworzyć ogłoszenia." };
  }
}

/**
 * Server Action: Admin updates announcement
 */
export async function adminUpdateAnnouncementAction(
  input: z.infer<typeof updateAnnouncementSchema>
): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdminRole();
  } catch (err: any) {
    return { success: false, error: err.message || "Brak uprawnień administratora." };
  }

  const parsed = updateAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane ogłoszenia." };
  }

  const { id, title, content, isPinned } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { error } = await adminSupabase
      .from("announcements")
      .update({
        title,
        content,
        is_pinned: isPinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "ANNOUNCEMENT_UPDATED",
      target_type: "announcement",
      target_id: id,
      details: { title, isPinned },
    });

    revalidatePath("/ogloszenia");
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Error updating announcement:", err);
    return { success: false, error: "Nie udało się zaktualizować ogłoszenia." };
  }
}

/**
 * Server Action: Admin deletes announcement
 */
export async function adminDeleteAnnouncementAction(id: string): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdminRole();
  } catch (err: any) {
    return { success: false, error: err.message || "Brak uprawnień administratora." };
  }

  const adminSupabase = createAdminClient();

  try {
    const { error } = await adminSupabase.from("announcements").delete().eq("id", id);
    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "ANNOUNCEMENT_DELETED",
      target_type: "announcement",
      target_id: id,
    });

    revalidatePath("/ogloszenia");
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Error deleting announcement:", err);
    return { success: false, error: "Nie udało się usunąć ogłoszenia." };
  }
}

/**
 * Server Action: Admin toggles pin status
 */
export async function adminTogglePinAnnouncementAction(id: string, isPinned: boolean): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdminRole();
  } catch (err: any) {
    return { success: false, error: err.message || "Brak uprawnień administratora." };
  }

  const adminSupabase = createAdminClient();

  try {
    const { error } = await adminSupabase
      .from("announcements")
      .update({
        is_pinned: isPinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: isPinned ? "ANNOUNCEMENT_PINNED" : "ANNOUNCEMENT_UNPINNED",
      target_type: "announcement",
      target_id: id,
      details: { isPinned },
    });

    revalidatePath("/ogloszenia");
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Error toggling pin status:", err);
    return { success: false, error: "Nie udało się zmienić statusu przypięcia." };
  }
}
