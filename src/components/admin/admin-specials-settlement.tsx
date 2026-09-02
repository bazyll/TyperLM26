"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Trophy,
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  RefreshCw,
  Users,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import {
  adminGetSpecialSettlementReportAction,
  adminConfirmAndSettleSpecialCategoryAction,
} from "@/lib/specials/actions";
import {
  CategorySettlementPreview,
  SpecialPredictionsSettlementReport,
} from "@/lib/specials/settlement";

export function AdminSpecialsSettlement() {
  const [report, setReport] = useState<SpecialPredictionsSettlementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategorySettlementPreview | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetSpecialSettlementReportAction();
      if (res.success && res.report) {
        setReport(res.report);
      } else {
        setError(res.error || "Nie udało się pobrać raportu rozliczenia.");
      }
    } catch (err: any) {
      setError(err?.message || "Wystąpił błąd podczas pobierania podglądu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleConfirmSettlement = (cat: CategorySettlementPreview) => {
    setActionMessage(null);
    startTransition(async () => {
      try {
        const res = await adminConfirmAndSettleSpecialCategoryAction({
          categoryId: cat.categoryId,
          expectedHash: cat.previewHash,
        });

        if (res.success) {
          setActionMessage({
            type: "success",
            text: `Kategoria "${cat.title}" została pomyślnie rozliczona (${cat.winningUsersCount} zwycięzców, ${cat.totalPointsToAward} pkt)!`,
          });
          setSelectedCategory(null);
          await fetchReport();
        } else {
          setActionMessage({
            type: "error",
            text: res.error || "Błąd podczas rozliczania kategorii.",
          });
        }
      } catch (err: any) {
        setActionMessage({
          type: "error",
          text: err?.message || "Wystąpił nieoczekiwany błąd.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Status Card */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Rozliczanie Typów Specjalnych
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-normal">
                  Milestone 6E.2
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                Dwustopniowy workflow (Calculate → Preview → Admin Confirm → Settle). 20 pkt per kategoria (max 120 pkt).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Odśwież podgląd
          </button>
        </div>

        {/* Global Tournament Completeness Notice */}
        {report && (
          <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Status rozgrywek UCL 2026/27:</span>
              {report.competitionCompleted ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Turniej zakończony (Finał rozegrany)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
                  <Clock className="w-3.5 h-3.5" /> Turniej w toku — settlement statystyk zablokowany do zakończenia finału
                </span>
              )}
            </div>

            {report.finalMatch && (
              <div className="text-slate-400">
                Finał: <strong className="text-slate-200">{report.finalMatch.homeTeamName}</strong> vs{" "}
                <strong className="text-slate-200">{report.finalMatch.awayTeamName}</strong>{" "}
                {report.finalMatch.status === "finished"
                  ? `(${report.finalMatch.homeScore}:${report.finalMatch.awayScore})`
                  : `[${report.finalMatch.status}]`}
              </div>
            )}
          </div>
        )}
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-3 ${
            actionMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/30 text-rose-300"
          }`}
        >
          {actionMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && !report ? (
          <div className="col-span-full py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Trwa kalkulacja i generowanie podglądu rozliczenia...
          </div>
        ) : (
          report?.categories.map((cat) => {
            const isSettled = cat.status === "settled";

            return (
              <div
                key={cat.categoryId}
                className={`bg-slate-900/60 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                  isSettled
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : cat.canSettle
                    ? "border-blue-500/40 bg-blue-950/10"
                    : "border-slate-800"
                }`}
              >
                <div>
                  {/* Title & Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        {cat.title}
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          +{cat.pointsValue} pkt
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{cat.description}</p>
                    </div>

                    {/* Status Badge */}
                    {isSettled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Rozliczone
                      </span>
                    ) : cat.readiness === "READY" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold shrink-0">
                        <Sparkles className="w-3.5 h-3.5" /> Gotowe do rozliczenia
                      </span>
                    ) : cat.readiness === "IN_PROGRESS" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold shrink-0">
                        <Clock className="w-3.5 h-3.5" /> W trakcie sezonu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-semibold shrink-0">
                        <HelpCircle className="w-3.5 h-3.5" /> Oczekuje na finał
                      </span>
                    )}
                  </div>

                  {/* Proposed Answers */}
                  <div className="space-y-1.5 my-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      {isSettled ? "Zatwierdzone poprawne odpowiedzi:" : "Proponowane poprawne odpowiedzi:"}
                    </span>

                    {cat.proposedAnswers.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-1">
                        Brak wyłonionych liderów / Finał nierozstrzygnięty
                      </span>
                    ) : (
                      cat.proposedAnswers.map((ans) => (
                        <div key={ans.id} className="flex items-center justify-between gap-2 text-xs py-1">
                          <div className="flex items-center gap-2">
                            <TeamLogo
                              logoUrl={ans.logoUrl}
                              teamName={ans.teamName || ans.name}
                              teamCode=""
                              size={18}
                            />
                            <span className="font-semibold text-slate-200">{ans.name}</span>
                            {ans.teamName && ans.teamName !== ans.name && (
                              <span className="text-[10px] text-slate-400">({ans.teamName})</span>
                            )}
                          </div>
                          {ans.subtext && (
                            <span className="text-[11px] font-mono text-amber-400/90 font-medium">
                              {ans.subtext}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Readiness Note */}
                  <p className="text-[11px] text-slate-400 italic mb-4">
                    {cat.readinessReason}
                  </p>
                </div>

                {/* Footer / Stats & CTA */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>
                      Trafiło: <strong className="text-slate-200">{cat.winningUsersCount}</strong> os. (
                      {cat.totalPointsToAward} pkt)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      cat.canSettle && !isSettled
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {isSettled ? "Szczegóły / Korekta" : cat.canSettle ? "Rozlicz kategorię" : "Podgląd"}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation & Details Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Rozliczenie: {selectedCategory.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Wartość: +{selectedCategory.pointsValue} pkt | Hash preview: <code>{selectedCategory.previewHash}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Readiness Notice */}
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  selectedCategory.canSettle
                    ? "bg-blue-950/40 border-blue-500/30 text-blue-300"
                    : "bg-amber-950/40 border-amber-500/30 text-amber-300"
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">
                    {selectedCategory.canSettle ? "Kategoria gotowa do rozliczenia" : "Rozliczenie zablokowane"}
                  </strong>
                  <span className="text-[11px] opacity-90">{selectedCategory.readinessReason}</span>
                </div>
              </div>

              {/* Proposed Answers */}
              <div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Poprawne odpowiedzi ({selectedCategory.proposedAnswers.length}):
                </span>
                <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedCategory.proposedAnswers.map((ans) => (
                    <div key={ans.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <TeamLogo logoUrl={ans.logoUrl} teamName={ans.teamName || ans.name} teamCode="" size={18} />
                        <span className="font-semibold text-slate-200">{ans.name}</span>
                        {ans.teamName && ans.teamName !== ans.name && (
                          <span className="text-slate-400">({ans.teamName})</span>
                        )}
                      </div>
                      <span className="font-mono text-emerald-400 font-semibold">+{selectedCategory.pointsValue} pkt</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Impacted Users List */}
              <div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Wpływ na graczy ({selectedCategory.impactedUsers.length} oddanych typów):
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  {selectedCategory.impactedUsers.length === 0 ? (
                    <span className="text-slate-500 italic block py-1 text-center">Brak typów w tej kategorii</span>
                  ) : (
                    selectedCategory.impactedUsers.map((u) => (
                      <div
                        key={u.userId}
                        className={`flex items-center justify-between py-1 px-2 rounded ${
                          u.isCorrect ? "bg-emerald-950/30 text-emerald-300" : "text-slate-400"
                        }`}
                      >
                        <span className="font-medium">{u.username}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">{u.selectedName}</span>
                          <span className={`font-mono font-bold ${u.isCorrect ? "text-emerald-400" : "text-slate-500"}`}>
                            {u.isCorrect ? `+${selectedCategory.pointsValue} pkt` : "0 pkt"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSettlement(selectedCategory)}
                disabled={!selectedCategory.canSettle || isPending}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Trwa atomowy settlement...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Zatwierdź rozliczenie i przyznaj punkty
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
