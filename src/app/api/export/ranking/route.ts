import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeaderboardAction } from "@/lib/matches/actions";
import { generateRankingCsv, generateRankingTxt, RankingExportRow } from "@/lib/export/utils";

/**
 * Route Handler: GET /api/export/ranking?format=txt|csv
 *
 * Admin export for rankings in .txt or .csv format.
 * Purely in-memory, streaming response — zero disk writes on serverless.
 */
export async function GET(request: NextRequest) {
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
      return new NextResponse("Forbidden: Tylko administrator może pobrać export rankingu.", { status: 403 });
    }

    const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "txt";
    const now = new Date();
    const dateFormatted = now.toLocaleString("pl-PL", { timeZone: "UTC" });
    const filenameDate = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);

    // 2. Fetch fresh leaderboard from database
    const leaderboard = await getLeaderboardAction();

    const exportRows: RankingExportRow[] = leaderboard.map((e) => ({
      position: e.rank,
      username: e.username,
      firstName: e.firstName,
      lastName: e.lastName,
      matchPoints: e.matchPoints,
      specialPoints: e.specialPoints,
      pickemPoints: e.pickemPoints,
      totalPoints: e.totalPoints,
      generatedAt: now.toISOString(),
    }));

    const adminSupabase = createAdminClient();

    if (format === "csv") {
      const csvContent = generateRankingCsv(exportRows);

      await adminSupabase.from("audit_logs").insert({
        actor_id: user.id,
        action: "RANKING_CSV_EXPORTED",
        target_type: "ranking_export",
        details: { totalRows: exportRows.length },
      });

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="TyperLM26-ranking-${filenameDate}.csv"`,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    } else {
      const txtContent = generateRankingTxt(exportRows, `${dateFormatted} UTC`);

      await adminSupabase.from("audit_logs").insert({
        actor_id: user.id,
        action: "RANKING_TXT_EXPORTED",
        target_type: "ranking_export",
        details: { totalRows: exportRows.length },
      });

      return new NextResponse(txtContent, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="TyperLM26-ranking-${filenameDate}.txt"`,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }
  } catch (err) {
    console.error("Ranking export error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
