import { HeroBanner } from "@/components/dashboard/hero-banner";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { SpecialPredictionsPreview } from "@/components/dashboard/special-predictions-preview";
import { MiniRanking } from "@/components/dashboard/mini-ranking";
import { UserStatsWidget } from "@/components/dashboard/user-stats-widget";

export default function DashboardPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left & Center Main Stream */}
      <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Upcoming Matches */}
        <UpcomingMatches />

        {/* Special Predictions Preview */}
        <SpecialPredictionsPreview />
      </div>

      {/* Right Column: Mini Ranking & Personal Stats */}
      <div className="w-full lg:w-80 xl:w-88 flex flex-col gap-6 shrink-0">
        {/* Top 3 Podium & Mini Ranking */}
        <MiniRanking />

        {/* User Stats Widget */}
        <UserStatsWidget />
      </div>
    </div>
  );
}
