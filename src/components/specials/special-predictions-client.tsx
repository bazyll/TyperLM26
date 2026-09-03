"use client";

import { useState } from "react";
import { SpecialCategoryWithPrediction } from "@/types";
import { Database } from "@/types/database.types";
import { saveAllSpecialPredictionsAction } from "@/lib/specials/actions";
import {
  Trophy,
  Award,
  Flame,
  Zap,
  Target,
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Users,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { TeamLogo } from "@/components/team-logo";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

interface Props {
  initialCategories: SpecialCategoryWithPrediction[];
  teams: TeamRow[];
  players: PlayerRow[];
  isUefaReconciliationComplete?: boolean;
}

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  winner: Trophy,
  finalist: Award,
  top_scorer: Flame,
  top_assists: Zap,
  team_most_goals: Target,
  team_most_clean_sheets: ShieldCheck,
};

export function SpecialPredictionsClient({
  initialCategories,
  teams,
  players,
  isUefaReconciliationComplete = false,
}: Props) {
  const [categories, setCategories] = useState<SpecialCategoryWithPrediction[]>(initialCategories);

  // Player categories are ready ONLY when explicit UEFA squad reconciliation is confirmed complete
  const arePlayerCategoriesReady = Boolean(isUefaReconciliationComplete);

  const [selections, setSelections] = useState<Record<string, { teamId?: string; playerId?: string }>>(() => {
    const init: Record<string, { teamId?: string; playerId?: string }> = {};
    initialCategories.forEach((c) => {
      init[c.id] = {
        teamId: c.userPrediction?.selectedTeamId || undefined,
        playerId: c.userPrediction?.selectedPlayerId || undefined,
      };
    });
    return init;
  });

  const [activeModalCatId, setActiveModalCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const activeCategory = categories.find((c) => c.id === activeModalCatId);

  // Helper mapping
  const teamMap = new Map<string, TeamRow>();
  teams.forEach((t) => teamMap.set(t.id, t));

  const playerMap = new Map<string, PlayerRow>();
  players.forEach((p) => playerMap.set(p.id, p));

  const handleSelectTeam = (catId: string, teamId: string) => {
    setSelections((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], teamId, playerId: undefined },
    }));
    setActiveModalCatId(null);
    setSearchQuery("");
  };

  const handleSelectPlayer = (catId: string, playerId: string) => {
    setSelections((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], playerId, teamId: undefined },
    }));
    setActiveModalCatId(null);
    setSearchQuery("");
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    const payload = Object.entries(selections)
      .filter(([catId, sel]) => {
        const cat = categories.find((c) => c.id === catId);
        const isReady = cat?.targetType === "player" ? arePlayerCategoriesReady : teams.length >= 36;
        return isReady && (sel.teamId || sel.playerId);
      })
      .map(([catId, sel]) => ({
        categoryId: catId,
        selectedTeamId: sel.teamId,
        selectedPlayerId: sel.playerId,
      }));

    if (payload.length === 0) {
      setIsSaving(false);
      setFeedback({ success: false, message: "Wybierz przynajmniej jedną opcję przed zapisaniem." });
      return;
    }

    const res = await saveAllSpecialPredictionsAction({ predictions: payload });
    setIsSaving(false);

    if (res.success) {
      setFeedback({ success: true, message: "Twoje typy specjalne zostały pomyślnie zapisane!" });
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({ success: false, message: res.error || "Błąd zapisu typów." });
    }
  };

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

      {/* 6 Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug] || Trophy;
          const isReady = cat.targetType === "player" ? arePlayerCategoriesReady : teams.length >= 36;
          const isPassed = new Date(cat.deadlineAt).getTime() <= Date.now() || cat.isLocked;
          const isSettled = cat.status === "settled";
          const currentSel = selections[cat.id];

          const selectedTeam = currentSel?.teamId ? teamMap.get(currentSel.teamId) : undefined;
          const selectedPlayer = currentSel?.playerId ? playerMap.get(currentSel.playerId) : undefined;
          const selectedPlayerTeam = selectedPlayer ? teamMap.get(selectedPlayer.team_id) : undefined;

          return (
            <div
              key={cat.id}
              className={`group relative flex flex-col justify-between p-5 rounded-2xl transition-all shadow-lg backdrop-blur-sm ${
                !isReady
                  ? "bg-[#080d19]/90 border border-[#182645]/40 opacity-60"
                  : "bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 hover:shadow-xl"
              }`}
            >
              {/* Header: Icon, Title, Points, Status */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 text-base leading-tight">{cat.title}</h3>
                      <span className="text-[11px] text-blue-400 font-semibold">{cat.pointsValue} pkt za trafienie</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {!isReady ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700/60 uppercase">
                      Wkrótce
                    </span>
                  ) : isSettled ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                      Rozliczone
                    </span>
                  ) : isPassed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      <Lock className="w-3 h-3" /> Zablokowane
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                      Otwarte
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mb-4 min-h-[32px] line-clamp-2">{cat.description}</p>

                {/* Current Selection Box */}
                <div className="mb-4">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Mój typ:</span>
                    {cat.userPrediction?.pointsAwarded !== null && cat.userPrediction?.pointsAwarded !== undefined && (
                      <span
                        className={`font-bold ${
                          cat.userPrediction.pointsAwarded > 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {cat.userPrediction.pointsAwarded > 0 ? `✅ +${cat.userPrediction.pointsAwarded} pkt` : `❌ 0 pkt`}
                      </span>
                    )}
                  </div>

                  {!isReady ? (
                    /* Unready (Waiting for UEFA) View */
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-slate-500 text-xs font-semibold select-none cursor-not-allowed">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Oczekiwanie na oficjalne składy UEFA</span>
                    </div>
                  ) : isPassed ? (
                    /* Locked View */
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      {selectedTeam ? (
                        <>
                          <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                            <TeamLogo
                              logoUrl={selectedTeam.logo_url}
                              teamName={selectedTeam.name}
                              teamCode={selectedTeam.code}
                              size={28}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-sm font-semibold text-white truncate">{selectedTeam.name}</span>
                        </>
                      ) : selectedPlayer ? (
                        <>
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 text-xs font-bold shrink-0">
                            {selectedPlayer.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <span className="text-sm font-semibold text-white block truncate">{selectedPlayer.name}</span>
                            {selectedPlayerTeam && (
                              <span className="text-[10px] text-slate-400 block truncate">{selectedPlayerTeam.name}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Brak typu</span>
                      )}
                    </div>
                  ) : (
                    /* Interactive Button / Selector */
                    <button
                      type="button"
                      onClick={() => setActiveModalCatId(cat.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/40 text-left transition-all group/btn cursor-pointer"
                    >
                      <div className="flex items-center gap-3 truncate">
                        {selectedTeam ? (
                          <>
                            <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                              <TeamLogo
                                logoUrl={selectedTeam.logo_url}
                                teamName={selectedTeam.name}
                                teamCode={selectedTeam.code}
                                size={24}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <span className="text-sm font-bold text-white truncate">{selectedTeam.name}</span>
                          </>
                        ) : selectedPlayer ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                              {selectedPlayer.name.charAt(0)}
                            </div>
                            <div className="truncate">
                              <span className="text-sm font-bold text-white block truncate">{selectedPlayer.name}</span>
                              {selectedPlayerTeam && (
                                <span className="text-[10px] text-slate-400 block truncate">{selectedPlayerTeam.name}</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Kliknij, aby wybrać...</span>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 group-hover/btn:text-white shrink-0 ml-2" />
                    </button>
                  )}
                </div>

                {/* Correct Answer Box (when settled) */}
                {isSettled && cat.correctAnswers && cat.correctAnswers.length > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 mb-4">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                      Poprawna odpowiedź {cat.correctAnswers.length > 1 ? "(remis)" : ""}:
                    </div>
                    <div className="flex flex-col gap-1">
                      {cat.correctAnswers.map((ans, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                          {ans.teamLogo !== undefined && (
                            <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
                              <TeamLogo
                                logoUrl={ans.teamLogo}
                                teamName={ans.teamName || "Team"}
                                size={16}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <span>{ans.teamName || ans.playerName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer: Deadline info */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(cat.deadlineAt).toLocaleString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save All Button (Active when at least one open category exists) */}
      {categories.some((c) => new Date(c.deadlineAt).getTime() > Date.now() && !c.isLocked) && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Zapisywanie typów...</span>
              </>
            ) : (
              <span>Zapisz wszystkie typy specjalne</span>
            )}
          </button>
        </div>
      )}

      {/* Revealed Predictions of other players after deadline */}
      {categories.some((c) => (new Date(c.deadlineAt).getTime() <= Date.now() || c.isLocked) && c.allPredictions && c.allPredictions.length > 0) && (
        <div className="mt-8 pt-8 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
            <Users className="w-4 h-4" />
            Odsłonięte typy wszystkich uczestników
          </div>
          <h2 className="text-xl font-bold text-white mb-4">Podgląd typów po upływie deadline&apos;u</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories
              .filter((c) => (new Date(c.deadlineAt).getTime() <= Date.now() || c.isLocked) && c.allPredictions && c.allPredictions.length > 0)
              .map((cat) => (
                <div key={cat.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">{cat.title}</h4>
                  <div className="flex flex-col gap-2">
                    {cat.allPredictions?.map((p) => (
                      <div key={p.userId} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-300">
                            {p.firstName} {p.lastName}
                          </span>
                        </div>
                        <span className="font-semibold text-blue-300">
                          {p.selectedTeamName || p.selectedPlayerName || "Brak"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Selection Modal / Dialog */}
      {activeCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{activeCategory.title}</h3>
                <p className="text-xs text-slate-400">
                  {activeCategory.targetType === "team" ? "Wybierz jeden klub z Ligi Mistrzów" : "Wybierz jednego zawodnika"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModalCatId(null);
                  setSearchQuery("");
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={activeCategory.targetType === "team" ? "Szukaj drużyny..." : "Szukaj zawodnika..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                autoFocus
              />
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[50vh]">
              {activeCategory.targetType === "team" ? (
                /* Teams List */
                teams
                  .filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.short_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((team) => {
                    const isSelected = selections[activeCategory.id]?.teamId === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => handleSelectTeam(activeCategory.id, team.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-slate-950/60 hover:bg-slate-800/80 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                            <TeamLogo
                              logoUrl={team.logo_url}
                              teamName={team.name}
                              teamCode={team.code}
                              size={24}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-sm">{team.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
                      </button>
                    );
                  })
              ) : (
                /* Players List */
                players
                  .filter((p) => p.is_ucl_registered || selections[activeCategory.id]?.playerId === p.id)
                  .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((player) => {
                    const isSelected = selections[activeCategory.id]?.playerId === player.id;
                    const pTeam = teamMap.get(player.team_id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleSelectPlayer(activeCategory.id, player.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-slate-950/60 hover:bg-slate-800/80 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
                            {player.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold block">{player.name}</span>
                              {player.jersey_number && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                  #{player.jersey_number}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {pTeam && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                  <TeamLogo
                                    logoUrl={pTeam.logo_url}
                                    teamName={pTeam.name}
                                    teamCode={pTeam.code}
                                    size={14}
                                  />
                                  <span>{pTeam.name}</span>
                                </div>
                              )}
                              {player.position && (
                                <span className="text-[10px] text-slate-500">• {player.position}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
