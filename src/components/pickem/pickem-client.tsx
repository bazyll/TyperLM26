"use client";

import { useState, useMemo } from "react";
import { Database } from "@/types/database.types";
import { PickemSubmissionWithDetails } from "@/types";
import { savePickemSubmissionAction } from "@/lib/pickem/actions";
import {
  Trophy,
  Shield,
  XCircle,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Users,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { TeamLogo } from "@/components/team-logo";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type ConfigRow = Database["public"]["Tables"]["pickem_config"]["Row"];

interface Props {
  config: ConfigRow | null;
  teams: TeamRow[];
  initialSubmission: PickemSubmissionWithDetails | null;
  allSubmissions: Array<{
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    pointsAwarded?: number | null;
    firstTeamId?: string;
    top8TeamIds?: string[];
    outTeamIds?: string[];
  }>;
}

export function PickemClient({ config, teams, initialSubmission, allSubmissions }: Props) {
  const [firstTeamId, setFirstTeamId] = useState<string | undefined>(initialSubmission?.firstTeamId);
  const [top8TeamIds, setTop8TeamIds] = useState<string[]>(initialSubmission?.top8TeamIds || []);
  const [outTeamIds, setOutTeamIds] = useState<string[]>(initialSubmission?.outTeamIds || []);

  const [activeTab, setActiveTab] = useState<"all" | "first" | "top8" | "out" | "middle">("all");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const isPassed = Boolean(config && (new Date(config.deadline_at).getTime() <= Date.now() || config.is_locked));
  const isSettled = config?.status === "settled";

  // Team mapping
  const teamMap = useMemo(() => {
    const map = new Map<string, TeamRow>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  // Derived sets
  const top8Set = useMemo(() => new Set(top8TeamIds), [top8TeamIds]);
  const outSet = useMemo(() => new Set(outTeamIds), [outTeamIds]);

  const middleTeams = useMemo(() => {
    return teams.filter((t) => t.id !== firstTeamId && !top8Set.has(t.id) && !outSet.has(t.id));
  }, [teams, firstTeamId, top8Set, outSet]);

  const getTeamCategory = (teamId: string): "first" | "top8" | "out" | "middle" => {
    if (teamId === firstTeamId) return "first";
    if (top8Set.has(teamId)) return "top8";
    if (outSet.has(teamId)) return "out";
    return "middle";
  };

  const handleAssignCategory = (teamId: string, targetCat: "first" | "top8" | "out" | "middle") => {
    if (isPassed) return;

    // 1. Remove from all existing assignments
    if (firstTeamId === teamId) setFirstTeamId(undefined);
    if (top8Set.has(teamId)) setTop8TeamIds((prev) => prev.filter((id) => id !== teamId));
    if (outSet.has(teamId)) setOutTeamIds((prev) => prev.filter((id) => id !== teamId));

    // 2. Assign to target
    if (targetCat === "first") {
      setFirstTeamId(teamId);
    } else if (targetCat === "top8") {
      if (top8TeamIds.length >= 7 && !top8Set.has(teamId)) {
        setFeedback({ success: false, message: "Kategoria TOP 8 może zawierać maksymalnie 7 drużyn." });
        return;
      }
      setTop8TeamIds((prev) => [...prev.filter((id) => id !== teamId), teamId]);
    } else if (targetCat === "out") {
      if (outTeamIds.length >= 8 && !outSet.has(teamId)) {
        setFeedback({ success: false, message: "Kategoria OUT może zawierać maksymalnie 8 drużyn." });
        return;
      }
      setOutTeamIds((prev) => [...prev.filter((id) => id !== teamId), teamId]);
    }
  };

  const isComplete = Boolean(firstTeamId && top8TeamIds.length === 7 && outTeamIds.length === 8);

  const handleSave = async () => {
    if (!firstTeamId || top8TeamIds.length !== 7 || outTeamIds.length !== 8) {
      setFeedback({
        success: false,
        message: "Uzupełnij wszystkie kategorie (1 FIRST, 7 TOP 8, 8 OUT) przed zapisaniem.",
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const res = await savePickemSubmissionAction({
      firstTeamId,
      top8TeamIds,
      outTeamIds,
    });

    setIsSaving(false);

    if (res.success) {
      setFeedback({ success: true, message: "Twój Pick'em fazy ligowej został pomyślnie zapisany!" });
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({ success: false, message: res.error || "Błąd zapisu Pick'em." });
    }
  };

  const filteredTeams = useMemo(() => {
    if (activeTab === "all") return teams;
    if (activeTab === "first") return teams.filter((t) => t.id === firstTeamId);
    if (activeTab === "top8") return teams.filter((t) => top8Set.has(t.id));
    if (activeTab === "out") return teams.filter((t) => outSet.has(t.id));
    if (activeTab === "middle") return middleTeams;
    return teams;
  }, [teams, activeTab, firstTeamId, top8Set, outSet, middleTeams]);

  return (
    <div className="flex flex-col gap-8">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center gap-3 transition-all ${
            feedback.success
              ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/60 border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Overview Status & Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* FIRST */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            firstTeamId ? "bg-amber-950/30 border-amber-500/30" : "bg-slate-900 border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1">
            <span className="flex items-center gap-1.5">🥇 FIRST</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              {firstTeamId ? "1 / 1" : "0 / 1"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">1. miejsce w fazie ligowej (+3 pkt)</p>
        </div>

        {/* TOP 8 */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            top8TeamIds.length === 7 ? "bg-blue-950/30 border-blue-500/30" : "bg-slate-900 border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-blue-400 font-bold mb-1">
            <span className="flex items-center gap-1.5">🔵 TOP 8</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{top8TeamIds.length} / 7</span>
          </div>
          <p className="text-[11px] text-slate-400">Miejsca 1–8 (+3 pkt / klub)</p>
        </div>

        {/* OUT */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            outTeamIds.length === 8 ? "bg-rose-950/30 border-rose-500/30" : "bg-slate-900 border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400 font-bold mb-1">
            <span className="flex items-center gap-1.5">🔴 OUT</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">{outTeamIds.length} / 8</span>
          </div>
          <p className="text-[11px] text-slate-400">Miejsca 25–36 (+3 pkt / klub)</p>
        </div>

        {/* MIDDLE */}
        <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800">
          <div className="flex items-center justify-between text-xs text-purple-400 font-bold mb-1">
            <span className="flex items-center gap-1.5">🟡 MIDDLE</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{middleTeams.length} / 20</span>
          </div>
          <p className="text-[11px] text-slate-400">Miejsca 9–24 (auto: +3 pkt / klub)</p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "all"
                ? "bg-slate-700 text-white"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Wszystkie (36)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("first")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "first"
                ? "bg-amber-600 text-white"
                : "bg-slate-900/60 text-amber-400 hover:bg-amber-950/40"
            }`}
          >
            🥇 FIRST ({firstTeamId ? 1 : 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("top8")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "top8"
                ? "bg-blue-600 text-white"
                : "bg-slate-900/60 text-blue-400 hover:bg-blue-950/40"
            }`}
          >
            🔵 TOP 8 ({top8TeamIds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("out")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "out"
                ? "bg-rose-600 text-white"
                : "bg-slate-900/60 text-rose-400 hover:bg-rose-950/40"
            }`}
          >
            🔴 OUT ({outTeamIds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("middle")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "middle"
                ? "bg-purple-600 text-white"
                : "bg-slate-900/60 text-purple-400 hover:bg-purple-950/40"
            }`}
          >
            🟡 MIDDLE ({middleTeams.length})
          </button>
        </div>

        {/* Save Button (Header) */}
        {!isPassed && (
          <button
            type="button"
            onClick={handleSave}
            disabled={!isComplete || isSaving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Zapisywanie...</span>
              </>
            ) : (
              <span>Zapisz Pick&apos;em ({isComplete ? "Kompletny" : "Niekompletny"})</span>
            )}
          </button>
        )}
      </div>

      {/* 36 Teams Touch-Friendly Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredTeams.map((team) => {
          const cat = getTeamCategory(team.id);

          return (
            <div
              key={team.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                cat === "first"
                  ? "bg-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-500/5"
                  : cat === "top8"
                  ? "bg-blue-950/30 border-blue-500/40 shadow-lg shadow-blue-500/5"
                  : cat === "out"
                  ? "bg-rose-950/30 border-rose-500/40 shadow-lg shadow-rose-500/5"
                  : "bg-slate-900/80 border-slate-800"
              }`}
            >
              {/* Club Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                    <TeamLogo
                      logoUrl={team.logo_url}
                      teamName={team.name}
                      teamCode={team.code}
                      size={32}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="truncate">
                    <span className="text-sm font-bold text-white block truncate">{team.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{team.code}</span>
                  </div>
                </div>

                {/* Category Badge */}
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                    cat === "first"
                      ? "bg-amber-500 text-slate-950"
                      : cat === "top8"
                      ? "bg-blue-500 text-white"
                      : cat === "out"
                      ? "bg-rose-500 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {cat === "first" ? "🥇 FIRST" : cat === "top8" ? "🔵 TOP 8" : cat === "out" ? "🔴 OUT" : "🟡 MIDDLE"}
                </span>
              </div>

              {/* Action Buttons (Disabled if locked) */}
              {!isPassed && (
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleAssignCategory(team.id, "first")}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      cat === "first"
                        ? "bg-amber-500 text-slate-950 shadow-md"
                        : "bg-slate-800/80 hover:bg-amber-950/60 text-slate-300 hover:text-amber-300"
                    }`}
                  >
                    FIRST
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssignCategory(team.id, "top8")}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      cat === "top8"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-800/80 hover:bg-blue-950/60 text-slate-300 hover:text-blue-300"
                    }`}
                  >
                    TOP 8
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssignCategory(team.id, "out")}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      cat === "out"
                        ? "bg-rose-600 text-white shadow-md"
                        : "bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300"
                    }`}
                  >
                    OUT
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssignCategory(team.id, "middle")}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      cat === "middle"
                        ? "bg-purple-600/60 text-purple-200"
                        : "bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    MID
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Revealed Submissions of Other Players after Deadline */}
      {isPassed && allSubmissions.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
            <Users className="w-4 h-4" />
            Wybory Pick&apos;em pozostałych graczy
          </div>
          <h2 className="text-xl font-bold text-white mb-4">Odsłonięte zestawy po upływie deadline&apos;u</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allSubmissions.map((sub) => {
              const firstTeam = sub.firstTeamId ? teamMap.get(sub.firstTeamId) : undefined;

              return (
                <div key={sub.userId} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs">
                        {sub.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-200">
                        {sub.firstName} {sub.lastName} (@{sub.username})
                      </span>
                    </div>
                    {sub.pointsAwarded !== null && sub.pointsAwarded !== undefined && (
                      <span className="font-extrabold text-emerald-400 text-xs">
                        {sub.pointsAwarded} pkt
                      </span>
                    )}
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-amber-400">FIRST:</span>
                      <span className="text-slate-200">{firstTeam?.name || "Brak"}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-blue-400 shrink-0">TOP 8:</span>
                      <span className="text-slate-300 line-clamp-1">
                        {sub.top8TeamIds?.map((id) => teamMap.get(id)?.short_name || id).join(", ") || "Brak"}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-rose-400 shrink-0">OUT:</span>
                      <span className="text-slate-300 line-clamp-1">
                        {sub.outTeamIds?.map((id) => teamMap.get(id)?.short_name || id).join(", ") || "Brak"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
