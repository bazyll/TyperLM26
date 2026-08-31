import Link from "next/link";
import { ChevronRight, Target, Trophy, Award, Flame } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserMatchStats } from "@/types";

interface UserStatsWidgetProps {
  stats: UserMatchStats | null;
  userRank?: number;
  totalUsers?: number;
}

export function UserStatsWidget({ stats, userRank, totalUsers }: UserStatsWidgetProps) {
  return (
    <Card className="rounded-3xl border-[#182645] bg-[#0c1527] overflow-hidden shadow-xl">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg font-bold text-white tracking-tight">
          Twoje statystyki
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-0 flex flex-col gap-4">
        {/* Top 2 Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#162444]/40 border border-[#182645] p-3 text-center flex flex-col justify-center">
            <span className="text-[11px] font-medium text-slate-400">
              Pozycja w lidze
            </span>
            <div className="text-lg font-extrabold text-white mt-1">
              {userRank ? (
                <>
                  {userRank} <span className="text-xs text-slate-400 font-normal">/ {totalUsers || 10}</span>
                </>
              ) : (
                "-"
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-[#162444]/40 border border-[#182645] p-3 text-center flex flex-col justify-center">
            <span className="text-[11px] font-medium text-slate-400">
              Punkty meczowe
            </span>
            <div className="text-lg font-extrabold text-blue-400 mt-1">
              {stats ? stats.totalPoints : 0}
            </div>
          </div>
        </div>

        {/* Bottom 2 Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#162444]/40 border border-[#182645] p-3 text-center flex flex-col justify-center">
            <span className="text-[11px] font-medium text-slate-400">
              Skuteczność
            </span>
            <div className="text-base font-extrabold text-emerald-400 mt-1">
              {stats ? `${stats.accuracyRate}%` : "0%"}
            </div>
          </div>

          <div className="rounded-2xl bg-[#162444]/40 border border-[#182645] p-3 text-center flex flex-col justify-center">
            <span className="text-[11px] font-medium text-slate-400">
              Dokładne (3p)
            </span>
            <div className="text-base font-extrabold text-amber-400 mt-1">
              {stats ? stats.exactScoresCount : 0}
            </div>
          </div>
        </div>

        {/* Detailed Stats Link */}
        <div className="pt-1 border-t border-[#182645]/60 text-center">
          <Link
            href="/konto"
            className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors py-1"
          >
            <span>Szczegółowa historia</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
