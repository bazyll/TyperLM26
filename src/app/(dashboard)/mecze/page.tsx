"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { TeamLogo } from "@/components/team-logo";
import {
  Calendar,
  Clock,
  Lock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  Minus,
  Save,
  Loader2,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMatchesWithPredictionsAction, savePredictionAction } from "@/lib/matches/actions";
import { calculateLivePoints } from "@/lib/scoring/matches";
import { MatchWithTeams } from "@/types";

const ITEMS_PER_PAGE = 10;

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  // Default tab is "upcoming" (Najbliższe) as requested
  const [activeTab, setActiveTab] = useState<"upcoming" | "finished" | "all">("upcoming");
  const [currentPage, setCurrentPage] = useState(1);

  const [predictionInputs, setPredictionInputs] = useState<Record<string, { home: number; away: number }>>({});
  const [expandedPredictions, setExpandedPredictions] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, { type: "success" | "error"; message: string }>>({});
  const [isPending, startTransition] = useTransition();

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await getMatchesWithPredictionsAction();
      setMatches(data);

      // Initialize prediction inputs
      const initialInputs: Record<string, { home: number; away: number }> = {};
      data.forEach((m) => {
        if (m.userPrediction) {
          initialInputs[m.id] = {
            home: m.userPrediction.homeScore,
            away: m.userPrediction.awayScore,
          };
        } else {
          initialInputs[m.id] = { home: 0, away: 0 };
        }
      });
      setPredictionInputs(initialInputs);
    } catch (err) {
      console.error("Error loading matches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleTabChange = (tab: "upcoming" | "finished" | "all") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleScoreChange = (matchId: string, team: "home" | "away", delta: number) => {
    const current = predictionInputs[matchId] || { home: 0, away: 0 };
    const nextVal = Math.max(0, Math.min(99, current[team] + delta));
    setPredictionInputs((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home: 0, away: 0 }),
        [team]: nextVal,
      },
    }));
  };

  const handleSavePrediction = (matchId: string) => {
    const input = predictionInputs[matchId] || { home: 0, away: 0 };
    setSaveStatus((prev) => ({ ...prev, [matchId]: { type: "success", message: "Zapisywanie..." } }));

    startTransition(async () => {
      const res = await savePredictionAction({
        matchId,
        homeScore: input.home,
        awayScore: input.away,
      });

      if (!res.success) {
        setSaveStatus((prev) => ({
          ...prev,
          [matchId]: { type: "error", message: res.error || "Błąd zapisu typu." },
        }));
      } else {
        setSaveStatus((prev) => ({
          ...prev,
          [matchId]: { type: "success", message: `Typ ${input.home}:${input.away} zapisany!` },
        }));
        loadMatches();
      }
    });
  };

  const toggleExpand = (matchId: string) => {
    setExpandedPredictions((prev) => ({ ...prev, [matchId]: !prev[matchId] }));
  };

  const now = Date.now();

  // Filter and Sort based on selected tab rules
  const filteredMatches = useMemo(() => {
    if (activeTab === "upcoming") {
      // 1. LIVE matches first at the very top
      const liveMatches = matches
        .filter((m) => m.status === "live")
        .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

      // 2. Upcoming scheduled matches open for prediction, closest kickoff first
      const upcomingMatches = matches
        .filter((m) => m.status === "scheduled" && new Date(m.kickoffAt).getTime() > now && !m.isBettingLocked)
        .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

      return [...liveMatches, ...upcomingMatches];
    }

    if (activeTab === "finished") {
      // Finished matches, most recently finished at the top
      return matches
        .filter((m) => m.status === "finished")
        .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());
    }

    // All matches sorted with priority to closest to now
    return [...matches].sort((a, b) => {
      const isLiveA = a.status === "live";
      const isLiveB = b.status === "live";
      if (isLiveA && !isLiveB) return -1;
      if (!isLiveA && isLiveB) return 1;

      const timeA = new Date(a.kickoffAt).getTime();
      const timeB = new Date(b.kickoffAt).getTime();

      const isUpcomingA = a.status === "scheduled" && timeA > now;
      const isUpcomingB = b.status === "scheduled" && timeB > now;
      if (isUpcomingA && isUpcomingB) return timeA - timeB;
      if (isUpcomingA && !isUpcomingB) return -1;
      if (!isUpcomingA && isUpcomingB) return 1;

      // Finished matches: reverse chronological
      return timeB - timeA;
    });
  }, [matches, activeTab, now]);

  // Pagination calculation (max 10 per page)
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / ITEMS_PER_PAGE));
  const paginatedMatches = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMatches.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMatches, currentPage]);

  const liveMatchesCount = matches.filter((m) => m.status === "live").length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" />
            UEFA Champions League 2026/2027
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Mecze i Typowanie
          </h1>
        </div>

        {/* Filter Tabs in requested exact order: Najbliższe, Zakończone, Wszystkie */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          <Button
            size="sm"
            variant={activeTab === "upcoming" ? "default" : "outline"}
            onClick={() => handleTabChange("upcoming")}
            className="text-xs font-semibold shrink-0"
          >
            {liveMatchesCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping mr-1.5" />}
            Najbliższe {liveMatchesCount > 0 && `(LIVE: ${liveMatchesCount})`}
          </Button>

          <Button
            size="sm"
            variant={activeTab === "finished" ? "default" : "outline"}
            onClick={() => handleTabChange("finished")}
            className="text-xs font-semibold shrink-0"
          >
            Zakończone
          </Button>

          <Button
            size="sm"
            variant={activeTab === "all" ? "default" : "outline"}
            onClick={() => handleTabChange("all")}
            className="text-xs font-semibold shrink-0"
          >
            Wszystkie
          </Button>
        </div>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredMatches.length === 0 ? (
        <Card className="p-12 text-center rounded-3xl border-[#182645] bg-[#0c1527]">
          <p className="text-sm text-slate-400">Brak spotkań w wybranej kategorii.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {paginatedMatches.map((match) => {
            const kickoff = new Date(match.kickoffAt);
            const isKickoffPassed = kickoff.getTime() <= now || match.isBettingLocked;
            const isLive = match.status === "live";
            const isFinished = match.status === "finished";
            const isLocked = isKickoffPassed || isLive || isFinished;

            const dateStr = kickoff.toLocaleDateString("pl-PL", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const timeStr = kickoff.toLocaleTimeString("pl-PL", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const currentInput = predictionInputs[match.id] || { home: 0, away: 0 };
            const status = saveStatus[match.id];

            // Live points calculation
            const livePtsResult =
              isLive && match.userPrediction
                ? calculateLivePoints(
                    match.userPrediction.homeScore,
                    match.userPrediction.awayScore,
                    match.homeScore,
                    match.awayScore
                  )
                : null;

            return (
              <Card
                key={match.id}
                className={`rounded-2xl sm:rounded-3xl border transition-all overflow-hidden ${
                  isLive
                    ? "border-red-500/50 bg-gradient-to-br from-[#120a1c] via-[#0c1527] to-[#0a1224] shadow-red-950/20 shadow-xl"
                    : "border-[#182645] bg-[#0c1527] shadow-md hover:border-blue-500/30"
                }`}
              >
                {/* 1. Header Row */}
                <div className="px-3.5 sm:px-5 py-2.5 bg-[#101d36]/70 border-b border-[#182645]/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 truncate">
                    <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">
                      {dateStr} • {timeStr}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="font-semibold text-slate-300 truncate">
                      {match.matchday ? `Kolejka ${match.matchday}` : match.stage}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 ml-2">
                    {isLive ? (
                      <Badge variant="destructive" className="animate-pulse flex items-center gap-1 font-bold text-[10px] sm:text-xs py-0.5 px-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        LIVE • {match.liveMinute || 0}&apos;
                      </Badge>
                    ) : isFinished ? (
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px] sm:text-xs py-0.5 px-2">
                        ZAKOŃCZONY
                      </Badge>
                    ) : match.status === "postponed" ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] sm:text-xs py-0.5 px-2">
                        ODŁOŻONY
                      </Badge>
                    ) : match.status === "cancelled" ? (
                      <Badge variant="destructive" className="text-[10px] sm:text-xs py-0.5 px-2">
                        ODWOŁANY
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-300 text-[10px] sm:text-xs py-0.5 px-2">
                        ZAPLANOWANY
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 2. Compact 2-Row Team & Score / Prediction Layout */}
                <div className="p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3">
                  {/* Home Team Row */}
                  <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#162444] border border-[#182645] flex items-center justify-center p-0.5 shrink-0 relative overflow-hidden">
                        <TeamLogo
                          logoUrl={match.homeTeam.logoUrl}
                          teamName={match.homeTeam.name}
                          teamCode={match.homeTeam.code}
                          size={32}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        {match.homeTeam.name}
                      </span>
                    </div>

                    {/* Stepper (if open) or Actual Score (if live/finished) */}
                    <div className="shrink-0">
                      {!isLocked ? (
                        <div className="flex items-center rounded-xl bg-[#101d36] border border-[#182645] p-0.5 sm:p-1">
                          <button
                            type="button"
                            aria-label={`Zmniejsz bramki ${match.homeTeam.name}`}
                            onClick={() => handleScoreChange(match.id, "home", -1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 sm:w-8 text-center text-sm font-extrabold text-white">
                            {currentInput.home}
                          </span>
                          <button
                            type="button"
                            aria-label={`Zwiększ bramki ${match.homeTeam.name}`}
                            onClick={() => handleScoreChange(match.id, "home", 1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-lg sm:text-2xl font-black text-white px-2">
                          {match.homeScore ?? "-"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Away Team Row */}
                  <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#162444] border border-[#182645] flex items-center justify-center p-0.5 shrink-0 relative overflow-hidden">
                        <TeamLogo
                          logoUrl={match.awayTeam.logoUrl}
                          teamName={match.awayTeam.name}
                          teamCode={match.awayTeam.code}
                          size={32}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        {match.awayTeam.name}
                      </span>
                    </div>

                    {/* Stepper (if open) or Actual Score (if live/finished) */}
                    <div className="shrink-0">
                      {!isLocked ? (
                        <div className="flex items-center rounded-xl bg-[#101d36] border border-[#182645] p-0.5 sm:p-1">
                          <button
                            type="button"
                            aria-label={`Zmniejsz bramki ${match.awayTeam.name}`}
                            onClick={() => handleScoreChange(match.id, "away", -1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 sm:w-8 text-center text-sm font-extrabold text-white">
                            {currentInput.away}
                          </span>
                          <button
                            type="button"
                            aria-label={`Zwiększ bramki ${match.awayTeam.name}`}
                            onClick={() => handleScoreChange(match.id, "away", 1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-lg sm:text-2xl font-black text-white px-2">
                          {match.awayScore ?? "-"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Bottom Strip: Prediction & Actions */}
                <div className="px-3.5 sm:px-5 py-2.5 bg-[#091120] border-t border-[#182645]/60 flex flex-wrap items-center justify-between gap-2.5">
                  {!isLocked ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {match.userPrediction ? (
                          <span className="text-blue-300 font-medium text-[11px] sm:text-xs">
                            Zapisany typ: <strong>{match.userPrediction.homeScore}:{match.userPrediction.awayScore}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px] sm:text-xs">Nieobstawiony</span>
                        )}
                        {status && (
                          <span
                            className={`font-semibold text-[11px] sm:text-xs ${
                              status.type === "success" ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            • {status.message}
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleSavePrediction(match.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-3.5 h-8 rounded-xl shrink-0"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Zapisz typ
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full gap-2 text-xs">
                      {/* Left: User prediction points/status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {match.userPrediction ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#162444]/60 border border-blue-500/30 text-xs">
                            <span className="text-slate-400">Twój typ:</span>
                            <span className="font-extrabold text-white">
                              {match.userPrediction.homeScore}:{match.userPrediction.awayScore}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic bg-[#101d36] px-2.5 py-1 rounded-xl border border-[#182645]">
                            Brak typu
                          </span>
                        )}

                        {/* Live Points Badge */}
                        {isLive && livePtsResult && (
                          <Badge className="bg-red-950/80 border-red-500/50 text-red-300 gap-1 text-[11px] py-0.5">
                            <Flame className="w-3 h-3 fill-red-400 text-red-400" />
                            +{livePtsResult.points} pkt LIVE
                          </Badge>
                        )}

                        {/* Finished Points Badge */}
                        {isFinished && match.userPrediction && (
                          <Badge
                            className={`text-[11px] font-extrabold py-0.5 ${
                              match.userPrediction.pointsAwarded === 3
                                ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                                : match.userPrediction.pointsAwarded === 2
                                ? "bg-blue-950 border-blue-500 text-blue-300"
                                : match.userPrediction.pointsAwarded === 1
                                ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                                : "bg-slate-900 border-slate-700 text-slate-400"
                            }`}
                          >
                            +{match.userPrediction.pointsAwarded ?? 0} pkt
                          </Badge>
                        )}
                      </div>

                      {/* Right: Expand Other Players Predictions */}
                      {isKickoffPassed && match.allPredictions && match.allPredictions.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(match.id)}
                          className="text-xs text-slate-400 hover:text-white p-1 h-7 rounded-lg shrink-0"
                        >
                          <Users className="w-3.5 h-3.5 mr-1" />
                          <span className="hidden sm:inline">Typy graczy</span> ({match.allPredictions.length})
                          {expandedPredictions[match.id] ? (
                            <ChevronUp className="w-3.5 h-3.5 ml-1" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 ml-1" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Collapsible Drawer: All Players' Predictions */}
                {isKickoffPassed && expandedPredictions[match.id] && (
                  <div className="p-3.5 sm:p-5 bg-[#080d19] border-t border-[#182645] animate-in fade-in duration-200">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      Typy pozostałych graczy ({match.allPredictions?.length || 0})
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
                      {match.allPredictions?.map((pred) => {
                        const initials = `${pred.firstName[0] || "U"}${pred.lastName[0] || ""}`;
                        return (
                          <div
                            key={pred.userId}
                            className="p-2.5 rounded-xl bg-[#101d36]/80 border border-[#182645] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Avatar className="w-6 h-6 border border-blue-500/20 shrink-0">
                                {pred.avatarUrl && <AvatarImage src={pred.avatarUrl} />}
                                <AvatarFallback className="bg-[#162444] text-[10px] font-bold text-blue-300">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-slate-200 truncate">
                                {pred.firstName} {pred.lastName[0]}.
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 font-mono">
                              <span className="font-extrabold text-white text-xs">
                                {pred.homeScore}:{pred.awayScore}
                              </span>

                              {isFinished && pred.pointsAwarded !== null && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    pred.pointsAwarded === 3
                                      ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                                      : pred.pointsAwarded === 2
                                      ? "bg-blue-950 text-blue-300 border border-blue-500/40"
                                      : pred.pointsAwarded === 1
                                      ? "bg-indigo-950 text-indigo-300 border border-indigo-500/40"
                                      : "bg-slate-900 text-slate-500 border border-slate-800"
                                  }`}
                                >
                                  +{pred.pointsAwarded}p
                                </span>
                              )}

                              {isLive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40">
                                  +{pred.livePoints}p
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Bar (Max 10 per page) */}
      {!loading && filteredMatches.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0c1527] border border-[#182645] text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border-[#182645] text-slate-300 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Poprzednia
          </Button>

          <span className="text-slate-400 font-medium">
            Strona <strong className="text-white">{currentPage}</strong> z{" "}
            <strong className="text-white">{totalPages}</strong> ({filteredMatches.length} meczów)
          </span>

          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-xl border-[#182645] text-slate-300 hover:text-white"
          >
            Następna
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
