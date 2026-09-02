"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile, requireAdminRole } from "@/lib/auth/actions";
import { ActionResult } from "@/lib/auth/schemas";
import { savePickemSchema, updatePickemDeadlineSchema } from "./schemas";
import { validatePickemSubmission } from "@/lib/scoring/pickem";
import { calculateUCLTable } from "@/lib/scoring/ucl-table";
import { PickemSubmissionWithDetails, PickemSelectionItem } from "@/types";
import { Database } from "@/types/database.types";
import { getAvatarSignedUrls } from "@/lib/supabase/storage";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type ConfigRow = Database["public"]["Tables"]["pickem_config"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["pickem_submissions"]["Row"];
type SelectionRow = Database["public"]["Tables"]["pickem_selections"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

/**
 * Fetches 36 teams, pickem config, user submission (with selections),
 * and revealed submissions of other players after deadline.
 */
export async function getPickemDataAction(): Promise<{
  config: ConfigRow | null;
  teams: TeamRow[];
  userSubmission: PickemSubmissionWithDetails | null;
  allSubmissions: Array<{
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    pointsAwarded?: number | null;
    firstTeamId?: string;
    top8TeamIds?: string[];
    outTeamIds?: string[];
  }>;
}> {
  const supabase = await createClient();
  const currentUser = await getCurrentUserProfile();

  // 1. Fetch config and all teams
  const [{ data: rawConfig }, { data: rawTeams }] = await Promise.all([
    supabase.from("pickem_config").select("*").maybeSingle(),
    supabase.from("teams").select("*").order("name", { ascending: true }),
  ]);

  const config = rawConfig as unknown as ConfigRow | null;
  const teams = (rawTeams || []) as unknown as TeamRow[];

  // 2. Fetch all accessible submissions for this config
  const subQuery = supabase
    .from("pickem_submissions")
    .select(`
      *,
      profile:profiles(*)
    `);

  if (config) {
    subQuery.eq("config_id", config.id);
  }

  const { data: rawSubmissions } = await subQuery;
  const submissions = (rawSubmissions || []) as unknown as Array<SubmissionRow & { profile: ProfileRow }>;

  // 3. Fetch all accessible selections
  const { data: rawSelections } = await supabase.from("pickem_selections").select("*");
  const selections = (rawSelections || []) as unknown as SelectionRow[];

  const selectionsMap = new Map<string, SelectionRow[]>();
  selections.forEach((s) => {
    const list = selectionsMap.get(s.submission_id) || [];
    list.push(s);
    selectionsMap.set(s.submission_id, list);
  });

  const teamMap = new Map<string, TeamRow>();
  teams.forEach((t) => teamMap.set(t.id, t));

  // Build user submission
  let userSubmission: PickemSubmissionWithDetails | null = null;
  const mySub = currentUser ? submissions.find((s) => s.user_id === currentUser.id) : undefined;

  if (mySub) {
    const mySelections = selectionsMap.get(mySub.id) || [];
    const firstSel = mySelections.find((s) => s.category === "first");
    const top8Sels = mySelections.filter((s) => s.category === "top8");
    const outSels = mySelections.filter((s) => s.category === "out");

    const items: PickemSelectionItem[] = mySelections.map((s) => {
      const t = teamMap.get(s.team_id);
      const cat = s.category;
      return {
        id: s.id,
        submissionId: s.submission_id,
        teamId: s.team_id,
        teamName: t?.name || "Nieznana drużyna",
        teamCode: t?.code || "???",
        teamLogoUrl: t?.logo_url || "",
        category: cat as "first" | "top8" | "out" | "middle",
      };
    });

    userSubmission = {
      id: mySub.id,
      userId: mySub.user_id,
      pointsAwarded: mySub.points_awarded,
      firstTeamId: firstSel?.team_id,
      top8TeamIds: top8Sels.map((s) => s.team_id),
      outTeamIds: outSels.map((s) => s.team_id),
      selections: items,
    };
  }

  // Build revealed submissions list
  const subRawAvatars = submissions.map((s) => (s.profile as ProfileRow | undefined)?.avatar_url);
  const subAvatarUrls = await getAvatarSignedUrls(subRawAvatars, 3600);

  const allSubmissions = submissions.map((sub) => {
    const subSels = selectionsMap.get(sub.id) || [];
    const firstSel = subSels.find((s) => s.category === "first");
    const top8Sels = subSels.filter((s) => s.category === "top8");
    const outSels = subSels.filter((s) => s.category === "out");

    const prof = sub.profile as ProfileRow | undefined;
    const signedAvatar = prof?.avatar_url ? subAvatarUrls.get(prof.avatar_url) || null : null;

    return {
      userId: sub.user_id,
      username: prof?.username || "gracz",
      firstName: prof?.first_name || "Gracz",
      lastName: prof?.last_name || "",
      avatarUrl: signedAvatar,
      pointsAwarded: sub.points_awarded,
      firstTeamId: firstSel?.team_id,
      top8TeamIds: top8Sels.map((s) => s.team_id),
      outTeamIds: outSels.map((s) => s.team_id),
    };
  });

  return {
    config,
    teams,
    userSubmission,
    allSubmissions,
  };
}

/**
 * Server Action: Save or update Pick'em submission into normalized tables
 */
export async function savePickemSubmissionAction(
  input: z.infer<typeof savePickemSchema>
): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const parsed = savePickemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { firstTeamId, top8TeamIds, outTeamIds } = parsed.data;

  // Validate disjointness
  const validation = validatePickemSubmission({ firstTeamId, top8TeamIds, outTeamIds });
  if (!validation.isValid) {
    return { success: false, error: validation.errors[0] };
  }

  const supabase = await createClient();

  try {
    // 1. Verify deadline & lock
    const { data: rawConfig, error: cfgErr } = await supabase
      .from("pickem_config")
      .select("*")
      .maybeSingle();

    const config = rawConfig as unknown as ConfigRow | null;
    if (cfgErr || !config) {
      return { success: false, error: "Pick'em nie został jeszcze skonfigurowany przez administratora." };
    }

    if (new Date(config.deadline_at).getTime() <= Date.now() || config.is_locked) {
      return { success: false, error: "Czas na zapisanie typów Pick'em już minął." };
    }

    // 2. Upsert submission row explicitly with config_id and UNIQUE(user_id, config_id)
    const { data: rawSub, error: subErr } = await (supabase.from("pickem_submissions") as unknown as {
      upsert: (values: Record<string, unknown>, opts: { onConflict: string }) => {
        select: (cols: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> };
      };
    })
      .upsert(
        {
          user_id: currentUser.id,
          config_id: config.id,
          first_team_id: firstTeamId,
          top8_team_ids: top8TeamIds,
          out_team_ids: outTeamIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,config_id" }
      )
      .select("id")
      .single();

    if (subErr || !rawSub) {
      console.error("Error upserting pickem submission:", subErr);
      return { success: false, error: "Nie udało się zapisać wyboru Pick'em." };
    }

    const submissionId = rawSub.id;

    // 3. Replace selections in pickem_selections normalized table
    await supabase.from("pickem_selections").delete().eq("submission_id", submissionId);

    const selectionsToInsert = [
      { submission_id: submissionId, team_id: firstTeamId, category: "first" },
      ...top8TeamIds.map((tid) => ({ submission_id: submissionId, team_id: tid, category: "top8" })),
      ...outTeamIds.map((tid) => ({ submission_id: submissionId, team_id: tid, category: "out" })),
    ];

    const { error: insErr } = await (supabase.from("pickem_selections") as unknown as {
      insert: (values: Record<string, unknown>[]) => Promise<{ error: unknown }>;
    }).insert(selectionsToInsert);
    if (insErr) {
      console.error("Error inserting pickem selections:", insErr);
      return { success: false, error: "Błąd podczas zapisywania poszczególnych drużyn." };
    }

    revalidatePath("/pickem");
    revalidatePath("/ranking");
    revalidatePath("/konto");
    return { success: true };
  } catch (err) {
    console.error("Unexpected error saving pickem:", err);
    return { success: false, error: "Wystąpił nieoczekiwany błąd podczas zapisywania Pick'em." };
  }
}

/**
 * Server Action: Admin updates Pick'em deadline (only before deadline has passed)
 */
export async function adminUpdatePickemDeadlineAction(
  input: z.infer<typeof updatePickemDeadlineSchema>
): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = updatePickemDeadlineSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane." };

  const { deadlineAt } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { data: rawConfig } = await adminSupabase.from("pickem_config").select("*").maybeSingle();
    const config = rawConfig as unknown as ConfigRow | null;
    if (!config) return { success: false, error: "Brak konfiguracji Pick'em." };

    if (new Date(config.deadline_at).getTime() <= Date.now() || config.is_locked) {
      return { success: false, error: "Nie można przedłużyć deadline'u po jego upłynięciu (ochrona fair play)." };
    }

    const { error } = await adminSupabase
      .from("pickem_config")
      .update({ deadline_at: deadlineAt })
      .eq("id", config.id);

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "PICKEM_DEADLINE_UPDATED",
      target_type: "pickem_config",
      target_id: config.id,
      details: { oldDeadline: config.deadline_at, newDeadline: deadlineAt },
    });

    revalidatePath("/admin");
    revalidatePath("/pickem");
    return { success: true };
  } catch (err) {
    console.error("Error updating pickem deadline:", err);
    return { success: false, error: "Nie udało się zaktualizować deadline'u Pick'em." };
  }
}

