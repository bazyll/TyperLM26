import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/database.types";
import { config } from "dotenv";
import { DEMO_USERS, DEMO_TEAMS, DEMO_SPECIAL_SLUGS, DEMO_PICKEM_SEASON } from "./demo-data";
import { calculateMatchScore } from "../src/lib/scoring/matches";

config({ path: ".env.local" });
config({ path: ".env" });

async function seedDemo() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const demoPassword = process.env.DEMO_USER_PASSWORD;

  if (!supabaseUrl || !secretKey) {
    console.error("BŁĄD: Brak zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL oraz SUPABASE_SECRET_KEY w .env.local");
    process.exit(1);
  }

  if (!demoPassword) {
    console.error("==================================================");
    console.error("BŁĄD: Brak zmiennej DEMO_USER_PASSWORD w pliku .env.local!");
    console.error("Dodaj do swojego .env.local wpis, np.:");
    console.error("DEMO_USER_PASSWORD=DemoHaslo2026!");
    console.error("==================================================");
    process.exit(1);
  }

  const adminClient = createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("==================================================");
  console.log("🚀 [SEED DEMO] Rozpoczynam generowanie podstawowego datasetu demonstracyjnego...");
  console.log("==================================================");

  // 1. Idempotence Check
  const { data: existingDemo } = await adminClient
    .from("profiles")
    .select("username")
    .in("username", ["demo1", "demo2", "demo3", "demo4", "demo5"]);

  if (existingDemo && existingDemo.length > 0) {
    console.log("⚠️  Demo data already exists. Run pnpm demo:cleanup first.");
    return;
  }

  // 2. Seed 36 Teams & Players with reserved D01..D36 codes
  console.log("⚽ Tworzenie 36 klubów i zawodników (z kodami D01..D36)...");
  const teamIdMap = new Map<string, string>(); // code -> id
  const playerList: Array<{ id: string; team_id: string; name: string }> = [];

  for (const teamDef of DEMO_TEAMS) {
    const { data: teamRow, error: teamErr } = await adminClient
      .from("teams")
      .insert({
        name: teamDef.name,
        short_name: teamDef.short_name,
        code: teamDef.code,
        logo_url: teamDef.logo_url,
        uefa_coefficient: teamDef.uefa_coefficient,
        disciplinary_points: teamDef.disciplinary_points,
      })
      .select("id")
      .single();

    if (teamErr || !teamRow) throw new Error(`Błąd tworzenia drużyny ${teamDef.name}: ${teamErr?.message}`);
    teamIdMap.set(teamDef.code, teamRow.id);

    // Insert players
    for (const p of teamDef.players) {
      const { data: pRow, error: pErr } = await adminClient
        .from("players")
        .insert({
          team_id: teamRow.id,
          name: p.name,
          is_active: true,
        })
        .select("id")
        .single();

      if (pErr || !pRow) throw new Error(`Błąd tworzenia zawodnika ${p.name}: ${pErr?.message}`);
      playerList.push({ id: pRow.id, team_id: teamRow.id, name: p.name });
    }
  }
  console.log(`✓ Utworzono 36 drużyn oraz ${playerList.length} zawodników.`);

  // 3. Seed Demo Users (demo1..demo5)
  console.log("👥 Tworzenie kont demonstracyjnych (demo1..demo5)...");
  const userIdMap = new Map<string, string>(); // username -> id

  for (const userDef of DEMO_USERS) {
    const internalEmail = `${userDef.username}_${Date.now()}@typerlm.demo`;
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { first_name: userDef.firstName, last_name: userDef.lastName },
    });

    if (authErr || !authData.user) {
      throw new Error(`Błąd tworzenia użytkownika Auth ${userDef.username}: ${authErr?.message}`);
    }

    const userId = authData.user.id;
    userIdMap.set(userDef.username, userId);

    await adminClient.from("auth_mappings").insert({
      user_id: userId,
      username: userDef.username,
      auth_email: internalEmail,
    });

    await adminClient.from("profiles").insert({
      id: userId,
      username: userDef.username,
      first_name: userDef.firstName,
      last_name: userDef.lastName,
      role: "user",
      is_active: true,
    });
  }
  console.log("✓ Utworzono 5 kont użytkowników demo.");

  // 4. Seed Matches (Upcoming, Live, Finished, Postponed, Cancelled)
  console.log("🏟️ Tworzenie meczów demo (Finished, Live, Upcoming, Postponed, Cancelled)...");
  const now = Date.now();

  const matchSpecs = [
    // Finished matches (8-10 with diverse results)
    { home: "D01", away: "D07", homeScore: 3, awayScore: 1, status: "finished" as const, kickoffOffset: -72 * 3600 * 1000 },
    { home: "D03", away: "D04", homeScore: 0, awayScore: 2, status: "finished" as const, kickoffOffset: -70 * 3600 * 1000 },
    { home: "D02", away: "D06", homeScore: 2, awayScore: 2, status: "finished" as const, kickoffOffset: -48 * 3600 * 1000 },
    { home: "D05", away: "D11", homeScore: 0, awayScore: 0, status: "finished" as const, kickoffOffset: -46 * 3600 * 1000 },
    { home: "D09", away: "D10", homeScore: 4, awayScore: 3, status: "finished" as const, kickoffOffset: -24 * 3600 * 1000 },
    { home: "D15", away: "D13", homeScore: 1, awayScore: 0, status: "finished" as const, kickoffOffset: -22 * 3600 * 1000 },
    { home: "D12", away: "D14", homeScore: 2, awayScore: 1, status: "finished" as const, kickoffOffset: -20 * 3600 * 1000 },
    { home: "D19", away: "D08", homeScore: 1, awayScore: 3, status: "finished" as const, kickoffOffset: -18 * 3600 * 1000 },
    { home: "D17", away: "D20", homeScore: 1, awayScore: 1, status: "finished" as const, kickoffOffset: -12 * 3600 * 1000 },

    // Live matches (2 matches)
    { home: "D16", away: "D22", homeScore: 1, awayScore: 0, status: "live" as const, minute: 34, kickoffOffset: -40 * 60 * 1000 },
    { home: "D18", away: "D23", homeScore: 2, awayScore: 2, status: "live" as const, minute: 78, kickoffOffset: -85 * 60 * 1000 },

    // Upcoming matches (relative to now)
    { home: "D30", away: "D31", homeScore: null, awayScore: null, status: "scheduled" as const, minute: null, kickoffOffset: 30 * 60 * 1000 }, // +30m
    { home: "D32", away: "D33", homeScore: null, awayScore: null, status: "scheduled" as const, minute: null, kickoffOffset: 24 * 3600 * 1000 }, // tomorrow
    { home: "D28", away: "D21", homeScore: null, awayScore: null, status: "scheduled" as const, minute: null, kickoffOffset: 26 * 3600 * 1000 }, // tomorrow
    { home: "D26", away: "D24", homeScore: null, awayScore: null, status: "scheduled" as const, minute: null, kickoffOffset: 72 * 3600 * 1000 }, // in 3 days
    { home: "D25", away: "D29", homeScore: null, awayScore: null, status: "scheduled" as const, minute: null, kickoffOffset: 74 * 3600 * 1000 }, // in 3 days

    // Postponed & Cancelled
    { home: "D34", away: "D27", homeScore: null, awayScore: null, status: "postponed" as const, minute: null, kickoffOffset: 48 * 3600 * 1000 },
    { home: "D35", away: "D36", homeScore: null, awayScore: null, status: "cancelled" as const, minute: null, kickoffOffset: 50 * 3600 * 1000 },
  ];

  const createdMatches: Array<{
    id: string;
    homeCode: string;
    awayCode: string;
    homeScore: number | null;
    awayScore: number | null;
    status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
    kickoffAt: string;
  }> = [];

  for (const ms of matchSpecs) {
    const homeId = teamIdMap.get(ms.home);
    const awayId = teamIdMap.get(ms.away);
    if (!homeId || !awayId) continue;

    const kickoffIso = new Date(now + ms.kickoffOffset).toISOString();
    const { data: mRow, error: mErr } = await adminClient
      .from("matches")
      .insert({
        home_team_id: homeId,
        away_team_id: awayId,
        stage: "league",
        matchday: 1,
        kickoff_at: kickoffIso,
        status: ms.status,
        home_score: ms.homeScore,
        away_score: ms.awayScore,
        live_minute: ms.minute || null,
      })
      .select("id")
      .single();

    if (mErr || !mRow) throw new Error(`Błąd tworzenia meczu ${ms.home} vs ${ms.away}: ${mErr?.message}`);
    createdMatches.push({
      id: mRow.id,
      homeCode: ms.home,
      awayCode: ms.away,
      homeScore: ms.homeScore,
      awayScore: ms.awayScore,
      status: ms.status,
      kickoffAt: kickoffIso,
    });
  }
  console.log(`✓ Utworzono ${createdMatches.length} meczów demo.`);

  // 5. Seed Match Predictions with Exact, Diff, Outcome, Incorrect
  console.log("🎯 Generowanie typowań meczowych demo i naliczanie punktacji...");
  const finishedMatches = createdMatches.filter((m) => m.status === "finished");
  const upcomingMatches = createdMatches.filter((m) => m.status === "scheduled");

  const userPredictionsConfig = [
    {
      username: "demo1",
      finishedPicks: [
        { h: 3, a: 1 }, // on 3:1 -> 3 pts (Exact)
        { h: 0, a: 2 }, // on 0:2 -> 3 pts (Exact)
        { h: 1, a: 1 }, // on 2:2 -> 2 pts (Diff draw)
        { h: 1, a: 1 }, // on 0:0 -> 2 pts (Diff draw)
        { h: 2, a: 1 }, // on 4:3 -> 2 pts (Diff win)
        { h: 2, a: 1 }, // on 1:0 -> 2 pts (Diff win)
        { h: 2, a: 1 }, // on 2:1 -> 3 pts (Exact)
        { h: 0, a: 2 }, // on 1:3 -> 1 pt  (Outcome away)
        { h: 0, a: 0 }, // on 1:1 -> 2 pts (Diff draw)
      ],
      upcomingPicks: [{ h: 2, a: 1 }, { h: 1, a: 0 }, { h: 3, a: 1 }, { h: 2, a: 2 }, { h: 1, a: 2 }],
    },
    {
      username: "demo2",
      finishedPicks: [
        { h: 2, a: 0 }, // on 3:1 -> 1 pt
        { h: 1, a: 2 }, // on 0:2 -> 1 pt
        { h: 3, a: 3 }, // on 2:2 -> 2 pts
        { h: 1, a: 0 }, // on 0:0 -> 0 pts
        { h: 4, a: 3 }, // on 4:3 -> 3 pts
        { h: 2, a: 1 }, // on 1:0 -> 2 pts
        { h: 3, a: 0 }, // on 2:1 -> 1 pt
        { h: 1, a: 3 }, // on 1:3 -> 3 pts
        { h: 2, a: 1 }, // on 1:1 -> 0 pts
      ],
      upcomingPicks: [{ h: 1, a: 1 }, { h: 2, a: 1 }, { h: 0, a: 2 }, { h: 1, a: 0 }, { h: 0, a: 0 }],
    },
    {
      username: "demo3",
      finishedPicks: [
        { h: 1, a: 0 }, // on 3:1 -> 1 pt
        { h: 2, a: 1 }, // on 0:2 -> 0 pts
        { h: 0, a: 1 }, // on 2:2 -> 0 pts
        { h: 0, a: 0 }, // on 0:0 -> 3 pts
        { h: 1, a: 2 }, // on 4:3 -> 0 pts
        { h: 3, a: 1 }, // on 1:0 -> 1 pt
        { h: 1, a: 1 }, // on 2:1 -> 0 pts
        { h: 0, a: 1 }, // on 1:3 -> 1 pt
        { h: 1, a: 1 }, // on 1:1 -> 3 pts
      ],
      upcomingPicks: [{ h: 3, a: 0 }, { h: 1, a: 2 }, { h: 1, a: 1 }, { h: 0, a: 3 }, { h: 2, a: 1 }],
    },
    {
      username: "demo4",
      finishedPicks: [
        { h: 2, a: 1 }, // on 3:1 -> 1 pt
        { h: 0, a: 3 }, // on 0:2 -> 1 pt
        { h: 2, a: 1 }, // on 2:2 -> 0 pts
        { h: 2, a: 2 }, // on 0:0 -> 2 pts
        { h: 3, a: 2 }, // on 4:3 -> 2 pts
        { h: 0, a: 1 }, // on 1:0 -> 0 pts
        { h: 2, a: 0 }, // on 2:1 -> 1 pt
        { h: 2, a: 2 }, // on 1:3 -> 0 pts
        { h: 0, a: 0 }, // on 1:1 -> 2 pts
      ],
      upcomingPicks: [{ h: 1, a: 2 }, { h: 0, a: 0 }, { h: 2, a: 0 }, { h: 1, a: 1 }, { h: 3, a: 1 }],
    },
    {
      username: "demo5",
      finishedPicks: [
        { h: 0, a: 1 }, // on 3:1 -> 0 pts
        { h: 1, a: 1 }, // on 0:2 -> 0 pts
        { h: 1, a: 0 }, // on 2:2 -> 0 pts
        { h: 1, a: 0 }, // on 0:0 -> 0 pts
        { h: 2, a: 1 }, // on 4:3 -> 1 pt
        { h: 1, a: 0 }, // on 1:0 -> 3 pts
        { h: 0, a: 2 }, // on 2:1 -> 0 pts
        { h: 1, a: 2 }, // on 1:3 -> 1 pt
        { h: 2, a: 0 }, // on 1:1 -> 0 pts
      ],
      upcomingPicks: [{ h: 0, a: 1 }, { h: 2, a: 2 }, { h: 1, a: 0 }, { h: 2, a: 1 }, { h: 0, a: 2 }],
    },
  ];

  for (const upc of userPredictionsConfig) {
    const uid = userIdMap.get(upc.username);
    if (!uid) continue;

    // Finished matches predictions
    for (let i = 0; i < finishedMatches.length; i++) {
      const fm = finishedMatches[i];
      const pick = upc.finishedPicks[i] || { h: 1, a: 0 };
      const scoreRes = calculateMatchScore({
        userHome: pick.h,
        userAway: pick.a,
        actualHome: fm.homeScore ?? 0,
        actualAway: fm.awayScore ?? 0,
      });

      await adminClient.from("predictions").insert({
        user_id: uid,
        match_id: fm.id,
        home_score: pick.h,
        away_score: pick.a,
        points_awarded: scoreRes.points,
        scoring_category: scoreRes.category,
      });
    }

    // Upcoming matches predictions
    for (let i = 0; i < upcomingMatches.length; i++) {
      const um = upcomingMatches[i];
      const pick = upc.upcomingPicks[i] || { h: 1, a: 0 };
      await adminClient.from("predictions").insert({
        user_id: uid,
        match_id: um.id,
        home_score: pick.h,
        away_score: pick.a,
        points_awarded: null,
        scoring_category: null,
      });
    }
  }
  console.log("✓ Zapisano i przeliczono typowania meczowe dla kont demo.");

  // 6. Seed Special Predictions Categories (with distinct demo slugs)
  console.log("🏆 Tworzenie 6 kategorii Typów Specjalnych (z prefiksem demo-)...");
  const specCategories = [
    {
      slug: "demo-ucl-winner",
      title: "[DEMO] Zwycięzca Ligi Mistrzów 2026/27",
      description: "Wskaż triumfatora finału UEFA Champions League.",
      target_type: "team" as const,
      points_value: 20,
      deadline_at: new Date(now + 7 * 24 * 3600 * 1000).toISOString(),
      status: "open" as const,
      is_locked: false,
    },
    {
      slug: "demo-ucl-finalist",
      title: "[DEMO] Finalista Ligi Mistrzów 2026/27",
      description: "Wskaż drugiego finalistę (wicemistrza / przegranego w finale).",
      target_type: "team" as const,
      points_value: 20,
      deadline_at: new Date(now + 7 * 24 * 3600 * 1000).toISOString(),
      status: "open" as const,
      is_locked: false,
    },
    {
      slug: "demo-top-scorer",
      title: "[DEMO] Król Strzelców Champions League",
      description: "Zawodnik z największą liczbą goli na koniec turnieju.",
      target_type: "player" as const,
      points_value: 20,
      deadline_at: new Date(now + 7 * 24 * 3600 * 1000).toISOString(),
      status: "open" as const,
      is_locked: false,
    },
    {
      slug: "demo-top-assister",
      title: "[DEMO] Król Asyst Champions League",
      description: "Zawodnik z największą liczbą asyst.",
      target_type: "player" as const,
      points_value: 20,
      deadline_at: new Date(now - 24 * 3600 * 1000).toISOString(),
      status: "locked" as const,
      is_locked: true,
    },
    {
      slug: "demo-most-goals-team",
      title: "[DEMO] Najwięcej strzelonych goli (Drużyna)",
      description: "Klub z największą łączną liczbą bramek.",
      target_type: "team" as const,
      points_value: 20,
      deadline_at: new Date(now - 24 * 3600 * 1000).toISOString(),
      status: "locked" as const,
      is_locked: true,
    },
    {
      slug: "demo-most-clean-sheets",
      title: "[DEMO] Najwięcej czystych kont (Faza Ligowa)",
      description: "Drużyna z największą liczbą czystych kont.",
      target_type: "team" as const,
      points_value: 20,
      deadline_at: new Date(now - 48 * 3600 * 1000).toISOString(),
      status: "settled" as const,
      is_locked: true,
    },
  ];

  const catIdMap = new Map<string, string>();
  for (const cat of specCategories) {
    const { data: catRow, error: catErr } = await adminClient
      .from("special_prediction_categories")
      .insert({
        slug: cat.slug,
        title: cat.title,
        description: cat.description,
        target_type: cat.target_type,
        points_value: cat.points_value,
        deadline_at: cat.deadline_at,
        status: cat.status,
        is_locked: cat.is_locked,
      })
      .select("id")
      .single();

    if (catErr || !catRow) throw new Error(`Błąd tworzenia kategorii specjalnej ${cat.slug}: ${catErr?.message}`);
    catIdMap.set(cat.slug, catRow.id);
  }

  // Set correct answer for settled category (demo-most-clean-sheets -> Arsenal FC D15)
  const settledCatId = catIdMap.get("demo-most-clean-sheets");
  const correctArsenalId = teamIdMap.get("D15");
  if (settledCatId && correctArsenalId) {
    await adminClient.from("special_prediction_correct_answers").insert({
      category_id: settledCatId,
      team_id: correctArsenalId,
    });
  }

  // Seed user predictions for special categories
  const rmaId = teamIdMap.get("D01");
  const mciId = teamIdMap.get("D02");
  const bayId = teamIdMap.get("D03");
  const arsId = teamIdMap.get("D15");
  const mbappe = playerList.find((p) => p.name.includes("Mbappé"))?.id;
  const haaland = playerList.find((p) => p.name.includes("Haaland"))?.id;
  const kdb = playerList.find((p) => p.name.includes("De Bruyne"))?.id;

  const demoSpecPicks: Array<{
    username: string;
    catSlug: string;
    teamId?: string;
    playerId?: string;
    pointsAwarded?: number;
  }> = [
    // Winner
    { username: "demo1", catSlug: "demo-ucl-winner", teamId: rmaId },
    { username: "demo2", catSlug: "demo-ucl-winner", teamId: mciId },
    { username: "demo3", catSlug: "demo-ucl-winner", teamId: bayId },
    { username: "demo4", catSlug: "demo-ucl-winner", teamId: arsId },
    { username: "demo5", catSlug: "demo-ucl-winner", teamId: rmaId },

    // Finalist
    { username: "demo1", catSlug: "demo-ucl-finalist", teamId: mciId },
    { username: "demo2", catSlug: "demo-ucl-finalist", teamId: rmaId },
    { username: "demo3", catSlug: "demo-ucl-finalist", teamId: arsId },
    { username: "demo4", catSlug: "demo-ucl-finalist", teamId: bayId },
    { username: "demo5", catSlug: "demo-ucl-finalist", teamId: mciId },

    // Top Scorer
    { username: "demo1", catSlug: "demo-top-scorer", playerId: mbappe },
    { username: "demo2", catSlug: "demo-top-scorer", playerId: haaland },
    { username: "demo3", catSlug: "demo-top-scorer", playerId: mbappe },
    { username: "demo4", catSlug: "demo-top-scorer", playerId: haaland },
    { username: "demo5", catSlug: "demo-top-scorer", playerId: mbappe },

    // Top Assister
    { username: "demo1", catSlug: "demo-top-assister", playerId: kdb },
    { username: "demo2", catSlug: "demo-top-assister", playerId: kdb },
    { username: "demo3", catSlug: "demo-top-assister", playerId: kdb },

    // Settled Category: demo-most-clean-sheets (Arsenal D15 correct -> demo1 and demo4 get +20 pts)
    { username: "demo1", catSlug: "demo-most-clean-sheets", teamId: arsId, pointsAwarded: 20 },
    { username: "demo2", catSlug: "demo-most-clean-sheets", teamId: mciId, pointsAwarded: 0 },
    { username: "demo3", catSlug: "demo-most-clean-sheets", teamId: rmaId, pointsAwarded: 0 },
    { username: "demo4", catSlug: "demo-most-clean-sheets", teamId: arsId, pointsAwarded: 20 },
    { username: "demo5", catSlug: "demo-most-clean-sheets", teamId: bayId, pointsAwarded: 0 },
  ];

  for (const dsp of demoSpecPicks) {
    const uid = userIdMap.get(dsp.username);
    const cid = catIdMap.get(dsp.catSlug);
    if (!uid || !cid) continue;

    await adminClient.from("special_predictions").insert({
      user_id: uid,
      category_id: cid,
      selected_team_id: dsp.teamId || null,
      selected_player_id: dsp.playerId || null,
      points_awarded: dsp.pointsAwarded ?? null,
    });
  }
  console.log("✓ Skonfigurowano i rozliczono typy specjalne demo.");

  // 7. Seed Pick'em Config & Submissions (with DEMO season marker)
  console.log(`🧩 Tworzenie konfiguracji Pick'em (${DEMO_PICKEM_SEASON}) oraz zestawów demo userów...`);
  const { data: pickemCfg, error: cfgErr } = await adminClient
    .from("pickem_config")
    .insert({
      season: DEMO_PICKEM_SEASON,
      deadline_at: new Date(now + 5 * 24 * 3600 * 1000).toISOString(),
      status: "open",
      is_locked: false,
    })
    .select("id")
    .single();

  if (cfgErr || !pickemCfg) throw new Error(`Błąd tworzenia pickem_config: ${cfgErr?.message}`);

  const allTeamIds = Array.from(teamIdMap.values());

  for (let uIdx = 0; uIdx < DEMO_USERS.length; uIdx++) {
    const userDef = DEMO_USERS[uIdx];
    const uid = userIdMap.get(userDef.username);
    if (!uid) continue;

    // Shift team array for distinct picks per user
    const rotated = [...allTeamIds.slice(uIdx), ...allTeamIds.slice(0, uIdx)];
    const firstTeamId = rotated[0];
    const top8TeamIds = rotated.slice(1, 8);
    const outTeamIds = rotated.slice(28, 36);

    const { data: subRow, error: subErr } = await adminClient
      .from("pickem_submissions")
      .insert({
        user_id: uid,
        config_id: pickemCfg.id,
        first_team_id: firstTeamId,
        top8_team_ids: top8TeamIds,
        out_team_ids: outTeamIds,
        points_awarded: null,
      })
      .select("id")
      .single();

    if (subErr || !subRow) throw new Error(`Błąd zapisu Pick'em dla ${userDef.username}: ${subErr?.message}`);

    const selectionsPayload = [
      { submission_id: subRow.id, team_id: firstTeamId, category: "first" as const },
      ...top8TeamIds.map((tId) => ({ submission_id: subRow.id, team_id: tId, category: "top8" as const })),
      ...outTeamIds.map((tId) => ({ submission_id: subRow.id, team_id: tId, category: "out" as const })),
    ];

    await adminClient.from("pickem_selections").insert(selectionsPayload);
  }
  console.log("✓ Skonfigurowano zestawy Pick'em dla wszystkich kont demo.");

  // 8. Seed Announcements & Comments
  console.log("📢 Tworzenie ogłoszeń i komentarzy demo...");
  const announcementsData = [
    {
      title: "[DEMO] 🏆 Witamy w Typerze Ligi Mistrzów 2026/27!",
      content:
        "Oficjalnie ruszamy z nowym sezonem Champions League! Zapraszamy do typowania spotkań fazy ligowej, wypełnienia swojego Pick'em oraz wskazania zwycięzców w Typach Specjalnych. Niech wygra najlepszy analityk!",
      is_pinned: true,
      author_id: userIdMap.get("demo1"),
    },
    {
      title: "[DEMO] 📊 Kompletny poradnik punktacji i zasad typera",
      content:
        "Przypominamy o regułach przyznawania punktów za mecze:\n• Dokładny wynik (Exact): 3 pkt\n• Różnica bramek / bramkowy remis (Goal diff): 2 pkt\n• Rozstrzygnięcie meczu (Outcome): 1 pkt\n• Niepoprawny typ: 0 pkt\n\nDodatkowo w Typach Specjalnych każda trafiona kategoria daje aż 20 punktów!",
      is_pinned: false,
      author_id: userIdMap.get("demo2"),
    },
    {
      title: "[DEMO] ⏰ Zbliża się deadline fazy ligowej!",
      content: "Pamiętajcie, że po rozpoczęciu pierwszego meczu kolejki typowanie zostaje zablokowane.",
      is_pinned: false,
      author_id: userIdMap.get("demo1"),
    },
  ];

  for (const ann of announcementsData) {
    const { data: annRow, error: annErr } = await adminClient
      .from("announcements")
      .insert({
        title: ann.title,
        content: ann.content,
        is_pinned: ann.is_pinned,
        author_id: ann.author_id,
      })
      .select("id")
      .single();

    if (annErr || !annRow) continue;

    // Seed comments under announcement
    await adminClient.from("announcement_comments").insert([
      {
        announcement_id: annRow.id,
        user_id: userIdMap.get("demo2")!,
        content: "Powodzenia wszystkim graczom! W tym sezonie stawiam na Real!",
      },
      {
        announcement_id: annRow.id,
        user_id: userIdMap.get("demo3")!,
        content: "Mój Pick'em już zapisany, liczę na kilka niespodzianek w strefie spadkowej 🔴",
      },
      {
        announcement_id: annRow.id,
        user_id: userIdMap.get("demo4")!,
        content: "Świetna aplikacja i bardzo czytelna punktacja live!",
      },
    ]);
  }
  console.log("✓ Utworzono ogłoszenia i komentarze demo.");

  console.log("==================================================");
  console.log("🎉 [SEED DEMO] Zakończono pomyślnie!");
  console.log("Wszystkie dane zostały oznaczone bezpiecznymi markerami DEMO:");
  console.log("• Kody drużyn: D01..D36");
  console.log(`• Sezon Pick'em: ${DEMO_PICKEM_SEASON}`);
  console.log("• Slugi kategorii specjalnych: demo-*");
  console.log("• Tytuły ogłoszeń: [DEMO] *");
  console.log("Utworzone konta demonstracyjne (hasło z DEMO_USER_PASSWORD w .env.local):");
  DEMO_USERS.forEach((u) => console.log(`• @${u.username} (${u.firstName} ${u.lastName})`));
  console.log("==================================================");
}

seedDemo().catch((err) => {
  console.error("[SEED DEMO] Błąd krytyczny:", err);
  process.exit(1);
});
