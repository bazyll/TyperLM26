"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MatchWithTeams } from "@/types";

interface UpcomingMatchesProps {
  matches: MatchWithTeams[];
}

export function UpcomingMatches({ matches }: UpcomingMatchesProps) {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFav = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Nadchodzące mecze
        </h2>
        <Link
          href="/mecze"
          className="flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>Zobacz wszystkie</span>
          <ChevronRight className="w-4 h-4 ml-0.5" />
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="p-8 rounded-2xl border border-[#182645] bg-[#0c1527] text-center text-xs text-slate-400">
          Brak zaplanowanych meczów w najbliższym czasie.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {matches.map((match) => {
            const isFav = favorites[match.id];
            const isLive = match.status === "live";
            const kickoff = new Date(match.kickoffAt);
            const dateStr = kickoff.toLocaleDateString("pl-PL", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const timeStr = kickoff.toLocaleTimeString("pl-PL", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={match.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all group",
                  isLive
                    ? "border-red-500/50 bg-gradient-to-r from-[#1c0d1b] via-[#0c1527] to-[#0c1527] shadow-lg shadow-red-950/20"
                    : "border-[#182645] bg-[#0c1527] hover:bg-[#101d36]"
                )}
              >
                {/* Star & Date / Status */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    aria-label="Ulubiony mecz"
                    onClick={() => toggleFav(match.id)}
                    className="text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Star
                      className={cn(
                        "w-4 h-4",
                        isFav && "fill-amber-400 text-amber-400"
                      )}
                    />
                  </button>

                  <div className="flex flex-col text-xs leading-tight">
                    {isLive ? (
                      <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0 font-bold">
                        LIVE {match.liveMinute}&apos;
                      </Badge>
                    ) : (
                      <>
                        <span className="text-slate-200 font-semibold">{dateStr}</span>
                        <span className="text-slate-400">{timeStr}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Match Teams VS */}
                <div className="flex-1 flex items-center justify-center gap-2 sm:gap-6 px-2 min-w-0">
                  {/* Home Team */}
                  <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-white truncate text-right">
                      {match.homeTeam.name}
                    </span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#162444] border border-[#182645] flex items-center justify-center p-0.5 shrink-0 relative overflow-hidden">
                      <TeamLogo
                        logoUrl={match.homeTeam.logoUrl}
                        teamName={match.homeTeam.name}
                        teamCode={match.homeTeam.code}
                        size={32}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Score / VS Badge */}
                  {isLive ? (
                    <div className="px-2 py-0.5 rounded-lg bg-red-950 border border-red-500/40 text-red-300 font-mono font-black text-xs shrink-0">
                      {match.homeScore}:{match.awayScore}
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-[#162444]/60 border border-[#182645] shrink-0">
                      VS
                    </span>
                  )}

                  {/* Away Team */}
                  <div className="flex items-center justify-start gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#162444] border border-[#182645] flex items-center justify-center p-0.5 shrink-0 relative overflow-hidden">
                      <TeamLogo
                        logoUrl={match.awayTeam.logoUrl}
                        teamName={match.awayTeam.name}
                        teamCode={match.awayTeam.code}
                        size={32}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-white truncate text-left">
                      {match.awayTeam.name}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="shrink-0">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-semibold px-3 sm:px-4"
                  >
                    <Link href={`/mecze`}>
                      {match.userPrediction ? "Zmień typ" : "Typuj"}
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
