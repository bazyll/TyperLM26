import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/database.types";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function bootstrapAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support modern SUPABASE_SECRET_KEY with fallback to SUPABASE_SERVICE_ROLE_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error("BŁĄD: Brak zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL oraz SUPABASE_SECRET_KEY (lub SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }

  const adminClient = createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const username = (process.env.BOOTSTRAP_ADMIN_USERNAME || "admin").toLowerCase().trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AdminStartowe2026!";
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRSTNAME || "Administrator";
  const lastName = process.env.BOOTSTRAP_ADMIN_LASTNAME || "Główny";

  console.log(`[BOOTSTRAP] Tworzenie konta pierwszego administratora (@${username})...`);

  // Check if profile or mapping already exists
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();

  if (existingProfile) {
    console.log(`[BOOTSTRAP] Administrator @${username} już istnieje (ID: ${existingProfile.id}).`);
    return;
  }

  const internalEmail = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@typerlm26.auth`;

  // Step 1: Create Supabase Auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password: password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (authError || !authData.user) {
    console.error("[BOOTSTRAP] Błąd tworzenia użytkownika w Supabase Auth:", authError);
    process.exit(1);
  }

  const userId = authData.user.id;

  try {
    // Step 2: Insert into auth_mappings
    const { error: mapError } = await adminClient.from("auth_mappings").insert({
      user_id: userId,
      username: username,
      auth_email: internalEmail,
    });

    if (mapError) throw mapError;

    // Step 3: Insert into profiles
    const { error: profError } = await adminClient.from("profiles").insert({
      id: userId,
      username: username,
      first_name: firstName,
      last_name: lastName,
      role: "admin",
      is_active: true,
    });

    if (profError) throw profError;

    // Step 4: Record audit log
    await adminClient.from("audit_logs").insert({
      actor_id: userId,
      action: "BOOTSTRAP_ADMIN_CREATED",
      target_type: "user",
      target_id: userId,
      details: { username, role: "admin" },
    });

    console.log("==================================================");
    console.log("SUKCES: Pierwszy administrator został pomyślnie utworzony!");
    console.log(`Login (username): ${username}`);
    console.log(`Imię i nazwisko: ${firstName} ${lastName}`);
    console.log(`Rola: admin`);
    console.log("==================================================");
  } catch (err) {
    console.error("[BOOTSTRAP] Błąd podczas tworzenia powiązanych rekordów bazy. Wykonuję rollback użytkownika Auth...", err);
    await adminClient.auth.admin.deleteUser(userId);
    console.log("[BOOTSTRAP] Rollback zakończony.");
    process.exit(1);
  }
}

bootstrapAdmin();
