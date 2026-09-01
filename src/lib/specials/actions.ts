"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile, requireAdminRole } from "@/lib/auth/actions";
import { ActionResult } from "@/lib/auth/schemas";
import {
  saveSpecialPredictionSchema,
  saveAllSpecialPredictionsSchema,
  updateSpecialDeadlineSchema,
  settleSpecialCategorySchema,
} from "./schemas";
import { SpecialCategoryWithPrediction } from "@/types";
import { Database } from "@/types/database.types";

type CategoryRow = Database["public"]["Tables"]["special_prediction_categories"]["Row"];
type SpecialPredictionRow = Database["public"]["Tables"]["special_predictions"]["Row"];
type CorrectAnswerRow = Database["public"]["Tables"]["special_prediction_correct_answers"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Fetches all 6 special prediction categories with current user's predictions
 * and revealed predictions of other players after deadline.
 */
export async function getSpecialCategoriesWithPredictionsAction(): Promise<SpecialCategoryWithPrediction[]> {
  const supabase = await createClient();
  const currentUser = await getCurrentUserProfile();

  // 1. Fetch categories
  const { data: rawCategories, error: catError } = await supabase
    .from("special_prediction_categories")
    .select("*")
    .order("created_at", { ascending: true });

  if (catError || !rawCategories) {
    console.error("Error fetching special categories:", catError);
    return [];
  }

  const categories = rawCategories as unknown as CategoryRow[];

  // 2. Fetch all teams and players for naming
  const [{ data: rawTeams }, { data: rawPlayers }] = await Promise.all([
    supabase.from("teams").select("id, name, short_name, code, logo_url"),
    supabase.from("players").select("id, name, team_id"),
  ]);

  const teamsMap = new Map<string, { name: string; logoUrl: string }>();
  (rawTeams as unknown as TeamRow[] || []).forEach((t) => {
    teamsMap.set(t.id, { name: t.name, logoUrl: t.logo_url });
  });

  const playersMap = new Map<string, { name: string }>();
  (rawPlayers as unknown as PlayerRow[] || []).forEach((p) => {
    playersMap.set(p.id, { name: p.name });
  });

  // 3. Fetch correct answers for settled categories
  const { data: rawAnswers } = await supabase
    .from("special_prediction_correct_answers")
    .select("*");

  const answersMap = new Map<string, CorrectAnswerRow[]>();
  (rawAnswers as unknown as CorrectAnswerRow[] || []).forEach((a) => {
    const list = answersMap.get(a.category_id) || [];
    list.push(a);
    answersMap.set(a.category_id, list);
  });

  // 4. Fetch all accessible predictions
  const { data: rawPredictions } = await supabase
    .from("special_predictions")
    .select(`
      *,
      profile:profiles(*)
    `);

  const predictions = (rawPredictions || []) as unknown as Array<SpecialPredictionRow & { profile: ProfileRow }>;
  const predMap = new Map<string, Array<SpecialPredictionRow & { profile: ProfileRow }>>();
  predictions.forEach((p) => {
    const list = predMap.get(p.category_id) || [];
    list.push(p);
    predMap.set(p.category_id, list);
  });

  return categories.map((cat) => {
    const categoryPreds = predMap.get(cat.id) || [];
    const myPred = currentUser ? categoryPreds.find((p) => p.user_id === currentUser.id) : undefined;

    const correctList = (answersMap.get(cat.id) || []).map((ans) => {
      const team = ans.team_id ? teamsMap.get(ans.team_id) : undefined;
      const player = ans.player_id ? playersMap.get(ans.player_id) : undefined;
      return {
        teamId: ans.team_id,
        teamName: team?.name,
        teamLogo: team?.logoUrl,
        playerId: ans.player_id,
        playerName: player?.name,
      };
    });

    const userPred = myPred
      ? {
          id: myPred.id,
          selectedTeamId: myPred.selected_team_id,
          selectedTeamName: myPred.selected_team_id ? teamsMap.get(myPred.selected_team_id)?.name : undefined,
          selectedTeamLogo: myPred.selected_team_id ? teamsMap.get(myPred.selected_team_id)?.logoUrl : undefined,
          selectedPlayerId: myPred.selected_player_id,
          selectedPlayerName: myPred.selected_player_id ? playersMap.get(myPred.selected_player_id)?.name : undefined,
          pointsAwarded: myPred.points_awarded,
        }
      : undefined;

    const allPreds = categoryPreds.map((p) => {
      const prof = p.profile as ProfileRow | undefined;
      return {
        userId: p.user_id,
        username: prof?.username || "gracz",
        firstName: prof?.first_name || "Gracz",
        lastName: prof?.last_name || "",
        avatarUrl: prof?.avatar_url || null,
        selectedTeamId: p.selected_team_id,
        selectedTeamName: p.selected_team_id ? teamsMap.get(p.selected_team_id)?.name : undefined,
        selectedPlayerId: p.selected_player_id,
        selectedPlayerName: p.selected_player_id ? playersMap.get(p.selected_player_id)?.name : undefined,
        pointsAwarded: p.points_awarded,
      };
    });

    return {
      id: cat.id,
      slug: cat.slug,
      title: cat.title,
      description: cat.description,
      targetType: cat.target_type,
      pointsValue: cat.points_value,
      deadlineAt: cat.deadline_at,
      status: cat.status,
      isLocked: cat.is_locked,
      correctAnswers: correctList.length > 0 ? correctList : undefined,
      userPrediction: userPred,
      allPredictions: allPreds.length > 0 ? allPreds : undefined,
    };
  });
}

/**
 * Server Action: Save single special prediction
 */
export async function saveSpecialPredictionAction(
  input: z.infer<typeof saveSpecialPredictionSchema>
): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const parsed = saveSpecialPredictionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { categoryId, selectedTeamId, selectedPlayerId } = parsed.data;
  const supabase = await createClient();

  try {
    // 1. Fetch category to verify deadline and entity type
    const { data: rawCategory, error: catErr } = await supabase
      .from("special_prediction_categories")
      .select("*")
      .eq("id", categoryId)
      .single();

    const category = rawCategory as unknown as CategoryRow | null;
    if (catErr || !category) return { success: false, error: "Nie znaleziono kategorii." };

    if (new Date(category.deadline_at).getTime() <= Date.now() || category.is_locked) {
      return { success: false, error: "Czas na typowanie tej kategorii już minął." };
    }

    if (category.target_type === "team" && (!selectedTeamId || selectedPlayerId)) {
      return { success: false, error: "Wybierz drużynę dla tej kategorii." };
    }
    if (category.target_type === "player" && (!selectedPlayerId || selectedTeamId)) {
      return { success: false, error: "Wybierz zawodnika dla tej kategorii." };
    }

    // 2. Perform upsert
    const { error: upsertErr } = await (supabase.from("special_predictions") as unknown as {
      upsert: (values: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: unknown }>;
    }).upsert(
      {
        user_id: currentUser.id,
        category_id: categoryId,
        selected_team_id: selectedTeamId || null,
        selected_player_id: selectedPlayerId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category_id" }
    );

    if (upsertErr) {
      console.error("Special prediction upsert error:", upsertErr);
      return { success: false, error: "Nie udało się zapisać typu." };
    }

    revalidatePath("/typy-specjalne");
    revalidatePath("/ranking");
    revalidatePath("/konto");
    return { success: true };
  } catch (err) {
    console.error("Unexpected error saving special prediction:", err);
    return { success: false, error: "Wystąpił błąd podczas zapisywania typu." };
  }
}

/**
 * Server Action: Save batch of special predictions with winner/finalist distinctness check
 */
export async function saveAllSpecialPredictionsAction(
  input: z.infer<typeof saveAllSpecialPredictionsSchema>
): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const parsed = saveAllSpecialPredictionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { predictions } = parsed.data;
  const supabase = await createClient();

  try {
    const { data: rawCategories } = await supabase.from("special_prediction_categories").select("*");
    const categories = (rawCategories || []) as unknown as CategoryRow[];
    const catMap = new Map<string, CategoryRow>();
    categories.forEach((c) => catMap.set(c.id, c));

    // Check winner vs finalist collision
    const winnerCat = categories.find((c) => c.slug === "winner");
    const finalistCat = categories.find((c) => c.slug === "finalist");

    const winnerPred = winnerCat ? predictions.find((p) => p.categoryId === winnerCat.id) : undefined;
    const finalistPred = finalistCat ? predictions.find((p) => p.categoryId === finalistCat.id) : undefined;

    if (
      winnerPred?.selectedTeamId &&
      finalistPred?.selectedTeamId &&
      winnerPred.selectedTeamId === finalistPred.selectedTeamId
    ) {
      return {
        success: false,
        error: "Ta sama drużyna nie może być jednocześnie wybrana jako Zwycięzca i Finalista.",
      };
    }

    for (const pred of predictions) {
      const cat = catMap.get(pred.categoryId);
      if (!cat) continue;

      if (new Date(cat.deadline_at).getTime() <= Date.now() || cat.is_locked) {
        return { success: false, error: `Czas na typowanie kategorii "${cat.title}" już minął.` };
      }

      await (supabase.from("special_predictions") as unknown as {
        upsert: (values: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: unknown }>;
      }).upsert(
        {
          user_id: currentUser.id,
          category_id: pred.categoryId,
          selected_team_id: pred.selectedTeamId || null,
          selected_player_id: pred.selectedPlayerId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,category_id" }
      );
    }

    revalidatePath("/typy-specjalne");
    revalidatePath("/ranking");
    revalidatePath("/konto");
    return { success: true };
  } catch (err) {
    console.error("Error saving special predictions:", err);
    return { success: false, error: "Wystąpił błąd podczas zapisywania typów specjalnych." };
  }
}

/**
 * Server Action: Admin updates category deadline (only allowed before current deadline passed)
 */
export async function adminUpdateSpecialDeadlineAction(
  input: z.infer<typeof updateSpecialDeadlineSchema>
): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = updateSpecialDeadlineSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { categoryId, deadlineAt } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { data: rawCat, error: fetchErr } = await adminSupabase
      .from("special_prediction_categories")
      .select("*")
      .eq("id", categoryId)
      .single();

    const category = rawCat as unknown as CategoryRow | null;
    if (fetchErr || !category) return { success: false, error: "Nie znaleziono kategorii." };

    if (new Date(category.deadline_at).getTime() <= Date.now() || category.is_locked) {
      return {
        success: false,
        error: "Nie można przedłużyć deadline'u po jego upłynięciu (ochrona fair play).",
      };
    }

    const { error: updateErr } = await adminSupabase
      .from("special_prediction_categories")
      .update({ deadline_at: deadlineAt })
      .eq("id", categoryId);

    if (updateErr) throw updateErr;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "SPECIAL_DEADLINE_UPDATED",
      target_type: "special_category",
      target_id: categoryId,
      details: { oldDeadline: category.deadline_at, newDeadline: deadlineAt },
    });

    revalidatePath("/admin");
    revalidatePath("/typy-specjalne");
    return { success: true };
  } catch (err) {
    console.error("Error updating special deadline:", err);
    return { success: false, error: "Nie udało się zaktualizować deadline'u." };
  }
}

