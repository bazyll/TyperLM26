import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { CalendarDays, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MatchesPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <CalendarDays className="w-3.5 h-3.5" />
            Terminarz i typowanie
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Mecze Ligi Mistrzów
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Typuj dokładne wyniki przed kickoffem spotkań. Typy innych graczy zostaną odsłonięte po rozpoczęciu każdego meczu.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Button size="sm" variant="default" className="text-xs">
            Wszystkie
          </Button>
          <Button size="sm" variant="outline" className="text-xs">
            Kolejka 1
          </Button>
          <Button size="sm" variant="outline" className="text-xs">
            Kolejka 2
          </Button>
        </div>
      </div>

      {/* Matches Stream */}
      <UpcomingMatches />
    </div>
  );
}
