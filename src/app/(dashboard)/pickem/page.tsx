import { Target, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PickemPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <Target className="w-3.5 h-3.5" />
            Pick&apos;em Ligi Mistrzów
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Przewidywanie Fazy Ligowej
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Wybierz 1 zwycięzcę ligi, 7 drużyn do TOP 8 oraz 8 drużyn, które odpadną. Reszta trafi do strefy MIDDLE automatycznie.
          </p>
        </div>

        <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30">
          Zapisz Pick&apos;em
        </Button>
      </div>

      {/* Live Selection Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs font-bold text-amber-400">1. MIEJSCE (FIRST)</span>
          <div className="text-xl font-extrabold text-white mt-1">1 / 1</div>
          <span className="text-[11px] text-slate-400 mt-0.5">3 pkt za trafienie</span>
        </Card>

        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs font-bold text-blue-400">AWANS (TOP 8)</span>
          <div className="text-xl font-extrabold text-white mt-1">7 / 7</div>
          <span className="text-[11px] text-slate-400 mt-0.5">3 pkt / drużyna</span>
        </Card>

        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs font-bold text-red-400">ODPADNĄ (OUT)</span>
          <div className="text-xl font-extrabold text-white mt-1">8 / 8</div>
          <span className="text-[11px] text-slate-400 mt-0.5">3 pkt / drużyna</span>
        </Card>

        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs font-bold text-slate-400">ŚRODEK (MIDDLE)</span>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">Auto (20)</div>
          <span className="text-[11px] text-slate-400 mt-0.5">3 pkt / drużyna</span>
        </Card>
      </div>

      {/* Status Banner */}
      <div className="p-4 rounded-2xl bg-[#0c1527] border border-[#182645] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Twój zestaw wyborów jest kompletny</span>
            <span className="text-[11px] text-slate-400">Możesz edytować wybory do 15.09.2026, 18:45 UTC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
