import { getSpecialCategoriesWithPredictionsAction } from "@/lib/specials/actions";
import { createClient } from "@/lib/supabase/server";
import { SpecialPredictionsClient } from "@/components/specials/special-predictions-client";
import { Star, ShieldAlert } from "lucide-react";
import { Database } from "@/types/database.types";
import { UclHeaderAccent } from "@/components/branding/ucl-header-accent";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

export const dynamic = "force-dynamic";

export default async function SpecialPredictionsPage() {
  const supabase = await createClient();

  const [categories, { data: rawTeams }, { data: rawPlayers }, { data: rawSetting }] = await Promise.all([
    getSpecialCategoriesWithPredictionsAction(),
    supabase.from("teams").select("*").order("name", { ascending: true }),
    supabase.from("players").select("*").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("app_settings").select("value_int").eq("key", "uefa_squads_reconciliation_complete").maybeSingle(),
  ]);

  const teams = (rawTeams || []) as unknown as TeamRow[];
  const players = (rawPlayers || []) as unknown as PlayerRow[];
  const isUefaReconciliationComplete = Boolean(
    (rawSetting as { value_int?: number | null } | null)?.value_int === 1
  );

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Star className="w-3.5 h-3.5" />
          Typy długoterminowe (20 pkt za trafienie)
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Typy Specjalne
        </h1>
        <UclHeaderAccent />
      </div>

      <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-950/40 border border-blue-500/20 text-xs text-blue-300">
        <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0" />
        <span>
          Maksymalnie do zdobycia w Typach Specjalnych: <strong>120 pkt</strong> (6 kategorii po 20 pkt). Po upływie deadline&apos;u typy zostaną zablokowane i odsłonięte dla wszystkich graczy.
        </span>
      </div>

      <SpecialPredictionsClient
        initialCategories={categories}
        teams={teams}
        players={players}
        isUefaReconciliationComplete={isUefaReconciliationComplete}
      />
    </div>
  );
}
