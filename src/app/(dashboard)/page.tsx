import { HeroBanner } from "@/components/dashboard/hero-banner";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { SpecialPredictionsPreview } from "@/components/dashboard/special-predictions-preview";
import { MiniRanking } from "@/components/dashboard/mini-ranking";
import { UserStatsWidget } from "@/components/dashboard/user-stats-widget";
import { getMatchesWithPredictionsAction, getLeaderboardAction, getUserStatsAction } from "@/lib/matches/actions";
import { getCurrentUserProfile } from "@/lib/auth/actions";

export default async function DashboardPage() {
  const [currentUser, allMatches, leaderboard] = await Promise.all([
    getCurrentUserProfile(),
    getMatchesWithPredictionsAction(),
    getLeaderboardAction(),
  ]);

  const userStats = currentUser ? await getUserStatsAction(currentUser.id) : null;
  const userRank = currentUser ? leaderboard.find((e) => e.userId === currentUser.id)?.rank : undefined;

  // Filter next 3 upcoming or live matches
  const now = Date.now();
  const upcomingMatches = allMatches
    .filter((m) => m.status === "live" || (m.status === "scheduled" && new Date(m.kickoffAt).getTime() > now))
    .slice(0, 4);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left & Center Main Stream */}
      <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Upcoming / Live Matches */}
        <UpcomingMatches matches={upcomingMatches} />

        {/* Special Predictions Preview */}
        <SpecialPredictionsPreview />
      </div>

      {/* Right Column: Mini Ranking & Personal Stats */}
      <div className="w-full lg:w-80 xl:w-88 flex flex-col gap-6 shrink-0">
        {/* Top 3 Podium & Mini Ranking */}
        <MiniRanking leaderboard={leaderboard} />

        {/* User Stats Widget */}
        <UserStatsWidget stats={userStats} userRank={userRank} totalUsers={leaderboard.length} />
      </div>
    </div>
  );
}
