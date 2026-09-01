"use client";

import { useState, useMemo } from "react";
import { Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ProfilePredictionItem {
  id: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
  match: {
    id: string;
    stage: string;
    matchday: number | null;
    kickoffAt: string;
    status: string;
    isBettingLocked: boolean;
    homeScore: number | null;
    awayScore: number | null;
    homeTeamName: string;
    homeTeamShort: string;
    awayTeamName: string;
    awayTeamShort: string;
  };
}

interface Props {
  predictions: ProfilePredictionItem[];
  isOwner: boolean;
}

const ITEMS_PER_PAGE = 10;

export function ProfilePredictionsHistory({ predictions, isOwner }: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting: newest finished matches first, then other matches
  const sortedPredictions = useMemo(() => {
    return [...predictions].sort((a, b) => {
      const isFinishedA = a.match.status === "finished";
      const isFinishedB = b.match.status === "finished";

      if (isFinishedA && !isFinishedB) return -1;
      if (!isFinishedA && isFinishedB) return 1;

      const timeA = new Date(a.match.kickoffAt).getTime();
      const timeB = new Date(b.match.kickoffAt).getTime();

      if (isFinishedA && isFinishedB) {
        // newest finished first
        return timeB - timeA;
      }

      // other matches: chronological
      return timeA - timeB;
    });
  }, [predictions]);

  const totalPages = Math.max(1, Math.ceil(sortedPredictions.length / ITEMS_PER_PAGE));
  const paginatedPredictions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedPredictions.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedPredictions, currentPage]);

  if (sortedPredictions.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 rounded-2xl bg-slate-950 border border-slate-800">
        Użytkownik nie obstawił jeszcze żadnego spotkania.
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5">
        {paginatedPredictions.map((pred) => {
          const match = pred.match;
          const isKickoffPassed = new Date(match.kickoffAt).getTime() <= now || match.isBettingLocked;
          const canViewScore = isOwner || isKickoffPassed;

          return (
            <div
              key={pred.id}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs sm:text-sm font-bold text-white">
                  {match.homeTeamShort} vs {match.awayTeamShort}
                </span>
                <span className="text-[11px] text-slate-500">
                  {match.matchday ? `Kolejka ${match.matchday}` : match.stage}
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
                {canViewScore ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Typ:</span>
                    <span className="font-mono font-extrabold text-white text-xs sm:text-sm">
                      {pred.homeScore}:{pred.awayScore}
                    </span>
                    {match.homeScore !== null && match.awayScore !== null && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        (Wynik: {match.homeScore}:{match.awayScore})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Typ ukryty do rozpoczęcia meczu</span>
                  </div>
                )}

                {match.status === "finished" && pred.pointsAwarded !== null && (
                  <Badge
                    className={`text-[11px] font-bold ${
                      pred.pointsAwarded === 3
                        ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                        : pred.pointsAwarded === 2
                        ? "bg-blue-950 border-blue-500 text-blue-300"
                        : pred.pointsAwarded === 1
                        ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                        : "bg-slate-900 border-slate-700 text-slate-400"
                    }`}
                  >
                    +{pred.pointsAwarded} pkt
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Bar (Shown only if > 10 items) */}
      {sortedPredictions.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between pt-2 px-1 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:text-white h-8 px-2.5 sm:px-3 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Poprzednia
          </Button>

          <span className="text-slate-400 font-medium text-[11px] sm:text-xs">
            <strong className="text-white">{currentPage}</strong> / <strong className="text-white">{totalPages}</strong>
          </span>

          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:text-white h-8 px-2.5 sm:px-3 text-xs"
          >
            Następna
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
