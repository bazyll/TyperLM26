import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Route Handler: GET /api/export/backup
 *
 * Full domain data JSON backup snapshot for administrator.
 * In-memory streaming response — zero disk writes on serverless.
 * Strictly excludes secrets, tokens, password hashes, and auth_mappings.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Verify user session and admin role
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { data: rawProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profile = rawProfile as unknown as { id: string; role: string; is_active: boolean } | null;

    if (!profile || !profile.is_active || profile.role !== "admin") {
      return new NextResponse("Forbidden: Tylko administrator może pobrać backup bazy.", { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const now = new Date();
    const filenameDate = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);

    // 2. Fetch domain tables in parallel (strictly omitting sensitive auth tables)
    const [
      { data: profiles },
      { data: teams },
      { data: players },
      { data: matches },
      { data: predictions },
      { data: specialCategories },
      { data: specialAnswers },
      { data: specialPredictions },
      { data: pickemConfig },
      { data: pickemSubmissions },
      { data: pickemSelections },
      { data: announcements },
      { data: announcementComments },
      { data: auditLogs },
    ] = await Promise.all([
      adminSupabase.from("profiles").select("id, username, first_name, last_name, avatar_url, role, is_active, created_at, updated_at"),
      adminSupabase.from("teams").select("*"),
      adminSupabase.from("players").select("*"),
      adminSupabase.from("matches").select("*"),
      adminSupabase.from("predictions").select("*"),
      adminSupabase.from("special_prediction_categories").select("*"),
      adminSupabase.from("special_prediction_correct_answers").select("*"),
      adminSupabase.from("special_predictions").select("*"),
      adminSupabase.from("pickem_config").select("*"),
      adminSupabase.from("pickem_submissions").select("*"),
      adminSupabase.from("pickem_selections").select("*"),
      adminSupabase.from("announcements").select("*"),
      adminSupabase.from("announcement_comments").select("*"),
      adminSupabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

    const backupPayload = {
      metadata: {
        appName: "TyperLM26",
        version: "1.0.0",
        schemaVersion: "1.4.0",
        season: "2026/2027",
        generatedAt: now.toISOString(),
        exportedBy: user.id,
      },
      data: {
        profiles: profiles || [],
        teams: teams || [],
        players: players || [],
        matches: matches || [],
        predictions: predictions || [],
        specialPredictionCategories: specialCategories || [],
        specialPredictionCorrectAnswers: specialAnswers || [],
        specialPredictions: specialPredictions || [],
        pickemConfig: pickemConfig || [],
        pickemSubmissions: pickemSubmissions || [],
        pickemSelections: pickemSelections || [],
        announcements: announcements || [],
        announcementComments: announcementComments || [],
        auditLogs: auditLogs || [],
      },
    };

    // 3. Log audit event
    await adminSupabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "BACKUP_JSON_EXPORTED",
      target_type: "backup_export",
      details: {
        profilesCount: profiles?.length || 0,
        matchesCount: matches?.length || 0,
        predictionsCount: predictions?.length || 0,
      },
    });

    const jsonString = JSON.stringify(backupPayload, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="TyperLM26-backup-${filenameDate}.json"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Backup JSON export error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
