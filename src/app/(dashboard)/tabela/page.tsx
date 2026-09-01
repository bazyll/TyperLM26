import { getUCLTableAction } from "@/lib/table/actions";
import { Table as TableIcon, Info, Sparkles } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";

export const dynamic = "force-dynamic";

export default async function TablePage() {
  const { table, completeness, mode } = await getUCLTableAction();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <TableIcon className="w-3.5 h-3.5" />
          Faza ligowa UEFA Champions League 2026/2027
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Tabela Ligi Mistrzów
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Tabela generowana automatycznie z wprowadzonych przez administratora wyników meczów fazy ligowej.
        </p>
      </div>

      {/* Mode & Completeness Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-slate-300">
            Rozegrano spotkań:{" "}
            <strong className="text-white">
              {completeness.finishedMatchesCount} / {completeness.totalScheduledMatches}
            </strong>{" "}
            ({completeness.teamsWith8MatchesCount} / 36 drużyn z kompletem 8 meczów).
          </span>
        </div>
        <span
          className={`px-3 py-1 rounded-full font-bold uppercase text-[10px] ${
            mode === "final"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
          }`}
        >
          {mode === "final" ? "Tabela Końcowa (10 Tiebreakerów UEFA)" : "Tabela LIVE (W trakcie fazy)"}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-400" />
          <span className="text-slate-300">1–8: Bezpośredni awans do 1/8 finału</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500/60 border border-purple-400/80" />
          <span className="text-slate-300">9–24: Play-offy fazy pucharowej</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/40 border border-rose-400/60" />
          <span className="text-slate-300">25–36: Eliminacja z pucharów</span>
        </div>
      </div>

      {/* 36-Team League Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px] sm:text-xs">
              <tr>
                <th className="py-3 px-3 sm:px-4 text-center w-10 sm:w-12">#</th>
                <th className="py-3 px-3 sm:px-4">Klub</th>
                <th className="py-3 px-2 sm:px-3 text-center">M</th>
                <th className="py-3 px-2 sm:px-3 text-center hidden sm:table-cell">W</th>
                <th className="py-3 px-2 sm:px-3 text-center hidden sm:table-cell">R</th>
                <th className="py-3 px-2 sm:px-3 text-center hidden sm:table-cell">P</th>
                <th className="py-3 px-2 sm:px-3 text-center hidden md:table-cell">Bramki</th>
                <th className="py-3 px-2 sm:px-3 text-center">+/-</th>
                <th className="py-3 px-3 sm:px-4 text-right">PKT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {table.map((row) => (
                <tr
                  key={row.team.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    row.zone === "top8"
                      ? "bg-blue-950/10"
                      : row.zone === "playoff"
                      ? "bg-purple-950/5"
                      : "bg-rose-950/5"
                  }`}
                >
                  {/* Rank */}
                  <td className="py-2.5 px-3 sm:px-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                        row.zone === "top8"
                          ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                          : row.zone === "playoff"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {row.rank}
                    </span>
                  </td>

                  {/* Team with Crest */}
                  <td className="py-2.5 px-3 sm:px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-5 h-5 sm:w-6 sm:h-6 shrink-0 flex items-center justify-center">
                        <TeamLogo
                          logoUrl={row.team.logoUrl}
                          teamName={row.team.name}
                          teamCode={row.team.code}
                          size={24}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="font-bold text-white truncate max-w-[130px] sm:max-w-none">
                        {row.team.name}
                      </span>
                    </div>
                  </td>

                  {/* Played */}
                  <td className="py-2.5 px-2 sm:px-3 text-center text-slate-300 font-medium">
                    {row.played}
                  </td>

                  {/* Won, Drawn, Lost */}
                  <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden sm:table-cell">
                    {row.won}
                  </td>
                  <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden sm:table-cell">
                    {row.drawn}
                  </td>
                  <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden sm:table-cell">
                    {row.lost}
                  </td>

                  {/* Goals */}
                  <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden md:table-cell font-mono">
                    {row.goalsFor}:{row.goalsAgainst}
                  </td>

                  {/* Goal Difference */}
                  <td className="py-2.5 px-2 sm:px-3 text-center font-bold text-slate-200 font-mono">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>

                  {/* Points */}
                  <td className="py-2.5 px-3 sm:px-4 text-right font-extrabold text-blue-400 text-sm sm:text-base">
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