/**
 * Server Action: Admin settles Pick'em after full league stage completion (144 matches)
 */
export async function adminSettlePickemAction(): Promise<ActionResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  try {
    // 1. Fetch 36 teams and league matches
    const [{ data: rawTeams }, { data: rawMatches }] = await Promise.all([
      adminSupabase.from("teams").select("*"),
      adminSupabase.from("matches").select("*").eq("stage", "league").eq("status", "finished"),
    ]);

    const teams = (rawTeams || []) as unknown as TeamRow[];
    const matches = (rawMatches || []) as unknown as MatchRow[];

    if (teams.length !== 36) {
      return { success: false, error: `Wymagane jest dokładnie 36 drużyn w lidze (znaleziono ${teams.length}).` };
    }

    // 2. Strict completeness verification:
    // - exactly 36 teams
    // - exactly 144 finished matches
    // - each match has distinct teams (no self-matches)
    // - each match has non-null final scores
    // - no duplicate matches between same pair
    // - every single team has exactly 8 finished matches
    const matchesPerTeam = new Map<string, number>();
    teams.forEach((t) => matchesPerTeam.set(t.id, 0));

    const seenMatchPairs = new Set<string>();

    for (const m of matches) {
      if (m.home_team_id === m.away_team_id) {
        return { success: false, error: `Wykryto nieprawidłowy mecz z tym samym klubem jako gospodarz i gość (ID meczu: ${m.id}).` };
      }

      if (m.home_score === null || m.away_score === null) {
        return { success: false, error: `Mecz ${m.id} ma status 'finished', ale brak wpisanego wyniku końcowego.` };
      }

      if (m.status !== "finished") {
        return { success: false, error: `Mecz ${m.id} nie jest zakończony (status: ${m.status}).` };
      }

      const pairKey = `${m.home_team_id}__${m.away_team_id}`;
      if (seenMatchPairs.has(pairKey)) {
        return { success: false, error: `Wykryto zduplikowany mecz pomiędzy tymi samymi drużynami (para: ${pairKey}).` };
      }
      seenMatchPairs.add(pairKey);

      matchesPerTeam.set(m.home_team_id, (matchesPerTeam.get(m.home_team_id) || 0) + 1);
      matchesPerTeam.set(m.away_team_id, (matchesPerTeam.get(m.away_team_id) || 0) + 1);
    }

    const incompleteTeams: string[] = [];
    for (const [teamId, count] of matchesPerTeam.entries()) {
      if (count !== 8) {
        const t = teams.find((x) => x.id === teamId);
        incompleteTeams.push(`${t?.name || teamId} (${count}/8)`);
      }
    }

    if (incompleteTeams.length > 0 || matches.length !== 144) {
      return {
        success: false,
        error: `Faza ligowa nie jest jeszcze kompletna (${matches.length}/144 meczów). Niekompletne drużyny: ${incompleteTeams.slice(0, 3).join(", ")}...`,
      };
    }

    // 3. Generate final official 1..36 table using 10 UEFA tiebreakers in 'final' mode
    const finishedMatchesData = matches.map((m) => ({
      id: m.id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeScore: m.home_score ?? 0,
      awayScore: m.away_score ?? 0,
      status: m.status as "finished",
    }));

    const tableTeamsData = teams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.short_name,
      code: t.code,
      logoUrl: t.logo_url,
      uefaCoefficient: Number(t.uefa_coefficient) || 0,
      disciplinaryPoints: t.disciplinary_points || 0,
    }));

    const finalTable = calculateUCLTable(tableTeamsData, finishedMatchesData, "final");
    const finalStandingsIds = finalTable.map((row) => row.team.id);

    // 4. Call PostgreSQL settlement procedure
    const { error: rpcError } = await adminSupabase.rpc("settle_pickem", {
      p_final_standings: finalStandingsIds,
    });

    if (rpcError) {
      console.error("RPC settle_pickem error:", rpcError);
      throw rpcError;
    }

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "PICKEM_SETTLED",
      target_type: "pickem_config",
      details: { totalMatches: matches.length, totalTeams: teams.length },
    });

    revalidatePath("/admin");
    revalidatePath("/pickem");
    revalidatePath("/ranking");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Error settling pickem:", err);
    return { success: false, error: "Wystąpił błąd podczas rozliczania Pick'em." };
  }
}
