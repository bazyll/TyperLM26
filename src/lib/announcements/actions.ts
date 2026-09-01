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
  addCommentSchema,
  updateCommentSchema,
} from "./schemas";
import { AnnouncementItem, AnnouncementCommentItem } from "@/types";
import { Database } from "@/types/database.types";

type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
type CommentRow = Database["public"]["Tables"]["announcement_comments"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Fetches all announcements with comment count and author metadata (pinned first, newest first)
 */
export async function getAnnouncementsAction(): Promise<AnnouncementItem[]> {
  const supabase = await createClient();

  const { data: rawAnnouncements, error } = await supabase
    .from("announcements")
    .select(`
      *,
      author:profiles!announcements_author_id_fkey(username, first_name, last_name, avatar_url),
      comments:announcement_comments(id)
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
      comments?: { id: string }[];
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
    commentsCount: Array.isArray(a.comments) ? a.comments.length : 0,
  }));
}

/**
 * Fetches single announcement with its nested comments
 */
export async function getAnnouncementDetailAction(id: string): Promise<AnnouncementItem | null> {
  const supabase = await createClient();
  const currentUser = await getCurrentUserProfile();

  const { data: rawItem, error } = await supabase
    .from("announcements")
    .select(`
      *,
      author:profiles!announcements_author_id_fkey(username, first_name, last_name, avatar_url)
    `)
    .eq("id", id)
    .single();

  if (error || !rawItem) return null;

  const a = rawItem as unknown as AnnouncementRow & { author?: ProfileRow | null };

  // Fetch comments
  const { data: rawComments } = await supabase
    .from("announcement_comments")
    .select(`
      *,
      user:profiles!announcement_comments_user_id_fkey(username, first_name, last_name, avatar_url)
    `)
    .eq("announcement_id", id)
    .order("created_at", { ascending: true });

  const commentsList = (rawComments as unknown as Array<CommentRow & { user?: ProfileRow | null }> || []).map((c) => ({
    id: c.id,
    announcementId: c.announcement_id,
    userId: c.user_id,
    userName: c.user ? `${c.user.first_name} ${c.user.last_name}` : "Użytkownik",
    userAvatarUrl: c.user?.avatar_url || null,
    content: c.content,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    isOwner: currentUser?.id === c.user_id,
  }));

  return {
    id: a.id,
    authorId: a.author_id,
    authorName: a.author ? `${a.author.first_name} ${a.author.last_name}` : "Organizator",
    authorAvatarUrl: a.author?.avatar_url || null,
    title: a.title,
    content: a.content,
    isPinned: a.is_pinned,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    commentsCount: commentsList.length,
    comments: commentsList,
  };
}

/**
 * Server Action: Admin creates announcement
 */
export async function adminCreateAnnouncementAction(
  input: z.infer<typeof createAnnouncementSchema>
): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = createAnnouncementSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

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
  const admin = await requireAdminRole();

  const parsed = updateAnnouncementSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

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
  const admin = await requireAdminRole();
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
 * Server Action: Add comment to announcement (with PostgreSQL rate limiting)
 */
export async function addCommentAction(input: z.infer<typeof addCommentSchema>): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { announcementId, content } = parsed.data;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    // 1. Rate limiting check in PostgreSQL (max 5 comments per 30 seconds)
    const { data: limitCheck, error: rpcErr } = await adminSupabase.rpc("check_and_record_comment_attempt", {
      p_user_id: currentUser.id,
      p_max_attempts: 5,
      p_window_seconds: 30,
    });

    if (rpcErr) {
      console.error("Comment rate limit error:", rpcErr);
    }

    if (limitCheck && limitCheck[0] && !limitCheck[0].is_allowed) {
      const wait = limitCheck[0].remaining_seconds || 30;
      return { success: false, error: `Zbyt wiele komentarzy. Odczekaj ${wait}s przed kolejnym.` };
    }

    // 2. Insert comment (guarded by RLS)
    const { error: insErr } = await (supabase.from("announcement_comments") as unknown as {
      insert: (values: Record<string, unknown>) => Promise<{ error: unknown }>;
    }).insert({
      announcement_id: announcementId,
      user_id: currentUser.id,
      content,
    });

    if (insErr) {
      console.error("Error adding comment:", insErr);
      return { success: false, error: "Nie udało się dodać komentarza." };
    }

    revalidatePath("/ogloszenia");
    return { success: true };
  } catch (err) {
    console.error("Unexpected error adding comment:", err);
    return { success: false, error: "Wystąpił błąd podczas dodawania komentarza." };
  }
}

/**
 * Server Action: Edit own comment (Requirement #9)
 */
export async function updateCommentAction(input: z.infer<typeof updateCommentSchema>): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const parsed = updateCommentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { commentId, content } = parsed.data;
  const supabase = await createClient();

  try {
    const { error } = await (supabase.from("announcement_comments") as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => { eq: (col: string, val: string) => Promise<{ error: unknown }> };
      };
    })
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Error updating comment:", error);
      return { success: false, error: "Nie udało się zaktualizować komentarza." };
    }

    revalidatePath("/ogloszenia");
    return { success: true };
  } catch (err) {
    console.error("Unexpected error updating comment:", err);
    return { success: false, error: "Wystąpił błąd podczas edycji komentarza." };
  }
}

/**
 * Server Action: Delete comment (own comment or admin moderation)
 */
export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("announcement_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error("Error deleting comment:", error);
      return { success: false, error: "Nie udało się usunąć komentarza." };
    }

    revalidatePath("/ogloszenia");
    return { success: true };
  } catch (err) {
    console.error("Unexpected error deleting comment:", err);
    return { success: false, error: "Wystąpił błąd podczas usuwania komentarza." };
  }
}
