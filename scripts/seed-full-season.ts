import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/database.types";
import { config } from "dotenv";
import { DEMO_USERS, DEMO_TEAMS, generateFullLeagueSchedule } from "./demo-data";
import { calculateMatchScore } from "../src/lib/scoring/matches";

config({ path: ".env.local" });
config({ path: ".env" });

async function seedFullSeason() {
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
  console.log("🏆 [SEED FULL SEASON] Generowanie pełnej fazy ligowej 144 meczów...");
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

  // 2. Seed 36 Teams & Players
  console.log("⚽ Tworzenie 36 klubów i zawodników...");
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
  const userIdMap = new Map<string, string>();

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
  console.log("✓ Utworzono 5 kont demo.");

  // 4. Generate 144 League Matches across 8 Matchdays
  console.log("🗓️ Generowanie 144 spotkań fazy ligowej (dokładnie 8 meczów na klub)...");
  const allTeamIds = Array.from(teamIdMap.values());
  const schedule = generateFullLeagueSchedule(allTeamIds);

  const now = Date.now();
  const createdMatches: Array<{ id: string; homeScore: number; awayScore: number }> = [];

  const scorePresets = [
    [2, 1], [1, 0], [3, 1], [0, 2], [2, 2], [1, 1], [4, 1], [0, 0],
    [3, 2], [1, 2], [2, 0], [0, 1], [3, 0], [1, 3], [2, 3], [0, 3],
    [4, 2], [1, 4]
  ];

  for (let idx = 0; idx < schedule.length; idx++) {
    const s = schedule[idx];
    const matchday = s.matchday;
    const daysAgo = 9 - matchday;
    const kickoffIso = new Date(now - daysAgo * 24 * 3600 * 1000 + (idx % 18) * 3600 * 1000).toISOString();

    const scorePair = scorePresets[idx % scorePresets.length];
    const homeScore = scorePair[0];
    const awayScore = scorePair[1];

    const { data: mRow, error: mErr } = await adminClient
      .from("matches")
      .insert({
        home_team_id: s.homeTeamId,
        away_team_id: s.awayTeamId,
        stage: "league",
        matchday,
        kickoff_at: kickoffIso,
        status: "finished",
        home_score: homeScore,
        away_score: awayScore,
      })
      .select("id")
      .single();

    if (mErr || !mRow) throw new Error(`Błąd tworzenia meczu #${idx + 1}: ${mErr?.message}`);
    createdMatches.push({ id: mRow.id, homeScore, awayScore });
  }
  console.log(`✓ Wygenerowano i zapisano dokładnie ${createdMatches.length} zakończonych meczów fazy ligowej.`);

  // 5. Seed Predictions for First 2 Matchdays (36 matches) for Demo Users
  console.log("🎯 Generowanie typowań dla wybranych kolejek...");
  const sampleMatches = createdMatches.slice(0, 36);

  for (let uIdx = 0; uIdx < DEMO_USERS.length; uIdx++) {
    const userDef = DEMO_USERS[uIdx];
    const uid = userIdMap.get(userDef.username);
    if (!uid) continue;

    for (let mIdx = 0; mIdx < sampleMatches.length; mIdx++) {
      const match = sampleMatches[mIdx];
      let predHome = match.homeScore;
      let predAway = match.awayScore;

      if ((mIdx + uIdx) % 3 === 1) {
        predHome = match.homeScore + 1;
        predAway = match.awayScore + 1;
      } else if ((mIdx + uIdx) % 3 === 2) {
        predHome = match.awayScore;
        predAway = match.homeScore;
      }

      const scoreRes = calculateMatchScore({
        userHome: predHome,
        userAway: predAway,
        actualHome: match.homeScore,
        actualAway: match.awayScore,
      });

      await adminClient.from("predictions").insert({
        user_id: uid,
        match_id: match.id,
        home_score: predHome,
        away_score: predAway,
        points_awarded: scoreRes.points,
        scoring_category: scoreRes.category,
      });
    }
  }
  console.log("✓ Zapisano typowania meczowe.");

  // 6. Seed Special Predictions Categories
  console.log("🏆 Tworzenie 6 kategorii Typów Specjalnych...");
  const specCategories = [
    { slug: "ucl-winner", title: "Zwycięzca Ligi Mistrzów 2026/27", target_type: "team" as const, points_value: 20, deadline_at: new Date(now + 7 * 24 * 3600 * 1000).toISOString(), status: "open" as const, is_locked: false },
    { slug: "ucl-finalist", title: "Finalista Ligi Mistrzów 2026/27", target_type: "team" as const, points_value: 20, deadline_at: new Date(now + 7 * 24 * 3600 * 1000).toISOString(), status: "open" as const, is_locked: false },
    { slug: "top-scorer", title: "Król Strzelców Champions League", target_type: "player" as const, points_value: 20, deadline_at: new Date(now + 7 * 24 * 3600 * 1000).toISOString(), status: "open" as const, is_locked: false },
    { slug: "top-assister", title: "Król Asyst Champions League", target_type: "player" as const, points_value: 20, deadline_at: new Date(now - 24 * 3600 * 1000).toISOString(), status: "locked" as const, is_locked: true },
    { slug: "most-goals-team", title: "Najwięcej strzelonych goli (Drużyna)", target_type: "team" as const, points_value: 20, deadline_at: new Date(now - 24 * 3600 * 1000).toISOString(), status: "locked" as const, is_locked: true },
    { slug: "most-clean-sheets", title: "Najwięcej czystych kont (Faza Ligowa)", target_type: "team" as const, points_value: 20, deadline_at: new Date(now - 48 * 3600 * 1000).toISOString(), status: "settled" as const, is_locked: true },
  ];

  const catIdMap = new Map<string, string>();
  for (const cat of specCategories) {
    const { data: catRow, error: catErr } = await adminClient
      .from("special_prediction_categories")
      .insert({
        slug: cat.slug,
        title: cat.title,
        description: null,
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

  // 7. Seed Pick'em Config & Submissions (locked and ready for Admin Settlement)
  console.log("🧩 Tworzenie konfiguracji Pick'em oraz zestawów demo userów...");
  const { data: pickemCfg, error: cfgErr } = await adminClient
    .from("pickem_config")
    .insert({
      season: "2026/2027",
      deadline_at: new Date(now - 24 * 3600 * 1000).toISOString(),
      status: "locked",
      is_locked: true,
    })
    .select("id")
    .single();

  if (cfgErr || !pickemCfg) throw new Error(`Błąd tworzenia pickem_config: ${cfgErr?.message}`);

  for (let uIdx = 0; uIdx < DEMO_USERS.length; uIdx++) {
    const userDef = DEMO_USERS[uIdx];
    const uid = userIdMap.get(userDef.username);
    if (!uid) continue;

    const rotated = [...allTeamIds.slice(uIdx * 2), ...allTeamIds.slice(0, uIdx * 2)];
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
  console.log("✓ Skonfigurowano zestawy Pick'em (gotowe do rozliczenia przez Admin Panel).");

  // 8. Seed Announcements
  console.log("📢 Tworzenie ogłoszeń demo...");
  await adminClient.from("announcements").insert({
    title: "[DEMO] 🏆 Faza ligowa Ligi Mistrzów zakończona!",
    content: "Wszystkie 144 mecze fazy ligowej zostały rozegrane. Administrator może teraz dokonać oficjalnego rozliczenia Pick'em w Panelu Admina!",
    is_pinned: true,
    author_id: userIdMap.get("demo1"),
  });

  console.log("==================================================");
  console.log("🎉 [SEED FULL SEASON] Zakończono pomyślnie!");
  console.log("• Utworzono 36 drużyn");
  console.log("• Utworzono dokładnie 144 zakończone mecze (8 meczów na drużynę)");
  console.log("• Tabela Ligi Mistrzów (/tabela) jest w 100% gotowa");
  console.log("• Pick'em jest przygotowany do kliknięcia 'Rozlicz Pick'em' w Panelu Admina (/admin)");
  console.log("==================================================");
}

seedFullSeason().catch((err) => {
  console.error("[SEED FULL SEASON] Błąd krytyczny:", err);
  process.exit(1);
});
