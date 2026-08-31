"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Lock,
  ChevronDown,
  ChevronUp,
  Flame,
  Activity,
  Plus,
  Minus,
  Save,
  Loader2,
  Users,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMatchesWithPredictionsAction, savePredictionAction } from "@/lib/matches/actions";
import { calculateLivePoints } from "@/lib/scoring/matches";
import { MatchWithTeams } from "@/types";

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "live" | "finished">("all");
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

  const handleScoreChange = (matchId: string, team: "home" | "away", delta: number) => {
    const current = predictionInputs[matchId] || { home: 0, away: 0 };
    const nextVal = Math.max(0, Math.min(99, current[team] + delta));
    setPredictionInputs({
      ...predictionInputs,
      [matchId]: {
        ...current,
        [team]: nextVal,
      },
    });
  };

  const handleSavePrediction = (matchId: string) => {
    const input = predictionInputs[matchId];
    if (!input) return;

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

  const filteredMatches = matches.filter((m) => {
    const isPast = new Date(m.kickoffAt).getTime() <= now || m.isBettingLocked;
    if (activeTab === "live") return m.status === "live";
    if (activeTab === "finished") return m.status === "finished";
    if (activeTab === "upcoming") return m.status === "scheduled" && !isPast;
    return true;
  });

  const liveMatchesCount = matches.filter((m) => m.status === "live").length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={activeTab === "all" ? "default" : "outline"}
            onClick={() => setActiveTab("all")}
            className="text-xs"
          >
            Wszystkie
          </Button>
          <Button
            size="sm"
            variant={activeTab === "upcoming" ? "default" : "outline"}
            onClick={() => setActiveTab("upcoming")}
            className="text-xs"
          >
            Najbliższe
          </Button>
          <Button
            size="sm"
            variant={activeTab === "live" ? "default" : "outline"}
            onClick={() => setActiveTab("live")}
            className={`text-xs ${liveMatchesCount > 0 ? "border-red-500/50 text-red-400 font-bold" : ""}`}
          >
            {liveMatchesCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping mr-1" />}
            LIVE ({liveMatchesCount})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "finished" ? "default" : "outline"}
            onClick={() => setActiveTab("finished")}
            className="text-xs"
          >
            Zakończone
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
        <div className="flex flex-col gap-4">
          {filteredMatches.map((match) => {
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
            const livePtsResult = isLive && match.userPrediction
              ? calculateLivePoints(match.userPrediction.homeScore, match.userPrediction.awayScore, match.homeScore, match.awayScore)
              : null;

            return (
              <Card
                key={match.id}
                className={`rounded-3xl border transition-all overflow-hidden ${
                  isLive
                    ? "border-red-500/50 bg-gradient-to-br from-[#120a1c] via-[#0c1527] to-[#0a1224] shadow-red-950/20 shadow-2xl"
                    : "border-[#182645] bg-[#0c1527] shadow-xl hover:border-blue-500/30"
                }`}
              >
                {/* Match Card Header Info */}
                <div className="px-5 py-3.5 bg-[#101d36]/60 border-b border-[#182645]/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>
                      {dateStr}, {timeStr}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="font-semibold text-slate-300">
                      {match.matchday ? `Kolejka ${match.matchday}` : match.stage}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div>
                    {isLive ? (
                      <Badge variant="destructive" className="animate-pulse flex items-center gap-1 font-bold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        LIVE • {match.liveMinute || 0}&apos;
                      </Badge>
                    ) : isFinished ? (
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[11px]">
                        ZAKOŃCZONY
                      </Badge>
                    ) : match.status === "postponed" ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[11px]">
                        ODŁOŻONY
                      </Badge>
                    ) : match.status === "cancelled" ? (
                      <Badge variant="destructive" className="text-[11px]">
                        ODWOŁANY
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-300 text-[11px]">
                        ZAPLANOWANY
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Match Teams & Score Area */}
                <div className="p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  {/* Home Team */}
                  <div className="flex-1 flex items-center justify-end gap-3.5 w-full md:w-auto text-right">
                    <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {match.homeTeam.name}
                    </span>
                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-[#162444] border border-[#182645] flex items-center justify-center p-2 shrink-0 relative">
                      <Image src={match.homeTeam.logoUrl} alt={match.homeTeam.code} width={48} height={48} unoptimized className="w-full h-full object-contain" />
                    </div>
                  </div>

                  {/* Actual Score or Kickoff Time */}
                  <div className="flex flex-col items-center justify-center px-4 py-2 rounded-2xl bg-[#101d36]/80 border border-[#182645] min-w-[110px]">
                    {isLive || isFinished ? (
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-widest">
                        {match.homeScore} : {match.awayScore}
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-blue-400">VS</div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 flex items-center justify-start gap-3.5 w-full md:w-auto text-left">
                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-[#162444] border border-[#182645] flex items-center justify-center p-2 shrink-0 relative">
                      <Image src={match.awayTeam.logoUrl} alt={match.awayTeam.code} width={48} height={48} unoptimized className="w-full h-full object-contain" />
                    </div>
                    <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {match.awayTeam.name}
                    </span>
                  </div>
                </div>

                {/* Prediction Control / Results Strip */}
                <div className="px-5 py-4 bg-[#091120] border-t border-[#182645]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Left: Current User Prediction Status */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!isLocked ? (
                      /* Editable Prediction Stepper UI */
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-300">Twój typ:</span>

                        {/* Home score stepper */}
                        <div className="flex items-center rounded-xl bg-[#101d36] border border-[#182645] p-1">
                          <button
                            type="button"
                            onClick={() => handleScoreChange(match.id, "home", -1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-extrabold text-white">
                            {currentInput.home}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleScoreChange(match.id, "home", 1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="font-bold text-slate-400">:</span>

                        {/* Away score stepper */}
                        <div className="flex items-center rounded-xl bg-[#101d36] border border-[#182645] p-1">
                          <button
                            type="button"
                            onClick={() => handleScoreChange(match.id, "away", -1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-extrabold text-white">
                            {currentInput.away}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleScoreChange(match.id, "away", 1)}
                            className="w-7 h-7 rounded-lg bg-[#162444] hover:bg-blue-600 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Save Button */}
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleSavePrediction(match.id)}
                          className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-3 h-9"
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />
                          Zapisz
                        </Button>
                      </div>
                    ) : (
                      /* Locked / Finalized State */
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-[#101d36] px-3 py-1.5 rounded-xl border border-[#182645]">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Typowanie zakończone</span>
                        </div>

                        {match.userPrediction ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#162444]/60 border border-blue-500/30 text-xs">
                            <span className="text-slate-400">Twój typ:</span>
                            <span className="font-extrabold text-white">
                              {match.userPrediction.homeScore} : {match.userPrediction.awayScore}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic bg-[#101d36] px-3 py-1.5 rounded-xl border border-[#182645]">
                            Brak typu
                          </div>
                        )}

                        {/* Live Points Badge */}
                        {isLive && livePtsResult && (
                          <Badge className="bg-red-950/80 border-red-500/50 text-red-300 gap-1 text-xs">
                            <Flame className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                            +{livePtsResult.points} pkt LIVE
                          </Badge>
                        )}

                        {/* Finished Points Badge */}
                        {isFinished && match.userPrediction && (
                          <Badge
                            className={`text-xs font-extrabold ${
                              match.userPrediction.pointsAwarded === 3
                                ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                                : match.userPrediction.pointsAwarded === 2
                                ? "bg-blue-950 border-blue-500 text-blue-300"
                                : match.userPrediction.pointsAwarded === 1
                                ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                                : "bg-slate-900 border-slate-700 text-slate-400"
                            }`}
                          >
                            +{match.userPrediction.pointsAwarded ?? 0} pkt (
                            {match.userPrediction.scoringCategory === "exact"
                              ? "Dokładny wynik"
                              : match.userPrediction.scoringCategory === "diff"
                              ? "Różnica bramek"
                              : match.userPrediction.scoringCategory === "outcome"
                              ? "Rezultat"
                              : "Nietrafiony"}
                            )
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Status feedback message */}
                    {status && (
                      <span
                        className={`text-xs font-medium ${
                          status.type === "success" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {status.message}
                      </span>
                    )}
                  </div>

                  {/* Right: Expand Other Players Predictions (Only visible after kickoff) */}
                  {isKickoffPassed && match.allPredictions && match.allPredictions.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(match.id)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Typy graczy ({match.allPredictions.length})
                      {expandedPredictions[match.id] ? (
                        <ChevronUp className="w-3.5 h-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 ml-1" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Expanded All Players Predictions Strip */}
                {isKickoffPassed && expandedPredictions[match.id] && match.allPredictions && (
                  <div className="p-4 bg-[#080e1a] border-t border-[#182645]/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                      Odsłonięte typy uczestników ligi:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {match.allPredictions.map((pred) => {
                        const initials = `${pred.firstName[0] || "U"}${pred.lastName[0] || ""}`;
                        return (
                          <div
                            key={pred.userId}
                            className="p-2.5 rounded-xl bg-[#101d36] border border-[#182645] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 border border-blue-500/20">
                                {pred.avatarUrl && <AvatarImage src={pred.avatarUrl} />}
                                <AvatarFallback className="bg-[#162444] text-[10px] font-bold text-blue-300">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-slate-200 truncate max-w-[80px]">
                                {pred.firstName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-white">
                                {pred.homeScore}:{pred.awayScore}
                              </span>
                              {isFinished && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
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
                              )}
                              {isLive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-300">
                                  +{pred.livePoints}
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
    </div>
  );
}
