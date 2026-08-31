"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  Flame,
  Medal,
  Award,
  Crown,
  Grid,
  List,
  Loader2,
  Activity,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getLeaderboardAction, getRecentMatchesWithMatrixAction } from "@/lib/matches/actions";
import { LeaderboardEntry, MatchWithTeams } from "@/types";
import { Database } from "@/types/database.types";

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
  const remaining = leaderboard.slice(3);

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Trophy className="w-3.5 h-3.5" />
          Tabela Ligi
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Ranking Uczestników
        </h1>
      </div>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Rank 2 (Silver) */}
          {top3[1] && (
            <Card className="rounded-3xl border-slate-700/60 bg-gradient-to-b from-[#141e33] to-[#0c1527] p-5 sm:p-6 text-center order-2 sm:order-1 shadow-lg relative">
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
                {top3[1].firstName} {top3[1].lastName}
              </h2>
              <span className="text-xs text-slate-400">@{top3[1].username}</span>
              <div className="mt-3 py-1.5 px-3 rounded-xl bg-[#101d36] border border-[#182645] inline-block">
                <span className="text-lg font-extrabold text-white">{top3[1].totalPoints} pkt</span>
              </div>
            </Card>
          )}

          {/* Rank 1 (Gold) */}
          {top3[0] && (
            <Card className="rounded-3xl border-amber-500/50 bg-gradient-to-b from-[#241d10] via-[#171f33] to-[#0c1527] p-6 sm:p-7 text-center order-1 sm:order-2 shadow-2xl relative scale-105 z-10">
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
                {top3[0].firstName} {top3[0].lastName}
              </h2>
              <span className="text-xs text-amber-300 font-medium">@{top3[0].username}</span>
              <div className="mt-4 py-2 px-4 rounded-xl bg-amber-500/20 border border-amber-500/40 inline-block">
                <span className="text-2xl font-black text-amber-300">{top3[0].totalPoints} pkt</span>
              </div>
            </Card>
          )}

          {/* Rank 3 (Bronze) */}
          {top3[2] && (
            <Card className="rounded-3xl border-amber-800/40 bg-gradient-to-b from-[#1c181f] to-[#0c1527] p-5 sm:p-6 text-center order-3 shadow-lg relative">
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
                {top3[2].firstName} {top3[2].lastName}
              </h2>
              <span className="text-xs text-slate-400">@{top3[2].username}</span>
              <div className="mt-3 py-1.5 px-3 rounded-xl bg-[#101d36] border border-[#182645] inline-block">
                <span className="text-lg font-extrabold text-white">{top3[2].totalPoints} pkt</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Main Leaderboard Table */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
        <CardTitle className="text-lg font-bold text-white mb-4">Pełna Tabela Rankingu</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#101d36] font-semibold text-slate-400 border-b border-[#182645]">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Gracz</th>
                <th className="py-3.5 px-4 text-center">Dokładne (3p)</th>
                <th className="py-3.5 px-4 text-center">Różnica (2p)</th>
                <th className="py-3.5 px-4 text-center">Rezultat (1p)</th>
                <th className="py-3.5 px-4 text-center">Skuteczność</th>
                <th className="py-3.5 px-4 text-right">Punkty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182645]/60">
              {leaderboard.map((entry) => {
                const initials = `${entry.firstName[0] || "U"}${entry.lastName[0] || ""}`;
                return (
                  <tr key={entry.userId} className="hover:bg-[#162444]/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-center">
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

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 border border-blue-500/30">
                          {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} />}
                          <AvatarFallback className="bg-[#162444] text-xs text-blue-300 font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">
                            {entry.firstName} {entry.lastName}
                          </span>
                          <span className="text-xs text-slate-400">@{entry.username}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-400">
                      {entry.exactScoresCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-blue-400">
                      {entry.diffScoresCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-indigo-400">
                      {entry.outcomeScoresCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                      {entry.accuracyRate}%
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-base font-extrabold text-blue-400">
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

      {/* SECTION: LIVE MATCHES (Pinned at Top of Matches Matrix) */}
      {liveMatches.length > 0 && (
        <Card className="rounded-3xl border-red-500/50 bg-gradient-to-br from-[#1c0e18] via-[#0c1527] to-[#070b14] p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <CardTitle className="text-lg font-extrabold text-red-400">
              🔴 Mecze na Żywo (LIVE) — Dynamiczny Podgląd Punktów
            </CardTitle>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <div key={match.id} className="p-4 rounded-2xl bg-[#101d36]/80 border border-red-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    {match.homeTeam.name} {match.homeScore} : {match.awayScore} {match.awayTeam.name}
                  </span>
                  <Badge variant="destructive" className="text-[10px]">
                    LIVE • {match.liveMinute}&apos;
                  </Badge>
                </div>

                {/* Predictions grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#182645]">
                  {match.allPredictions?.map((pred) => (
                    <div key={pred.userId} className="flex items-center justify-between p-2 rounded-xl bg-[#0a1224]">
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

      {/* SECTION: LAST 5 MATCHES (Desktop Matrix & Mobile Cards) */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl flex flex-col gap-4">
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
          <>
            {/* DESKTOP VIEW: Matrix Table (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border border-[#182645] rounded-2xl overflow-hidden">
                <thead className="bg-[#101d36] font-semibold text-slate-300 border-b border-[#182645]">
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
                <tbody className="divide-y divide-[#182645]/60 bg-[#0a1224]/60">
                  {users.map((u) => {
                    return (
                      <tr key={u.id} className="hover:bg-[#162444]/40">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <Avatar className="w-6 h-6 border border-blue-500/20">
                            {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                            <AvatarFallback className="bg-[#162444] text-[10px] font-bold text-blue-300">
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
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#101d36] border border-[#182645]">
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

            {/* MOBILE VIEW: Dedicated Cards (No horizontal scroll on small screens) */}
            <div className="flex md:hidden flex-col gap-4">
              {recentMatches.map((match) => (
                <div
                  key={match.id}
                  className="p-4 rounded-2xl bg-[#101d36] border border-[#182645] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between border-b border-[#182645]/80 pb-2">
                    <span className="font-bold text-white text-sm">
                      {match.homeTeam.shortName} {match.homeScore ?? "-"} : {match.awayScore ?? "-"} {match.awayTeam.shortName}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {match.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {users.map((u) => {
                      const pred = match.allPredictions?.find((p) => p.userId === u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-[#0a1224] border border-[#182645]/40">
                          <span className="text-slate-300 truncate max-w-[80px] font-medium">
                            {u.first_name}
                          </span>
                          {pred ? (
                            <div className="flex items-center gap-1 font-mono">
                              <span className="font-bold text-white">{pred.homeScore}:{pred.awayScore}</span>
                              <span
                                className={`text-[10px] font-extrabold px-1 rounded ${
                                  pred.pointsAwarded === 3
                                    ? "text-emerald-400"
                                    : pred.pointsAwarded === 2
                                    ? "text-blue-400"
                                    : pred.pointsAwarded === 1
                                    ? "text-indigo-400"
                                    : "text-slate-500"
                                }`}
                              >
                                +{pred.pointsAwarded ?? 0}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px]">Brak</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
