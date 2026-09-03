import { getPickemDataAction } from "@/lib/pickem/actions";
import { PickemTabsView } from "@/components/pickem/pickem-tabs-view";
import { Trophy } from "lucide-react";
import { UclHeaderAccent } from "@/components/branding/ucl-header-accent";

export const dynamic = "force-dynamic";

export default async function PickemPage() {
  const data = await getPickemDataAction();
  const multiplier = data.config?.points_multiplier || 1;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Trophy className="w-3.5 h-3.5" />
          UEFA Champions League 2026/2027
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pick&apos;em
          </h1>
          {multiplier > 1 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              x{multiplier} PUNKTY
            </span>
          )}
        </div>
        <UclHeaderAccent />
      </div>

      <PickemTabsView
        config={data.config}
        teams={data.teams}
        initialSubmission={data.userSubmission}
        allSubmissions={data.allSubmissions}
      />
    </div>
  );
}
