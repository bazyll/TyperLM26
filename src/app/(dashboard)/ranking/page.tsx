"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  Crown,
  Loader2,
  Activity,
  Star,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getLeaderboardAction, getRecentMatchesWithMatrixAction } from "@/lib/matches/actions";
import { LeaderboardEntry, MatchWithTeams } from "@/types";
import { Database } from "@/types/database.types";
import Link from "next/link";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default function RankingPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [liveMatches, setLiveMatches] = useState<MatchWithTeams[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchWithTeams[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [lb, matrixData] = await Promise.all([
          getLeaderboardAction(),
          getRecentMatchesWithMatrixAction(),
        ]);
        setLeaderboard(lb);
        setLiveMatches(matrixData.liveMatches);
        setRecentMatches(matrixData.recentMatches);
        setUsers(matrixData.users);
      } catch (err) {
        console.error("Error loading ranking data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Trophy className="w-3.5 h-3.5" />
          Oficjalna Tabela Ligi TyperLM26
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Ranking Główny Uczestników
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Suma punktów z meczów, typów specjalnych i Pick&apos;em fazy ligowej.
        </p>
      </div>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Rank 2 (Silver) */}
          {top3[1] && (
            <Card className="rounded-3xl border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-950 p-5 sm:p-6 text-center order-2 sm:order-1 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-extrabold text-xs flex items-center justify-center shadow-md">
                2
              </div>
              <Avatar className="w-16 h-16 mx-auto mb-3 border-2 border-slate-400/50 shadow-md">
                {top3[1].avatarUrl && <AvatarImage src={top3[1].avatarUrl} />}
                <AvatarFallback className="bg-slate-800 text-slate-200 font-bold">
                  {top3[1].firstName[0]}
                  {top3[1].lastName[0]}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-bold text-white text-base">
                <Link href={`/profil/${top3[1].username}`} className="hover:underline">
                  {top3[1].firstName} {top3[1].lastName}
                </Link>
              </h2>
              <span className="text-xs text-slate-400">@{top3[1].username}</span>
              <div className="mt-3 py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 inline-block">
                <span className="text-lg font-extrabold text-white">{top3[1].totalPoints} pkt</span>
              </div>
            </Card>
          )}

          {/* Rank 1 (Gold) */}
          {top3[0] && (
            <Card className="rounded-3xl border-amber-500/50 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 p-6 sm:p-7 text-center order-1 sm:order-2 shadow-2xl relative scale-105 z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 font-black text-sm flex items-center justify-center shadow-lg">
                <Crown className="w-4 h-4" />
              </div>
              <Avatar className="w-20 h-20 mx-auto mb-3 border-2 border-amber-400 shadow-xl">
                {top3[0].avatarUrl && <AvatarImage src={top3[0].avatarUrl} />}
                <AvatarFallback className="bg-amber-950 text-amber-300 font-extrabold text-xl">
                  {top3[0].firstName[0]}
                  {top3[0].lastName[0]}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-extrabold text-white text-lg">
                <Link href={`/profil/${top3[0].username}`} className="hover:underline">
                  {top3[0].firstName} {top3[0].lastName}
                </Link>
              </h2>
              <span className="text-xs text-amber-300 font-medium">@{top3[0].username}</span>
              <div className="mt-4 py-2 px-4 rounded-xl bg-amber-500/20 border border-amber-500/40 inline-block">
                <span className="text-2xl font-black text-amber-300">{top3[0].totalPoints} pkt</span>
              </div>
            </Card>
          )}

          {/* Rank 3 (Bronze) */}
          {top3[2] && (
            <Card className="rounded-3xl border-amber-800/40 bg-gradient-to-b from-amber-950/20 to-slate-950 p-5 sm:p-6 text-center order-3 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-amber-700 text-amber-100 font-extrabold text-xs flex items-center justify-center shadow-md">
                3
              </div>
              <Avatar className="w-16 h-16 mx-auto mb-3 border-2 border-amber-700/50 shadow-md">
                {top3[2].avatarUrl && <AvatarImage src={top3[2].avatarUrl} />}
                <AvatarFallback className="bg-amber-950/80 text-amber-400 font-bold">
                  {top3[2].firstName[0]}
                  {top3[2].lastName[0]}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-bold text-white text-base">
                <Link href={`/profil/${top3[2].username}`} className="hover:underline">
                  {top3[2].firstName} {top3[2].lastName}
                </Link>
              </h2>
              <span className="text-xs text-slate-400">@{top3[2].username}</span>
              <div className="mt-3 py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 inline-block">
                <span className="text-lg font-extrabold text-white">{top3[2].totalPoints} pkt</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Main Leaderboard Table with Category Breakdown */}
      <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-lg font-bold text-white">Tabela Punktacji Ogólnej</CardTitle>
          <span className="text-xs text-slate-400">
            Tie-breaker: RAZEM &rarr; Dokładne (3p) &rarr; Nazwa A-Z
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 font-semibold text-slate-400 border-b border-slate-800 text-[11px] sm:text-xs">
              <tr>
                <th className="py-3.5 px-3 sm:px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-3 sm:px-4">Uczestnik</th>
                <th className="py-3.5 px-2 sm:px-3 text-center">Mecze</th>
                <th className="py-3.5 px-2 sm:px-3 text-center">Specjalne</th>
                <th className="py-3.5 px-2 sm:px-3 text-center">Pick&apos;em</th>
                <th className="py-3.5 px-2 sm:px-3 text-center hidden md:table-cell">Dokładne (3p)</th>
                <th className="py-3.5 px-2 sm:px-3 text-center hidden md:table-cell">Skuteczność</th>
                <th className="py-3.5 px-3 sm:px-4 text-right">RAZEM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leaderboard.map((entry) => {
                const initials = `${entry.firstName[0] || "U"}${entry.lastName[0] || ""}`;
                return (
                  <tr key={entry.userId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-3 sm:px-4 font-bold text-center">
                      {entry.rank === 1 ? (
                        <span className="text-amber-400 font-extrabold">🥇 1</span>
                      ) : entry.rank === 2 ? (
                        <span className="text-slate-300 font-extrabold">🥈 2</span>
                      ) : entry.rank === 3 ? (
                        <span className="text-amber-600 font-extrabold">🥉 3</span>
                      ) : (
                        <span className="text-slate-400">{entry.rank}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 sm:px-4">
                      <Link href={`/profil/${entry.username}`} className="flex items-center gap-2.5 hover:underline">
                        <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border border-blue-500/30 shrink-0">
                          {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} />}
                          <AvatarFallback className="bg-slate-800 text-[10px] sm:text-xs text-blue-300 font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col truncate">
                          <span className="font-semibold text-white truncate text-xs sm:text-sm">
                            {entry.firstName} {entry.lastName}
                          </span>
                          <span className="text-[10px] sm:text-xs text-slate-400 truncate">@{entry.username}</span>
                        </div>
                      </Link>
                    </td>

                    {/* Match Points */}
                    <td className="py-3.5 px-2 sm:px-3 text-center font-semibold text-blue-400">
                      {entry.matchPoints}
                    </td>

                    {/* Special Points */}
                    <td className="py-3.5 px-2 sm:px-3 text-center font-semibold text-purple-400">
                      {entry.specialPoints}
                    </td>

                    {/* Pickem Points */}
                    <td className="py-3.5 px-2 sm:px-3 text-center font-semibold text-amber-400">
                      {entry.pickemPoints}
                    </td>

                    {/* Exact Hits */}
                    <td className="py-3.5 px-2 sm:px-3 text-center font-semibold text-emerald-400 hidden md:table-cell">
                      {entry.exactScoresCount}
                    </td>

                    {/* Accuracy */}
                    <td className="py-3.5 px-2 sm:px-3 text-center font-semibold text-slate-400 hidden md:table-cell">
                      {entry.accuracyRate}%
                    </td>

                    {/* Total Points */}
                    <td className="py-3.5 px-3 sm:px-4 text-right">
                      <span className="text-sm sm:text-base font-extrabold text-white">
                        {entry.totalPoints} pkt
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SECTION: LIVE MATCHES */}
      {liveMatches.length > 0 && (
        <Card className="rounded-3xl border-red-500/50 bg-gradient-to-br from-red-950/20 via-slate-900 to-slate-950 p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <CardTitle className="text-lg font-extrabold text-red-400">
              🔴 Mecze na Żywo (LIVE) — Dynamiczny Podgląd Punktów
            </CardTitle>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <div key={match.id} className="p-4 rounded-2xl bg-slate-950/80 border border-red-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    {match.homeTeam.name} {match.homeScore} : {match.awayScore} {match.awayTeam.name}
                  </span>
                  <Badge variant="destructive" className="text-[10px]">
                    LIVE • {match.liveMinute}&apos;
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                  {match.allPredictions?.map((pred) => (
                    <div key={pred.userId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900">
                      <span className="text-slate-300 truncate max-w-[90px]">{pred.firstName}</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold">
                        <span>{pred.homeScore}:{pred.awayScore}</span>
                        <span className="text-red-400 font-extrabold">+{pred.livePoints}p</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SECTION: LAST 5 MATCHES MATRIX */}
      <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-4">
        <div>
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>Ostatnie 5 Meczów (Typy i Wyniki)</span>
          </CardTitle>
          <p className="text-xs text-slate-400 mt-1">
            Podgląd typów wszystkich graczy dla 5 ostatnich spotkań.
          </p>
        </div>

        {recentMatches.length === 0 ? (
          <p className="text-xs text-slate-500 p-6 text-center">Brak rozegranych spotkań.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-800 rounded-2xl overflow-hidden">
              <thead className="bg-slate-950 font-semibold text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-40">Uczestnik</th>
                  {recentMatches.map((m) => (
                    <th key={m.id} className="py-3 px-3 text-center min-w-[130px]">
                      <div className="font-bold text-white truncate">{m.homeTeam.code} vs {m.awayTeam.code}</div>
                      <div className="text-[11px] text-blue-400 font-black">
                        {m.homeScore ?? "-"}:{m.awayScore ?? "-"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                {users.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                        <Avatar className="w-6 h-6 border border-blue-500/20">
                          {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                          <AvatarFallback className="bg-slate-800 text-[10px] font-bold text-blue-300">
                            {u.first_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{u.first_name} {u.last_name[0]}.</span>
                      </td>

                      {recentMatches.map((m) => {
                        const pred = m.allPredictions?.find((p) => p.userId === u.id);
                        return (
                          <td key={m.id} className="py-3 px-3 text-center font-mono">
                            {pred ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                                <span className="text-slate-200 font-bold">{pred.homeScore}:{pred.awayScore}</span>
                                <span
                                  className={`text-[10px] font-extrabold px-1 rounded ${
                                    pred.pointsAwarded === 3
                                      ? "bg-emerald-950 text-emerald-300"
                                      : pred.pointsAwarded === 2
                                      ? "bg-blue-950 text-blue-300"
                                      : pred.pointsAwarded === 1
                                      ? "bg-indigo-950 text-indigo-300"
                                      : "bg-slate-900 text-slate-500"
                                  }`}
                                >
                                  +{pred.pointsAwarded ?? 0}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px]">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
