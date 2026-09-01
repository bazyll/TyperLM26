"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/auth/actions";
import { ActionResult } from "@/lib/auth/schemas";
import { Database } from "@/types/database.types";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

export const createPlayerSchema = z.object({
  name: z.string().trim().min(2, "Imię i nazwisko musi mieć minimum 2 znaki"),
  teamId: z.string().uuid("Wybierz poprawny klub"),
});

export const updatePlayerSchema = createPlayerSchema.extend({
  id: z.string().uuid("Niepoprawne ID zawodnika"),
  isActive: z.boolean().default(true),
});

/**
 * Fetches all players (for admin management and user dropdowns)
 */
export async function getAllPlayersAction(includeInactive = false): Promise<PlayerRow[]> {
  const supabase = await createClient();

  let query = supabase.from("players").select("*").order("name", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data: rawPlayers, error } = await query;
  if (error || !rawPlayers) {
    console.error("Error fetching players:", error);
    return [];
  }

  return (rawPlayers || []) as unknown as PlayerRow[];
}

/**
 * Server Action: Admin creates player
 */
export async function adminCreatePlayerAction(input: z.infer<typeof createPlayerSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = createPlayerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { name, teamId } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { data: newPlayer, error } = await adminSupabase
      .from("players")
      .insert({
        name,
        team_id: teamId,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "PLAYER_CREATED",
      target_type: "player",
      target_id: newPlayer?.id || null,
      details: { name, teamId },
    });

    revalidatePath("/admin");
    revalidatePath("/typy-specjalne");
    return { success: true };
  } catch (err) {
    console.error("Error creating player:", err);
    return { success: false, error: "Nie udało się dodać zawodnika." };
  }
}

/**
 * Server Action: Admin updates player (name, team, active status)
 */
export async function adminUpdatePlayerAction(input: z.infer<typeof updatePlayerSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = updatePlayerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { id, name, teamId, isActive } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { error } = await adminSupabase
      .from("players")
      .update({
        name,
        team_id: teamId,
        is_active: isActive,
      })
      .eq("id", id);

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "PLAYER_UPDATED",
      target_type: "player",
      target_id: id,
      details: { name, teamId, isActive },
    });

    revalidatePath("/admin");
    revalidatePath("/typy-specjalne");
    return { success: true };
  } catch (err) {
    console.error("Error updating player:", err);
    return { success: false, error: "Nie udało się zaktualizować zawodnika." };
  }
}

/**
 * Server Action: Admin soft-deactivates player (preserves historical prediction integrity)
 */
export async function adminTogglePlayerActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  try {
    const { error } = await adminSupabase
      .from("players")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: isActive ? "PLAYER_ACTIVATED" : "PLAYER_DEACTIVATED",
      target_type: "player",
      target_id: id,
    });

    revalidatePath("/admin");
    revalidatePath("/typy-specjalne");
    return { success: true };
  } catch (err) {
    console.error("Error toggling player active:", err);
    return { success: false, error: "Nie udało się zmienić statusu zawodnika." };
  }
}
