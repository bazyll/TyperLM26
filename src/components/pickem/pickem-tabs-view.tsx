"use client";

import React, { useState } from "react";
import { Trophy, GitBranch, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PickemClient } from "./pickem-client";
import { KnockoutBracket } from "./knockout-bracket";
import { Database } from "@/types/database.types";
import { PickemSubmissionWithDetails } from "@/types";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type ConfigRow = Database["public"]["Tables"]["pickem_config"]["Row"];

interface PickemTabsViewProps {
  config: ConfigRow | null;
  teams: TeamRow[];
  initialSubmission: PickemSubmissionWithDetails | null;
  allSubmissions: Array<{
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    pointsAwarded?: number | null;
    firstTeamId?: string;
    top8TeamIds?: string[];
    outTeamIds?: string[];
  }>;
}

export function PickemTabsView({
  config,
  teams,
  initialSubmission,
  allSubmissions,
}: PickemTabsViewProps) {
  const [activeStage, setActiveStage] = useState<"league" | "knockout">("league");
  const multiplier = config?.points_multiplier || 1;
  const pointsPerHit = 3 * multiplier;

  return (
    <div className="flex flex-col gap-6">
      {/* Stage Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#182645] pb-2">
        <Button
          size="sm"
          variant={activeStage === "league" ? "default" : "outline"}
          onClick={() => setActiveStage("league")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeStage === "league"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#0c1527]/60 text-slate-300 hover:text-white"
          }`}
        >
          <Trophy className="w-3.5 h-3.5 mr-1.5" /> Faza ligowa
        </Button>
        <Button
          size="sm"
          variant={activeStage === "knockout" ? "default" : "outline"}
          onClick={() => setActiveStage("knockout")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeStage === "knockout"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#0c1527]/60 text-slate-300 hover:text-white"
          }`}
        >
          <GitBranch className="w-3.5 h-3.5 mr-1.5" /> Faza pucharowa
        </Button>
      </div>

      {/* TAB 1: FAZA LIGOWA */}
      {activeStage === "league" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-950/40 border border-blue-500/20 text-xs text-blue-300">
            <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0" />
            <span>
              Wybierz: <strong>1 FIRST</strong> (1. miejsce), <strong>7 TOP 8</strong> (miejsca 1–8) oraz <strong>8 OUT</strong> (miejsca 25–36). Pozostałe 20 drużyn zostanie automatycznie przypisanych do <strong>MIDDLE</strong> (miejsca 9–24). Trafienie w strefę: <strong>{pointsPerHit} pkt</strong> za każdy klub {multiplier > 1 ? `(mnożnik x${multiplier})` : ""}.
            </span>
          </div>

          <PickemClient
            config={config}
            teams={teams}
            initialSubmission={initialSubmission}
            allSubmissions={allSubmissions}
          />
        </div>
      )}

      {/* TAB 2: FAZA PUCHAROWA */}
      {activeStage === "knockout" && (
        <KnockoutBracket />
      )}
    </div>
  );
}
