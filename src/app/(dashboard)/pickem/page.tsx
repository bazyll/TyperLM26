import { getPickemDataAction } from "@/lib/pickem/actions";
import { PickemClient } from "@/components/pickem/pickem-client";
import { Trophy, ShieldAlert } from "lucide-react";
import { UclHeaderAccent } from "@/components/branding/ucl-header-accent";

export const dynamic = "force-dynamic";

export default async function PickemPage() {
  const data = await getPickemDataAction();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Trophy className="w-3.5 h-3.5" />
          Faza Ligowa UEFA Champions League 2026/27
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Pick&apos;em Tabeli Ligowej
        </h1>
        <UclHeaderAccent />
      </div>

      <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-950/40 border border-blue-500/20 text-xs text-blue-300">
        <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0" />
        <span>
          Wybierz: <strong>1 FIRST</strong> (1. miejsce), <strong>7 TOP 8</strong> (miejsca 1–8) oraz <strong>8 OUT</strong> (miejsca 25–36). Pozostałe 20 drużyn zostanie automatycznie przypisanych do <strong>MIDDLE</strong> (miejsca 9–24).
        </span>
      </div>

      <PickemClient
        config={data.config}
        teams={data.teams}
        initialSubmission={data.userSubmission}
        allSubmissions={data.allSubmissions}
      />
    </div>
  );
}
