import { HeroBanner } from "@/components/dashboard/hero-banner";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { SpecialPredictionsPreview } from "@/components/dashboard/special-predictions-preview";
import { MiniRanking } from "@/components/dashboard/mini-ranking";
import { UserStatsWidget } from "@/components/dashboard/user-stats-widget";
import { getMatchesWithPredictionsAction, getLeaderboardAction, getUserStatsAction } from "@/lib/matches/actions";
import { getAnnouncementsAction } from "@/lib/announcements/actions";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { Bell, Pin, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const [currentUser, allMatches, leaderboard, announcements] = await Promise.all([
    getCurrentUserProfile(),
    getMatchesWithPredictionsAction(),
    getLeaderboardAction(),
    getAnnouncementsAction(),
  ]);

  const userStats = currentUser ? await getUserStatsAction(currentUser.id) : null;
  const userRank = currentUser ? leaderboard.find((e) => e.userId === currentUser.id)?.rank : undefined;

  // Filter next 4 upcoming or live matches
  const now = Date.now();
  const upcomingMatches = allMatches
    .filter((m) => m.status === "live" || (m.status === "scheduled" && new Date(m.kickoffAt).getTime() > now))
    .slice(0, 4);

  const latestAnnouncement = announcements[0];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left & Center Main Stream */}
      <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Latest Announcement (if exists) */}
        {latestAnnouncement && (
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                <Bell className="w-3.5 h-3.5" />
                <span>Najnowsze ogłoszenie</span>
                {latestAnnouncement.isPinned && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[10px] text-blue-300 flex items-center gap-1 font-bold">
                    <Pin className="w-2.5 h-2.5" /> Przypięte
                  </span>
                )}
              </div>
              <Link
                href="/ogloszenia"
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                Wszystkie <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <h3 className="font-bold text-white text-base">{latestAnnouncement.title}</h3>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{latestAnnouncement.content}</p>
          </div>
        )}

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
