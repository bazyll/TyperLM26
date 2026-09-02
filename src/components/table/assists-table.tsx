import { TeamLogo } from "@/components/team-logo";
import { PlayerScorerAssistRankingItem } from "@/lib/goal-api/types";
import { Sparkles, Footprints } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssistsTableProps {
  assists: PlayerScorerAssistRankingItem[];
}

export function AssistsTable({ assists }: AssistsTableProps) {
  if (assists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-slate-800 bg-slate-900/90 text-center shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Brak danych</h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
          Statystyki asyst pojawią się po rozegraniu pierwszych meczów.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px] sm:text-xs">
            <tr>
              <th className="py-3 px-3 sm:px-4 text-center w-10 sm:w-12">#</th>
              <th className="py-3 px-3 sm:px-4">Zawodnik</th>
              <th className="py-3 px-3 sm:px-4">Klub</th>
              <th className="py-3 px-3 sm:px-4 text-center">Gole</th>
              <th className="py-3 px-3 sm:px-4 text-right">Asysty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {assists.map((player, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;

              return (
                <tr
                  key={`${player.scorerExternalId || player.playerName}__${player.teamId || idx}`}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    rank === 1
                      ? "bg-purple-950/20"
                      : isTop3
                      ? "bg-purple-950/10"
                      : ""
                  }`}
                >
                  {/* Rank */}
                  <td className="py-2.5 px-3 sm:px-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                        rank === 1
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          : rank === 2
                          ? "bg-slate-400/20 text-slate-200 border border-slate-400/40"
                          : rank === 3
                          ? "bg-purple-700/20 text-purple-400 border border-purple-700/40"
                          : "text-slate-400"
                      }`}
                    >
                      {rank}
                    </span>
                  </td>

                  {/* Player Name & Avatar Fallback */}
                  <td className="py-2.5 px-3 sm:px-4 font-semibold text-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {player.playerName.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span className="block truncate">{player.playerName}</span>
                      </div>
                    </div>
                  </td>

                  {/* Team */}
                  <td className="py-2.5 px-3 sm:px-4">
                    <div className="flex items-center gap-2">
                      <TeamLogo
                        logoUrl={player.teamLogoUrl}
                        teamName={player.teamName || player.teamCode || ""}
                        teamCode={player.teamCode || ""}
                        size={20}
                      />
                      <span className="text-slate-300 text-xs hidden sm:inline truncate max-w-[140px]">
                        {player.teamName || player.teamCode || "—"}
                      </span>
                      <span className="text-slate-400 text-xs sm:hidden font-mono font-semibold">
                        {player.teamCode || "—"}
                      </span>
                    </div>
                  </td>

                  {/* Goals */}
                  <td className="py-2.5 px-3 sm:px-4 text-center font-medium text-slate-300">
                    {player.goalsCount}
                  </td>

                  {/* Assists (Primary) */}
                  <td className="py-2.5 px-3 sm:px-4 text-right">
                    <Badge className="bg-purple-600/30 border border-purple-500/50 text-purple-300 font-extrabold text-xs px-2.5 py-0.5">
                      {player.assistsCount}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