/**
 * Server Action: Admin settles special category (with multiple winners support & atomic recalculation)
 */
export async function adminSettleSpecialCategoryAction(
  input: z.infer<typeof settleSpecialCategorySchema>
): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = settleSpecialCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { categoryId, correctTeamIds, correctPlayerIds } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { data: rawCat } = await adminSupabase
      .from("special_prediction_categories")
      .select("*")
      .eq("id", categoryId)
      .single();

    const category = rawCat as unknown as CategoryRow | null;
    if (!category) return { success: false, error: "Nie znaleziono kategorii." };

    if (category.target_type === "team" && correctTeamIds.length === 0) {
      return { success: false, error: "Wskaż przynajmniej jedną zwycięską drużynę." };
    }
    if (category.target_type === "player" && correctPlayerIds.length === 0) {
      return { success: false, error: "Wskaż przynajmniej jednego zwycięskiego zawodnika." };
    }

    const isCorrection = category.status === "settled";

    // Call PostgreSQL atomic settlement procedure
    const { error: rpcError } = await adminSupabase.rpc("settle_special_prediction_category", {
      p_category_id: categoryId,
      p_correct_team_ids: correctTeamIds,
      p_correct_player_ids: correctPlayerIds,
    });

    if (rpcError) {
      console.error("RPC settle_special_prediction_category error:", rpcError);
      throw rpcError;
    }

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: isCorrection ? "SPECIAL_RESULT_CORRECTED" : "SPECIAL_SETTLED",
      target_type: "special_category",
      target_id: categoryId,
      details: {
        categoryTitle: category.title,
        targetType: category.target_type,
        correctTeamIds,
        correctPlayerIds,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/typy-specjalne");
    revalidatePath("/ranking");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Error settling special category:", err);
    return { success: false, error: "Wystąpił błąd podczas rozliczania kategorii specjalnej." };
  }
}
