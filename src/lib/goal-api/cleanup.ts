import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export const APPROVED_SAFE_ORPHAN_TEAM_IDS = [
  "ec2e1474-1e87-49a8-9ffd-74afdbc7be74", // FC Bayern München (D03)
  "288976b8-3039-41cd-a42a-10ad4783628d", // Bayer 04 Leverkusen (D10)
  "8305cf30-58e8-4349-b53c-780ce2ff5f6b", // Atalanta BC (D12)
  "1b7eac6c-02e3-49ad-9668-cde393686da1", // SL Benfica (D14)
  "2b3f3829-3e70-4629-ac84-55975f9b72e4", // AC Milan (D19)
  "49b398f3-e11e-4303-adfe-05452398ffe6", // GNK Dinamo Zagreb (D21)
  "84263e57-db30-496a-bc2e-3b189501dbe5", // FC Salzburg (D22)
  "d56aa80a-6c48-41fc-86c5-e01f0de53821", // FK Crvena Zvezda (D24)
  "0d6ffc62-2751-4e52-972e-28ade908a8c5", // BSC Young Boys Bern (D25)
  "6c26f10d-0be4-4185-9dab-94fdf6ec6415", // Celtic FC (D26)
  "039713ae-e78f-4cd8-accc-c9acc214ee2f", // AS Monaco FC (D28)
  "594cb317-dea0-4851-a9af-bdf7200b49bb", // AC Sparta Praha (D29)
  "44163203-49fc-4f7b-af85-a05417fac458", // Bologna FC 1909 (D31)
  "1379646d-1841-42d7-b3f9-e572bae6f600", // Girona FC (D32)
  "a9bb11c7-5fb4-41d6-8e35-de959664a108", // SK Sturm Graz (D34)
  "a4b5562b-0a27-425f-ba64-5986ebfc17f9", // Stade Brestois 29 (D35)
];

export interface OrphanCleanupResult {
  success: boolean;
  error?: string;
  deletedCount: number;
  skippedCount: number;
  deletedTeamNames: string[];
  skippedDetails: string[];
}

/**
 * Safely deletes the 16 approved orphan seed teams after real-time FK validation
 */
export async function cleanupSafeOrphanTeams(): Promise<OrphanCleanupResult> {
  const adminSupabase = createAdminClient();

  const deletedTeamNames: string[] = [];
  const skippedDetails: string[] = [];

  for (const teamId of APPROVED_SAFE_ORPHAN_TEAM_IDS) {
    // 1. Fetch team
    const { data: team, error: fetchErr } = await adminSupabase
      .from("teams")
      .select("id, name, code, goal_api_id")
      .eq("id", teamId)
      .single();

    if (fetchErr || !team) {
      skippedDetails.push(`ID ${teamId}: Rekord już nie istnieje w bazie.`);
      continue;
    }

    if (team.goal_api_id !== null && team.goal_api_id !== "") {
      skippedDetails.push(`Drużyna "${team.name}": posiada goal_api_id=${team.goal_api_id} (pominięto ochronnie).`);
      continue;
    }

    // 2. Real-time FK checks
    const [
      { count: matchH },
      { count: matchA },
      { count: events },
      { count: players },
      { count: specialsAns },
      { count: specialsPred },
      { count: pickemFirst },
    ] = await Promise.all([
      adminSupabase.from("matches").select("id", { count: "exact", head: true }).eq("home_team_id", teamId),
      adminSupabase.from("matches").select("id", { count: "exact", head: true }).eq("away_team_id", teamId),
      adminSupabase.from("match_events").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      adminSupabase.from("players").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      adminSupabase.from("special_prediction_correct_answers").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      adminSupabase.from("special_predictions").select("id", { count: "exact", head: true }).eq("selected_team_id", teamId),
      adminSupabase.from("pickem_submissions").select("id", { count: "exact", head: true }).eq("first_team_id", teamId),
    ]);

    const totalFk =
      (matchH || 0) +
      (matchA || 0) +
      (events || 0) +
      (players || 0) +
      (specialsAns || 0) +
      (specialsPred || 0) +
      (pickemFirst || 0);

    if (totalFk > 0) {
      skippedDetails.push(`Drużyna "${team.name}": wykryto ${totalFk} powiązań FK (pominięto bezpiecznie).`);
      continue;
    }

    // 3. Safe Delete
    const { error: deleteErr } = await adminSupabase.from("teams").delete().eq("id", teamId);

    if (deleteErr) {
      skippedDetails.push(`Drużyna "${team.name}": błąd kasowania - ${deleteErr.message}`);
    } else {
      deletedTeamNames.push(`${team.name} (${team.code})`);
    }
  }

  // Revalidate routes
  try {
    revalidatePath("/");
    revalidatePath("/mecze");
    revalidatePath("/tabela");
    revalidatePath("/ranking");
    revalidatePath("/admin");
  } catch {
    // Safe
  }

  return {
    success: true,
    deletedCount: deletedTeamNames.length,
    skippedCount: skippedDetails.length,
    deletedTeamNames,
    skippedDetails,
  };
}
