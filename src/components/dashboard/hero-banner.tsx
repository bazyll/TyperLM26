import Link from "next/link";
import { BarChart3, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl ucl-hero-banner p-6 sm:p-8 md:p-10 shadow-2xl border border-blue-500/20">
      {/* Background Decorative Star Ball & Stadium Glow */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none opacity-40 md:opacity-90 overflow-hidden flex items-center justify-end">
        <div className="relative w-72 h-72 md:w-96 md:h-96 mr-[-30px] rounded-full border border-blue-400/30 flex items-center justify-center animate-[spin_60s_linear_infinite]">
          <div className="absolute inset-4 rounded-full border border-indigo-400/20" />
          <div className="absolute inset-12 rounded-full border border-blue-500/20" />
          <div className="absolute top-4 left-1/2 w-4 h-4 bg-blue-400/60 rounded-full blur-sm" />
          <div className="absolute bottom-8 right-12 w-6 h-6 bg-indigo-400/60 rounded-full blur-sm" />
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600/40 to-indigo-600/40 blur-xl" />
        </div>
      </div>

      <div className="relative z-10 max-w-xl flex flex-col gap-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider w-fit">
          <Sparkles className="w-3.5 h-3.5" />
          Liga Mistrzów 2026/2027
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
          Tipuj. Zdobywaj punkty. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
            Zostań mistrzem typerów! 🏆
          </span>
        </h1>

        <p className="text-sm text-slate-300 max-w-md">
          Obstawiaj mecze fazy ligowej, walcz o punkty w Pick&apos;em i zgarniaj bonusy w Typach Specjalnych.
        </p>

        <div className="pt-2">
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 rounded-xl px-6">
            <Link href="/ranking" className="flex items-center gap-2">
              <span>Zobacz ranking</span>
              <BarChart3 className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
