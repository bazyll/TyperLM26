import { getMatchesWithPredictionsAction, getLeaderboardAction } from "@/lib/matches/actions";
import { getAnnouncementsAction } from "@/lib/announcements/actions";
import { MiniRanking } from "@/components/dashboard/mini-ranking";
import { SidebarMatches } from "@/components/dashboard/sidebar-matches";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Pin, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [allMatches, leaderboard, announcements] = await Promise.all([
    getMatchesWithPredictionsAction(),
    getLeaderboardAction(),
    getAnnouncementsAction(),
  ]);

  // Homepage displays max 3 announcements: pinned first, newest first
  const displayedAnnouncements = announcements.slice(0, 3);

  // Priority selection of max 3 sidebar matches:
  // 1. All currently LIVE matches
  // 2. Remaining slots filled with closest upcoming scheduled matches
  // 3. If still needed (or no upcoming/live), fill with most recently finished matches
  const now = Date.now();
  const liveMatches = allMatches
    .filter((m) => m.status === "live")
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  const upcomingMatches = allMatches
    .filter((m) => m.status === "scheduled" && new Date(m.kickoffAt).getTime() > now)
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  const finishedMatches = allMatches
    .filter((m) => m.status === "finished")
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

  const selectedSidebarMatches = [...liveMatches, ...upcomingMatches, ...finishedMatches].slice(0, 3);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start max-w-6xl mx-auto px-1 sm:px-0">
      {/* LEFT / MAIN COLUMN: Announcements Feed */}
      <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              <Bell className="w-3.5 h-3.5" />
              Tablica Ogłoszeń & Komunikaty
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Aktualności Ligi
            </h1>
          </div>

          <Link
            href="/ogloszenia"
            className="hidden sm:inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>Wszystkie ogłoszenia</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </Link>
        </div>

        {/* Announcements List */}
        {displayedAnnouncements.length === 0 ? (
          <Card className="p-12 text-center rounded-3xl border-[#182645] bg-[#0c1527] shadow-xl">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-1">Brak ogłoszeń</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Aktualnie nie ma żadnych nowych komunikatów od organizatora.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {displayedAnnouncements.map((item) => {
              const createdDate = new Date(item.createdAt);
              const dateStr = createdDate.toLocaleDateString("pl-PL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <Card
                  key={item.id}
                  className={`rounded-2xl sm:rounded-3xl border transition-all p-5 sm:p-6 shadow-xl ${
                    item.isPinned
                      ? "border-blue-500/40 bg-gradient-to-br from-[#0e1c38] via-[#0c1527] to-[#0c1527] shadow-blue-950/20"
                      : "border-[#182645] bg-[#0c1527] hover:border-blue-500/30"
                  }`}
                >
                  {/* Pinned & Date Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {item.isPinned && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[11px] font-bold text-blue-300">
                          <Pin className="w-3 h-3" />
                          Przypięte
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-medium">{dateStr}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2.5">
                    {item.title}
                  </h2>

                  {/* Content (Read-Only) */}
                  <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed mb-4">
                    {item.content}
                  </p>

                  {/* Author Footer */}
                  <div className="pt-3 border-t border-[#182645]/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="w-6 h-6 sm:w-7 sm:h-7 border border-blue-500/20">
                        {item.authorAvatarUrl && <AvatarImage src={item.authorAvatarUrl} />}
                        <AvatarFallback className="bg-[#162444] text-[10px] text-blue-300 font-bold">
                          {item.authorName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-slate-300 font-medium truncate max-w-[150px] sm:max-w-none">
                        {item.authorName}
                      </span>
                    </div>

                    <Link
                      href="/ogloszenia"
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Szczegóły</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </Card>
              );
            })}

            {/* Bottom link: Zobacz wszystkie ogłoszenia -> /ogloszenia */}
            <div className="pt-2 text-center">
              <Button
                asChild
                variant="outline"
                className="rounded-2xl border-[#182645] bg-[#0c1527] text-blue-400 hover:text-white hover:bg-[#101d36] hover:border-blue-500/40 text-xs font-semibold px-5 py-2.5 shadow-md"
              >
                <Link href="/ogloszenia" className="inline-flex items-center gap-1.5">
                  <span>Zobacz wszystkie ogłoszenia</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR: Ranking (top on desktop) & Mecze (underneath on desktop; ordered cleanly on mobile) */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-6 shrink-0 lg:sticky lg:top-6 self-start">
        {/* On Mobile: Mecze (order-1) -> Ranking (order-2); On Desktop: Ranking (order-1) -> Mecze (order-2) */}
        <div className="order-2 lg:order-1">
          <MiniRanking leaderboard={leaderboard} />
        </div>

        <div className="order-1 lg:order-2">
          <SidebarMatches matches={selectedSidebarMatches} />
        </div>
      </div>
    </div>
  );
}
