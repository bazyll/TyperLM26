import Link from "next/link";
import { Trophy, Flame, Zap, ChevronRight } from "lucide-react";

interface SpecialCardItem {
  id: string;
  title: string;
  subtitle: string;
  deadlineStr: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText?: string;
}

const specialCards: SpecialCardItem[] = [
  {
    id: "winner",
    title: "Zwycięzca Ligi Mistrzów",
    subtitle: "Kto wygra finał LM 26/27?",
    deadlineStr: "15.09.2026",
    icon: Trophy,
  },
  {
    id: "top_scorer",
    title: "Król strzelców",
    subtitle: "Kto zdobędzie najwięcej bramek?",
    deadlineStr: "15.09.2026",
    icon: Flame,
  },
  {
    id: "top_scoring_team",
    title: "Najwięcej goli",
    subtitle: "Która drużyna strzeli najwięcej?",
    deadlineStr: "15.09.2026",
    icon: Zap,
  },
];

export function SpecialPredictionsPreview() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Typy specjalne
        </h2>
        <Link
          href="/typy-specjalne"
          className="flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>Zobacz wszystkie</span>
          <ChevronRight className="w-4 h-4 ml-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {specialCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.id}
              href="/typy-specjalne"
              className="ucl-special-card rounded-2xl p-4 flex flex-col justify-between gap-4 group relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-400">{card.subtitle}</p>
                </div>

                <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-110 group-hover:border-blue-400 transition-all">
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#182645]/60 text-xs">
                <span className="text-slate-400 font-medium">
                  Typy do: <span className="text-slate-200">{card.deadlineStr}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
