import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/database.types";
import { config } from "dotenv";
import { DEMO_USERS, DEMO_TEAM_CODES, DEMO_SPECIAL_SLUGS, DEMO_PICKEM_SEASON } from "./demo-data";

config({ path: ".env.local" });
config({ path: ".env" });

async function cleanupDemo() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error("BŁĄD: Brak zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL oraz SUPABASE_SECRET_KEY w .env.local");
    process.exit(1);
  }

  const adminClient = createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("==================================================");
  console.log("🧹 [CLEANUP DEMO] Rozpoczynam bezpieczne usuwanie danych DEMO...");
  console.log("==================================================");

  // 1. Find demo users by exact usernames (demo1..demo5)
  const demoUsernames = DEMO_USERS.map((u) => u.username);
  const { data: demoProfiles } = await adminClient
    .from("profiles")
    .select("id, username")
    .in("username", demoUsernames);

  const demoUserIds = (demoProfiles || []).map((p) => p.id);
  console.log(`[CLEANUP] Znaleziono ${demoUserIds.length} kont demo w profiles: ${demoUsernames.join(", ")}`);

  // 2. Delete demo comments
  if (demoUserIds.length > 0) {
    await adminClient.from("announcement_comments").delete().in("user_id", demoUserIds);
  }

  // 3. Delete demo announcements (strictly titled [DEMO]...) and their comments
  const { data: demoAnnouncements } = await adminClient
    .from("announcements")
    .select("id, title")
    .ilike("title", "[DEMO]%");

  if (demoAnnouncements && demoAnnouncements.length > 0) {
    const annIds = demoAnnouncements.map((a) => a.id);
    await adminClient.from("announcement_comments").delete().in("announcement_id", annIds);
    await adminClient.from("announcements").delete().in("id", annIds);
    console.log(`[CLEANUP] Usunięto ${annIds.length} ogłoszeń DEMO.`);
  }

  // 4. Delete demo Pick'em selections and submissions
  if (demoUserIds.length > 0) {
    const { data: demoSubs } = await adminClient
      .from("pickem_submissions")
      .select("id")
      .in("user_id", demoUserIds);

    if (demoSubs && demoSubs.length > 0) {
      const subIds = demoSubs.map((s) => s.id);
      await adminClient.from("pickem_selections").delete().in("submission_id", subIds);
      await adminClient.from("pickem_submissions").delete().in("id", subIds);
      console.log(`[CLEANUP] Usunięto ${subIds.length} zgłoszeń Pick'em DEMO.`);
    }
  }

  // 5. Delete demo Special Predictions & Categories (strictly matching demo slugs or [DEMO] title)
  const { data: demoCategories } = await adminClient
    .from("special_prediction_categories")
    .select("id, slug")
    .in("slug", DEMO_SPECIAL_SLUGS);

  if (demoCategories && demoCategories.length > 0) {
    const catIds = demoCategories.map((c) => c.id);
    await adminClient.from("special_prediction_correct_answers").delete().in("category_id", catIds);
    await adminClient.from("special_predictions").delete().in("category_id", catIds);
    await adminClient.from("special_prediction_categories").delete().in("id", catIds);
    console.log(`[CLEANUP] Usunięto ${catIds.length} kategorii i odpowiedzi Typów Specjalnych DEMO.`);
  }

  // 6. Delete match predictions of demo users
  if (demoUserIds.length > 0) {
    await adminClient.from("predictions").delete().in("user_id", demoUserIds);
    console.log("[CLEANUP] Usunięto typowania meczowe kont DEMO.");
  }

  // 7. Delete demo teams (strictly matching reserved codes D01..D36) & matches & players
  const { data: demoTeams } = await adminClient
    .from("teams")
    .select("id, code")
    .in("code", DEMO_TEAM_CODES);

  const demoTeamIds = (demoTeams || []).map((t) => t.id);

  if (demoTeamIds.length > 0) {
    // Delete matches between demo teams
    const { data: demoMatches } = await adminClient
      .from("matches")
      .select("id")
      .in("home_team_id", demoTeamIds);

    if (demoMatches && demoMatches.length > 0) {
      const matchIds = demoMatches.map((m) => m.id);
      await adminClient.from("predictions").delete().in("match_id", matchIds);
      await adminClient.from("matches").delete().in("id", matchIds);
      console.log(`[CLEANUP] Usunięto ${matchIds.length} meczów DEMO.`);
    }

    // Delete demo players
    await adminClient.from("players").delete().in("team_id", demoTeamIds);
    console.log("[CLEANUP] Usunięto zawodników DEMO.");

    // Delete demo teams
    await adminClient.from("teams").delete().in("id", demoTeamIds);
    console.log(`[CLEANUP] Usunięto ${demoTeamIds.length} drużyn DEMO (kody ${DEMO_TEAM_CODES[0]}..${DEMO_TEAM_CODES[DEMO_TEAM_CODES.length - 1]}).`);
  }

  // 8. Delete demo Pick'em config (strictly matching DEMO season)
  const { data: demoConfigs } = await adminClient
    .from("pickem_config")
    .select("id")
    .ilike("season", "%DEMO%");

  if (demoConfigs && demoConfigs.length > 0) {
    const cfgIds = demoConfigs.map((c) => c.id);
    await adminClient.from("pickem_config").delete().in("id", cfgIds);
    console.log(`[CLEANUP] Usunięto ${cfgIds.length} konfiguracji Pick'em DEMO (${DEMO_PICKEM_SEASON}).`);
  }

  // 9. Delete demo users profiles, auth_mappings, and Auth accounts
  for (const profile of demoProfiles || []) {
    try {
      await adminClient.from("auth_mappings").delete().eq("user_id", profile.id);
      await adminClient.from("profiles").delete().eq("id", profile.id);
      await adminClient.auth.admin.deleteUser(profile.id);
      console.log(`[CLEANUP] Usunięto konto Auth & profil: @${profile.username}`);
    } catch (err) {
      console.warn(`[CLEANUP] Ostrzeżenie przy usuwaniu @${profile.username}:`, err);
    }
  }

  console.log("==================================================");
  console.log("✨ [CLEANUP DEMO] Zakończono pomyślnie! Baza danych została bezpiecznie oczyszczona.");
  console.log("Konto administratora oraz wszelkie dane produkcyjne/niedemo pozostały nienaruszone.");
  console.log("==================================================");
}

cleanupDemo().catch((err) => {
  console.error("[CLEANUP DEMO] Błąd krytyczny podczas czyszczenia:", err);
  process.exit(1);
});
