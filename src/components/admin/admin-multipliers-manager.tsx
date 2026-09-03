"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Zap, Calendar, Target, CheckCircle2, AlertCircle, Loader2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminGetMultipliersAction,
  adminUpdateMatchMultiplierAction,
  adminUpdatePickemMultiplierAction,
} from "@/lib/matches/actions";

export function AdminMultipliersManager() {
  const [matchMultiplier, setMatchMultiplier] = useState(1);
  const [pickemMultiplier, setPickemMultiplier] = useState(1);
  const [futureMatchesCount, setFutureMatchesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Confirmation Modals State
  const [confirmMatchModal, setConfirmMatchModal] = useState<number | null>(null);
  const [confirmPickemModal, setConfirmPickemModal] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const loadMultipliers = async () => {
    setIsLoading(true);
    try {
      const res = await adminGetMultipliersAction();
      setMatchMultiplier(res.matchMultiplier);
      setPickemMultiplier(res.pickemMultiplier);
      setFutureMatchesCount(res.futureMatchesCount);
    } catch (err) {
      console.error("Error fetching multipliers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMultipliers();
  }, []);

  const handleApplyMatchMultiplier = (newVal: number) => {
    startTransition(async () => {
      const res = await adminUpdateMatchMultiplierAction({ multiplier: newVal });
      if (res.success) {
        setMatchMultiplier(newVal);
        setConfirmMatchModal(null);
        setFeedback({
          success: true,
          message: `Mnożnik punktów meczowych został pomyślnie zmieniony na x${newVal}.`,
        });
        loadMultipliers();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ success: false, message: res.error || "Błąd zapisu." });
      }
    });
  };

  const handleApplyPickemMultiplier = (newVal: number) => {
    startTransition(async () => {
      const res = await adminUpdatePickemMultiplierAction({ multiplier: newVal });
      if (res.success) {
        setPickemMultiplier(newVal);
        setConfirmPickemModal(null);
        setFeedback({
          success: true,
          message: `Mnożnik punktów Pick'em został pomyślnie zmieniony na x${newVal}.`,
        });
        loadMultipliers();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ success: false, message: res.error || "Błąd zapisu." });
      }
    });
  };

  const options = [1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col gap-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-2xl text-xs font-semibold border ${
            feedback.success
              ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/50 border-red-500/30 text-red-300"
          }`}
        >
          {feedback.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Matches Multiplier Card */}
        <div className="flex flex-col gap-4 p-5 rounded-3xl bg-[#0c1527] border border-[#182645] shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Mnożnik Meczów</h3>
                <p className="text-[11px] text-slate-400">Punkty za pojedyncze spotkania</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-500/20 text-cyan-300 border border-cyan-500/30">
              Aktualnie: x{matchMultiplier}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Zwiększa punktację za mecze (np. exact: 3 pkt &times; {matchMultiplier} ={" "}
            <strong>{3 * matchMultiplier} pkt</strong>).
          </p>

          <div className="flex items-center gap-1.5 p-3 rounded-xl bg-[#101d36]/60 border border-[#182645] text-[11px] text-slate-400">
            <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Zmiana wpłynie na <strong>{futureMatchesCount}</strong> przyszłych nierozpoczętych meczów. Zakończone spotkania zachowują swoje punkty na stałe.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#182645]/80">
            <span className="text-xs font-semibold text-slate-400 mr-1">Ustaw mnożnik:</span>
            {options.map((opt) => (
              <Button
                key={opt}
                size="sm"
                variant={matchMultiplier === opt ? "default" : "outline"}
                disabled={isLoading || isPending}
                onClick={() => {
                  if (opt !== matchMultiplier) setConfirmMatchModal(opt);
                }}
                className={`text-xs font-bold rounded-xl h-8 px-3 cursor-pointer ${
                  matchMultiplier === opt
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 border-blue-500/40"
                    : "border-[#182645] bg-[#101d36]/40 text-slate-300 hover:text-white"
                }`}
              >
                x{opt}
              </Button>
            ))}
          </div>
        </div>

        {/* 2. Pick'em Multiplier Card */}
        <div className="flex flex-col gap-4 p-5 rounded-3xl bg-[#0c1527] border border-[#182645] shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Mnożnik Pick&apos;em</h3>
                <p className="text-[11px] text-slate-400">Punkty za trafienia w tabeli</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Aktualnie: x{pickemMultiplier}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Zwiększa punktację za trafienia w strefy Pick&apos;em (np. 1 trafienie: 3 pkt &times;{" "}
            {pickemMultiplier} = <strong>{3 * pickemMultiplier} pkt</strong>).
          </p>

          <div className="flex items-center gap-1.5 p-3 rounded-xl bg-[#101d36]/60 border border-[#182645] text-[11px] text-slate-400">
            <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              Mnożnik dotyczy aktywnej edycji fazy ligowej. Po rozliczeniu edycja zostaje trwale zablokowana.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#182645]/80">
            <span className="text-xs font-semibold text-slate-400 mr-1">Ustaw mnożnik:</span>
            {options.map((opt) => (
              <Button
                key={opt}
                size="sm"
                variant={pickemMultiplier === opt ? "default" : "outline"}
                disabled={isLoading || isPending}
                onClick={() => {
                  if (opt !== pickemMultiplier) setConfirmPickemModal(opt);
                }}
                className={`text-xs font-bold rounded-xl h-8 px-3 cursor-pointer ${
                  pickemMultiplier === opt
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20 border-purple-500/40"
                    : "border-[#182645] bg-[#101d36]/40 text-slate-300 hover:text-white"
                }`}
              >
                x{opt}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Matches Multiplier */}
      {confirmMatchModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0c1527] border border-[#182645] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Zmień mnożnik meczów na x{confirmMatchModal}</h3>
                <p className="text-xs text-slate-400">Potwierdzenie operacji administracyjnej</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Czy na pewno chcesz zmienić mnożnik punktów meczowych na <strong>x{confirmMatchModal}</strong>?
              Zmiana obejmie <strong>{futureMatchesCount}</strong> nadchodzących, nierozpoczętych meczów. Wszystkie rozliczone spotkania historyczne zachowają swoje dotychczasowe punkty.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#182645]">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirmMatchModal(null)}
                className="text-xs rounded-xl"
              >
                Anuluj
              </Button>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => handleApplyMatchMultiplier(confirmMatchModal)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Zatwierdź x{confirmMatchModal}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Pick'em Multiplier */}
      {confirmPickemModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0c1527] border border-[#182645] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Zmień mnożnik Pick&apos;em na x{confirmPickemModal}</h3>
                <p className="text-xs text-slate-400">Potwierdzenie operacji administracyjnej</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Czy na pewno chcesz zmienić mnożnik punktów Pick&apos;em na <strong>x{confirmPickemModal}</strong>?
              Zmiana zostanie zastosowana do wyliczenia punktów podczas finałowego rozliczenia tabeli fazy ligowej.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#182645]">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirmPickemModal(null)}
                className="text-xs rounded-xl"
              >
                Anuluj
              </Button>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => handleApplyPickemMultiplier(confirmPickemModal)}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Zatwierdź x{confirmPickemModal}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
