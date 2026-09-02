"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  Crown,
  Loader2,
  Calendar,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TeamLogo } from "@/components/team-logo";
import { getRankingPageDataAction } from "@/lib/matches/actions";
import { LeaderboardEntry, MatchWithTeams } from "@/types";
import { useRealtimeMatches } from "@/lib/supabase/use-realtime-matches";
import Link from "next/link";

export default function RankingPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [focusMatches, setFocusMatches] = useState<MatchWithTeams[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await getRankingPageDataAction();
      setLeaderboard(data.leaderboard);
      setFocusMatches(data.focusMatches);
    } catch (err) {
      console.error("Error loading ranking data:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Supabase Realtime: update match scores live & reload leaderboard when match finishes
  useRealtimeMatches({
    onMatchUpdate: (updated) => {
      setFocusMatches((prev) =>
        prev.map((m) =>
          m.id === updated.id
            ? {
                ...m,
                homeScore: updated.home_score ?? m.homeScore,
                awayScore: updated.away_score ?? m.awayScore,
                status: updated.status,
                isManualOverride: updated.is_manual_override,
                isBettingLocked: updated.is_betting_locked,
              }
            : m
        )
      );

      // If a match is finalized, refresh official leaderboard without full-page spinner
      if (updated.status === "finished") {
        loadData(false);
      }
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-5xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Trophy className="w-3.5 h-3.5" />
          Oficjalna Tabela Ligi TyperLM26
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Ranking Główny Uczestników
        </h1>
      </div>

      {/* Subtle Top 3 Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 items-end">
          {/* Rank 2 (Silver) */}
          {top3[1] && (
            <Card className="rounded-2xl sm:rounded-3xl border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-950 p-4 sm:p-5 text-center order-2 sm:order-1 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-300 text-slate-900 font-extrabold text-xs flex items-center justify-center shadow-md">
                2
              </div>
              <Avatar className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-2.5 border-2 border-slate-400/50 shadow-md">
                {top3[1].avatarUrl && <AvatarImage src={top3[1].avatarUrl} />}
                <AvatarFallback className="bg-slate-800 text-slate-200 font-bold text-xs sm:text-sm">
                  {top3[1].firstName[0]}
                  {top3[1].lastName[0]}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-bold text-white text-sm sm:text-base truncate">
                <Link href={`/profil/${top3[1].username}`} className="hover:underline">
                  {top3[1].firstName} {top3[1].lastName}
                </Link>
              </h2>
              <span className="text-[11px] text-slate-400">@{top3[1].username}</span>
              <div className="mt-2 py-1 px-3 rounded-xl bg-slate-900 border border-slate-800 inline-block">
                <span className="text-base sm:text-lg font-extrabold text-white">{top3[1].totalPoints} pkt</span>
              </div>
            </Card>
          )}

          {/* Rank 1 (Gold) */}
          {top3[0] && (
            <Card className="rounded-2xl sm:rounded-3xl border-amber-500/50 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 p-5 sm:p-6 text-center order-1 sm:order-2 shadow-xl relative sm:scale-105 z-10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 font-black text-sm flex items-center justify-center shadow-lg">
                <Crown className="w-4 h-4" />
              </div>
              <Avatar className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2.5 border-2 border-amber-400 shadow-xl">
                {top3[0].avatarUrl && <AvatarImage src={top3[0].avatarUrl} />}
                <AvatarFallback className="bg-amber-950 text-amber-300 font-extrabold text-base">
                  {top3[0].firstName[0]}
                  {top3[0].lastName[0]}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-extrabold text-white text-base sm:text-lg truncate">
                <Link href={`/profil/${top3[0].username}`} className="hover:underline">
                  {top3[0].firstName} {top3[0].lastName}
                </Link>
              </h2>
              <span className="text-[11px] text-amber-300 font-medium">@{top3[0].username}</span>
              <div className="mt-2.5 py-1.5 px-4 rounded-xl bg-amber-500/20 border border-amber-500/40 inline-block">
                <span className="text-lg sm:text-xl font-black text-amber-300">{top3[0].totalPoints} pkt</span>
              </div>
            </Card>
          )}

          {/* Rank 3 (Bronze) */}
          {top3[2] && (
            <Card className="rounded-2xl sm:rounded-3xl border-amber-800/40 bg-gradient-to-b from-amber-950/20 to-slate-950 p-4 sm:p-5 text-center order-3 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-700 text-amber-100 font-extrabold text-xs flex items-center justify-center shadow-md">
                3
              </div>
              <Avatar className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-2.5 border-2 border-amber-700/50 shadow-md">
                {top3[2].avatarUrl && <AvatarImage src={top3[2].avatarUrl} />}
                <AvatarFallback className="bg-amber-950/80 text-amber-400 font-bold text-xs sm:text-sm">
                  {top3[2].firstName[0]}
                  {top3[2].lastName[0]}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-bold text-white text-sm sm:text-base truncate">
                <Link href={`/profil/${top3[2].username}`} className="hover:underline">
                  {top3[2].firstName} {top3[2].lastName}
                </Link>
              </h2>
              <span className="text-[11px] text-slate-400">@{top3[2].username}</span>
              <div className="mt-2 py-1 px-3 rounded-xl bg-slate-900 border border-slate-800 inline-block">
                <span className="text-base sm:text-lg font-extrabold text-white">{top3[2].totalPoints} pkt</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Main Ranking Table: GRACZ | PKT | MECZ 1 | MECZ 2 | MECZ 3 | MECZ 4 */}
      <Card className="rounded-2xl sm:rounded-3xl border-[#182645] bg-[#0c1527] shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#182645] flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-white">
              Tabela Uczestników & Ostatnie Mecze
            </CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              Porównanie punktacji i typów dla meczów LIVE oraz ostatnio rozegranych.
            </p>
          </div>
        </div>

        {/* Responsive Table with horizontal scroll on mobile */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-[#101d36] text-slate-300 font-semibold border-b border-[#182645] text-[11px] sm:text-xs">
              <tr>
                {/* 1. GRACZ (Sticky on mobile) */}
                <th className="py-3 px-3 sm:px-4 sticky left-0 bg-[#101d36] z-10 w-44 sm:w-56 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  Gracz
                </th>

                {/* 2. PKT */}
                <th className="py-3 px-3 sm:px-4 text-center w-20 sm:w-24">
                  PKT
                </th>

                {/* 3..6 FOCUS MATCHES COLUMNS */}
                {focusMatches.map((m) => {
                  const isLive = m.status === "live";
                  return (
                    <th key={m.id} className="py-2.5 px-3 text-center min-w-[125px] sm:min-w-[140px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-4 h-4 shrink-0">
                          <TeamLogo
                            logoUrl={m.homeTeam.logoUrl}
                            teamName={m.homeTeam.name}
                            teamCode={m.homeTeam.code}
                            size={16}
                          />
                        </div>
                        <span className="font-bold text-white tracking-tight">
                          {m.homeTeam.code} - {m.awayTeam.code}
                        </span>
                        <div className="w-4 h-4 shrink-0">
                          <TeamLogo
                            logoUrl={m.awayTeam.logoUrl}
                            teamName={m.awayTeam.name}
                            teamCode={m.awayTeam.code}
                            size={16}
                          />
                        </div>
                      </div>

                      {/* Subtitle with score / status */}
                      <div className="text-[10px] mt-0.5 font-mono font-bold">
                        {isLive ? (
                          <span className="text-red-400">
                            LIVE • {m.homeScore ?? 0}:{m.awayScore ?? 0}
                          </span>
                        ) : (
                          <span className="text-blue-300">
                            {m.homeScore ?? "-"}:{m.awayScore ?? "-"}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#182645]/60 bg-[#0c1527]">
              {leaderboard.map((entry) => {
                const initials = `${entry.firstName[0] || "U"}${entry.lastName[0] || ""}`;
                return (
                  <tr key={entry.userId} className="hover:bg-[#101d36]/60 transition-colors">
                    {/* 1. GRACZ Column (Sticky Left) */}
                    <td className="py-3 px-3 sm:px-4 sticky left-0 bg-[#0c1527] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rank Badge */}
                        <span className="w-5 text-center font-bold text-xs shrink-0">
                          {entry.rank === 1 ? (
                            <span className="text-amber-400">🥇</span>
                          ) : entry.rank === 2 ? (
                            <span className="text-slate-300">🥈</span>
                          ) : entry.rank === 3 ? (
                            <span className="text-amber-600">🥉</span>
                          ) : (
                            <span className="text-slate-400">{entry.rank}</span>
                          )}
                        </span>

                        <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border border-blue-500/30 shrink-0">
                          {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} />}
                          <AvatarFallback className="bg-[#162444] text-[10px] text-blue-300 font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <Link href={`/profil/${entry.username}`} className="flex flex-col truncate hover:underline">
                          <span className="font-bold text-white truncate text-xs sm:text-sm">
                            {entry.firstName} {entry.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">@{entry.username}</span>
                        </Link>
                      </div>
                    </td>

                    {/* 2. PKT Column */}
                    <td className="py-3 px-3 sm:px-4 text-center font-black text-sm sm:text-base text-white">
                      {entry.totalPoints}
                    </td>

                    {/* 3..6 Focus Match Predictions */}
                    {focusMatches.map((m) => {
                      const pred = m.allPredictions?.find((p) => p.userId === entry.userId);
                      const isFinished = m.status === "finished";
                      const isLive = m.status === "live";

                      if (!pred) {
                        return (
                          <td key={m.id} className="py-3 px-3 text-center text-slate-600 text-xs font-mono">
                            -
                          </td>
                        );
                      }

                      return (
                        <td key={m.id} className="py-3 px-3 text-center font-mono">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#101d36] border border-[#182645]">
                            <span className="text-white font-bold text-xs">
                              {pred.homeScore}:{pred.awayScore}
                            </span>

                            {/* Finished points badge */}
                            {isFinished && pred.pointsAwarded !== null && (
                              <span
                                className={`text-[10px] font-extrabold px-1 rounded ${
                                  pred.pointsAwarded === 3
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                    : pred.pointsAwarded === 2
                                    ? "bg-blue-950 text-blue-300 border border-blue-500/30"
                                    : pred.pointsAwarded === 1
                                    ? "bg-indigo-950 text-indigo-300 border border-indigo-500/30"
                                    : "bg-slate-900 text-slate-500 border border-slate-800"
                                }`}
                              >
                                +{pred.pointsAwarded}
                              </span>
                            )}

                            {/* Live points badge */}
                            {isLive && (
                              <span className="text-[10px] font-extrabold px-1 rounded bg-red-950 text-red-300 border border-red-500/30">
                                +{pred.livePoints}p
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
