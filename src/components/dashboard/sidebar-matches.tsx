import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamLogo } from "@/components/team-logo";
import { MatchWithTeams } from "@/types";

interface SidebarMatchesProps {
  matches: MatchWithTeams[];
}

export function SidebarMatches({ matches }: SidebarMatchesProps) {
  return (
    <Card className="rounded-3xl border-[#182645] bg-[#0c1527] overflow-hidden shadow-xl">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg font-bold text-white tracking-tight flex items-center justify-between">
          <span>Mecze</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-0 flex flex-col gap-3">
        {matches.length === 0 ? (
          <div className="p-6 rounded-2xl border border-[#182645] bg-[#101d36]/50 text-center text-xs text-slate-400">
            Brak zaplanowanych meczów
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {matches.map((match) => {
              const isLive = match.status === "live";
              const isFinished = match.status === "finished";
              const kickoff = new Date(match.kickoffAt);

              const isToday =
                kickoff.toDateString() === new Date().toDateString();

              const timeStr = kickoff.toLocaleTimeString("pl-PL", {
                hour: "2-digit",
                minute: "2-digit",
              });

              const dateStr = isToday
                ? `Dzisiaj • ${timeStr}`
                : `${kickoff.toLocaleDateString("pl-PL", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })} • ${timeStr}`;

              return (
                <Link
                  key={match.id}
                  href="/mecze"
                  className={`flex flex-col gap-2 p-3 rounded-2xl border transition-all group ${
                    isLive
                      ? "border-red-500/40 bg-gradient-to-r from-[#1c0d1b] to-[#0c1527] hover:border-red-500/60"
                      : "border-[#182645] bg-[#101d36]/60 hover:bg-[#101d36] hover:border-blue-500/30"
                  }`}
                >
                  {/* Status / Kickoff Header */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="font-medium">{dateStr}</span>
                    </div>

                    {isLive ? (
                      <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0 font-bold">
                        LIVE • {match.liveMinute || 0}&apos;
                      </Badge>
                    ) : isFinished ? (
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0">
                        ZAKOŃCZONY
                      </Badge>
                    ) : null}
                  </div>

                  {/* 2 Compact Team Rows */}
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    {/* Home Team */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                          <TeamLogo
                            logoUrl={match.homeTeam.logoUrl}
                            teamName={match.homeTeam.name}
                            teamCode={match.homeTeam.code}
                            size={20}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                          {match.homeTeam.name}
                        </span>
                      </div>
                      {(isLive || isFinished) && (
                        <span className="text-xs font-black text-white font-mono px-1">
                          {match.homeScore ?? "-"}
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                          <TeamLogo
                            logoUrl={match.awayTeam.logoUrl}
                            teamName={match.awayTeam.name}
                            teamCode={match.awayTeam.code}
                            size={20}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                          {match.awayTeam.name}
                        </span>
                      </div>
                      {(isLive || isFinished) && (
                        <span className="text-xs font-black text-white font-mono px-1">
                          {match.awayScore ?? "-"}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* See All Matches Link */}
        <div className="pt-2 border-t border-[#182645]/60 text-center">
          <Link
            href="/mecze"
            className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors py-1"
          >
            <span>Zobacz wszystkie mecze</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
