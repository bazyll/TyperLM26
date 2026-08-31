"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MatchItem {
  id: string;
  dateStr: string;
  timeStr: string;
  homeTeam: {
    name: string;
    code: string;
    logoUrl: string;
  };
  awayTeam: {
    name: string;
    code: string;
    logoUrl: string;
  };
  userPrediction?: {
    homeScore: number;
    awayScore: number;
  };
}

const mockMatches: MatchItem[] = [
  {
    id: "m1",
    dateStr: "Jutro",
    timeStr: "21:00",
    homeTeam: {
      name: "Real Madryt",
      code: "RMA",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
    awayTeam: {
      name: "Manchester City",
      code: "MCI",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
  },
  {
    id: "m2",
    dateStr: "17.09",
    timeStr: "18:45",
    homeTeam: {
      name: "Bayern Monachium",
      code: "BAY",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
    awayTeam: {
      name: "Arsenal",
      code: "ARS",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
  },
  {
    id: "m3",
    dateStr: "17.09",
    timeStr: "21:00",
    homeTeam: {
      name: "PSG",
      code: "PSG",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
    awayTeam: {
      name: "FC Barcelona",
      code: "BAR",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
  },
  {
    id: "m4",
    dateStr: "18.09",
    timeStr: "21:00",
    homeTeam: {
      name: "Liverpool",
      code: "LIV",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
    awayTeam: {
      name: "Inter Mediolan",
      code: "INT",
      logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=64&h=64&fit=crop",
    },
  },
];

export function UpcomingMatches() {
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

      <div className="flex flex-col gap-2.5">
        {mockMatches.map((match) => {
          const isFav = favorites[match.id];
          return (
            <div
              key={match.id}
              className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-[#182645] bg-[#0c1527] hover:bg-[#101d36] transition-all group"
            >
              {/* Star & Date */}
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
                  <span className="text-slate-200 font-semibold">{match.dateStr}</span>
                  <span className="text-slate-400">{match.timeStr}</span>
                </div>
              </div>

              {/* Match Teams VS */}
              <div className="flex-1 flex items-center justify-center gap-2 sm:gap-6 px-2 min-w-0">
                {/* Home Team */}
                <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-white truncate text-right">
                    {match.homeTeam.name}
                  </span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#162444] border border-[#182645] flex items-center justify-center text-[10px] font-bold text-blue-300 shrink-0">
                    {match.homeTeam.code}
                  </div>
                </div>

                {/* VS Badge */}
                <span className="text-[11px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-[#162444]/60 border border-[#182645] shrink-0">
                  VS
                </span>

                {/* Away Team */}
                <div className="flex items-center justify-start gap-2 flex-1 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#162444] border border-[#182645] flex items-center justify-center text-[10px] font-bold text-indigo-300 shrink-0">
                    {match.awayTeam.code}
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
                  <Link href={`/mecze`}>Typuj</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
