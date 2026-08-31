import { SpecialPredictionsPreview } from "@/components/dashboard/special-predictions-preview";
import { Star, ShieldAlert } from "lucide-react";

export default function SpecialPredictionsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Star className="w-3.5 h-3.5" />
          Typy długoterminowe (20 pkt za trafienie)
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Typy Specjalne
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Wskaż triumfatorów, króla strzelców i statystyki sezonu. Typy zostaną zablokowane po upływie deadline&apos;u.
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-950/40 border border-blue-500/20 text-xs text-blue-300">
        <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0" />
        <span>
          Deadline dla wszystkich typów specjalnych: <strong>15.09.2026, 18:45 UTC</strong>. Do tego momentu Twoje typy są widoczne tylko dla Ciebie.
        </span>
      </div>

      <SpecialPredictionsPreview />
    </div>
  );
}
