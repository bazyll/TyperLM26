import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/database.types";
import { config } from "dotenv";
import { DEMO_USERS, DEMO_TEAMS } from "./demo-data";

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

  // 1. Find demo users by usernames
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

  // 3. Delete demo announcements (titled [DEMO]...) and their comments
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

  // 5. Delete demo Special Predictions & Categories
  if (demoUserIds.length > 0) {
    await adminClient.from("special_predictions").delete().in("user_id", demoUserIds);
  }
  await adminClient.from("special_prediction_correct_answers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await adminClient.from("special_predictions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await adminClient.from("special_prediction_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("[CLEANUP] Wyczyszczono kategorie i typy specjalne DEMO.");

  // 6. Delete match predictions of demo users
  if (demoUserIds.length > 0) {
    await adminClient.from("predictions").delete().in("user_id", demoUserIds);
    console.log("[CLEANUP] Usunięto typowania meczowe kont DEMO.");
  }

  // 7. Delete demo matches
  const demoCodes = DEMO_TEAMS.map((t) => t.code);
  const { data: demoTeams } = await adminClient
    .from("teams")
    .select("id, code")
    .in("code", demoCodes);

  const demoTeamIds = (demoTeams || []).map((t) => t.id);

  if (demoTeamIds.length > 0) {
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

    // 8. Delete demo players
    await adminClient.from("players").delete().in("team_id", demoTeamIds);
    console.log("[CLEANUP] Usunięto zawodników DEMO.");

    // 9. Delete demo teams
    await adminClient.from("teams").delete().in("id", demoTeamIds);
    console.log(`[CLEANUP] Usunięto ${demoTeamIds.length} drużyn DEMO.`);
  }

  // 10. Delete demo Pick'em config
  await adminClient.from("pickem_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("[CLEANUP] Usunięto konfigurację Pick'em DEMO.");

  // 11. Delete demo users profiles, auth_mappings, and Auth accounts
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
  console.log("✨ [CLEANUP DEMO] Zakończono pomyślnie! Baza jest czysta.");
  console.log("Konto administratora oraz dane rzeczywiste pozostały nienaruszone.");
  console.log("==================================================");
}

cleanupDemo().catch((err) => {
  console.error("[CLEANUP DEMO] Błąd krytyczny podczas czyszczenia:", err);
  process.exit(1);
});
