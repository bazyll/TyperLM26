"use client";

import { useState } from "react";
import { Table as TableIcon, Target, Sparkles, Info } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { UCLStandingRow, UCLTableMode } from "@/lib/scoring/ucl-table";
import { LeagueCompletenessInfo } from "@/types";
import { PlayerScorerAssistRankingItem } from "@/lib/goal-api/types";
import { ScorersTable } from "./scorers-table";
import { AssistsTable } from "./assists-table";

interface UCLTableViewProps {
  table: UCLStandingRow[];
  completeness: LeagueCompletenessInfo;
  mode: UCLTableMode;
  scorers: PlayerScorerAssistRankingItem[];
  assists: PlayerScorerAssistRankingItem[];
}

export function UCLTableView({
  table,
  completeness,
  mode,
  scorers,
  assists,
}: UCLTableViewProps) {
  const [activeTab, setActiveTab] = useState<"table" | "scorers" | "assists">("table");

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <TableIcon className="w-3.5 h-3.5" />
          Faza ligowa UEFA Champions League 2026/2027
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {activeTab === "table"
            ? "Tabela Ligi Mistrzów"
            : activeTab === "scorers"
            ? "Klasyfikacja Strzelców"
            : "Klasyfikacja Asystentów"}
        </h1>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("table")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "table"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>Tabela</span>
        </button>

        <button
          onClick={() => setActiveTab("scorers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "scorers"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Strzelcy</span>
          {scorers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-blue-900/60 text-[10px] text-blue-200 font-extrabold">
              {scorers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("assists")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "assists"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Asysty</span>
          {assists.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-purple-900/60 text-[10px] text-purple-200 font-extrabold">
              {assists.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LEAGUE TABLE */}
      {activeTab === "table" && (
        <div className="flex flex-col gap-6">
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
                              ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                              : "text-slate-500"
                          }`}
                        >
                          {row.rank}
                        </span>
                      </td>

                      {/* Team Info */}
                      <td className="py-2.5 px-3 sm:px-4 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          <TeamLogo
                            logoUrl={row.team.logoUrl}
                            teamName={row.team.name}
                            teamCode={row.team.code}
                            size={24}
                          />
                          <span className="hidden sm:inline truncate">{row.team.name}</span>
                          <span className="sm:hidden font-mono font-bold text-xs">{row.team.code}</span>
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="py-2.5 px-2 sm:px-3 text-center text-slate-300 font-medium">
                        {row.played}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden sm:table-cell">
                        {row.won}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden sm:table-cell">
                        {row.drawn}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden sm:table-cell">
                        {row.lost}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-center text-slate-400 hidden md:table-cell font-mono text-xs">
                        {row.goalsFor}:{row.goalsAgainst}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-center font-mono text-xs font-medium">
                        <span
                          className={
                            row.goalDifference > 0
                              ? "text-emerald-400"
                              : row.goalDifference < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }
                        >
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-extrabold text-white text-sm sm:text-base">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCORERS */}
      {activeTab === "scorers" && <ScorersTable scorers={scorers} />}

      {/* TAB 3: ASSISTS */}
      {activeTab === "assists" && <AssistsTable assists={assists} />}
    </div>
  );
}
