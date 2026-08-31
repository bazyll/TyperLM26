import { notFound } from "next/navigation";
import { Trophy, Flame, Lock, Shield, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getUserStatsAction, getLeaderboardAction } from "@/lib/matches/actions";
import { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PredictionRow = Database["public"]["Tables"]["predictions"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const normalizedUsername = decodeURIComponent(username).toLowerCase();

  const supabase = await createClient();
  const currentUser = await getCurrentUserProfile();

  const { data: rawProfile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", normalizedUsername)
    .maybeSingle();

  const profile = rawProfile as unknown as ProfileRow | null;

  if (error || !profile) {
    notFound();
  }

  const [stats, leaderboard] = await Promise.all([
    getUserStatsAction(profile.id),
    getLeaderboardAction(),
  ]);

  const userRank = leaderboard.find((e) => e.userId === profile.id)?.rank;
  const isOwner = currentUser?.id === profile.id;

  // Fetch match predictions for this user
  const { data: userPredictions } = await supabase
    .from("predictions")
    .select(`
      *,
      match:matches(
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      )
    `)
    .eq("user_id", profile.id);

  const initials = `${profile.first_name[0] || "U"}${profile.last_name[0] || ""}`;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Profile Header Card */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-blue-500/40 shadow-xl">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.first_name} />}
            <AvatarFallback className="bg-gradient-to-br from-blue-900 to-indigo-950 text-2xl font-bold text-blue-300">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {profile.first_name} {profile.last_name}
              </h1>
              {profile.role === "admin" && (
                <Badge variant="default" className="gap-1">
                  <Shield className="w-3 h-3 text-blue-400" />
                  Admin
                </Badge>
              )}
              {!profile.is_active && (
                <Badge variant="destructive">Konto nieaktywne</Badge>
              )}
            </div>
            <span className="text-sm text-slate-400 font-medium">@{profile.username}</span>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
              <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                <span className="text-[11px] text-slate-400">Miejsce</span>
                <div className="text-lg font-extrabold text-white">{userRank ? `#${userRank}` : "-"}</div>
              </div>
              <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                <span className="text-[11px] text-slate-400">Punkty</span>
                <div className="text-lg font-extrabold text-blue-400">{stats.totalPoints} pkt</div>
              </div>
              <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                <span className="text-[11px] text-slate-400">Skuteczność</span>
                <div className="text-lg font-extrabold text-emerald-400">{stats.accuracyRate}%</div>
              </div>
              <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                <span className="text-[11px] text-slate-400">Śr. pkt/mecz</span>
                <div className="text-lg font-extrabold text-amber-400">{stats.averagePointsPerMatch}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Dokładne (3 pkt)</span>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{stats.exactScoresCount}</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Różnica bramek / remis (2 pkt)</span>
          <div className="text-xl font-extrabold text-blue-400 mt-1">{stats.diffScoresCount}</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Rezultat (1 pkt)</span>
          <div className="text-xl font-extrabold text-indigo-400 mt-1">{stats.outcomeScoresCount}</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Nietrafione (0 pkt)</span>
          <div className="text-xl font-extrabold text-slate-400 mt-1">{stats.incorrectScoresCount}</div>
        </Card>
      </div>

      {/* Predictions History */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">Historia typów</h2>

        {!userPredictions || userPredictions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 rounded-2xl bg-[#101d36]/40 border border-[#182645]">
            Użytkownik nie obstawił jeszcze żadnego spotkania.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(userPredictions as unknown as Array<PredictionRow & {
              match: MatchRow & {
                home_team: TeamRow;
                away_team: TeamRow;
              };
            }>).map((pred) => {
              const match = pred.match;
              if (!match) return null;

              const isKickoffPassed = new Date(match.kickoff_at).getTime() <= Date.now() || match.is_betting_locked;
              const canViewScore = isOwner || isKickoffPassed;

              return (
                <div
                  key={pred.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#101d36] border border-[#182645]"
                >
                  {/* Teams info */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">
                      {match.home_team?.short_name} vs {match.away_team?.short_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {match.matchday ? `Kolejka ${match.matchday}` : match.stage}
                    </span>
                  </div>

                  {/* Prediction & Result */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {canViewScore ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Typ:</span>
                        <span className="text-sm font-mono font-extrabold text-white">
                          {pred.home_score}:{pred.away_score}
                        </span>
                        {match.home_score !== null && match.away_score !== null && (
                          <span className="text-xs text-slate-500 font-mono">
                            (Wynik: {match.home_score}:{match.away_score})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Typ ukryty do rozpoczęcia meczu</span>
                      </div>
                    )}

                    {/* Awarded Points Badge */}
                    {match.status === "finished" && pred.points_awarded !== null && (
                      <Badge
                        className={`text-xs font-bold ${
                          pred.points_awarded === 3
                            ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                            : pred.points_awarded === 2
                            ? "bg-blue-950 border-blue-500 text-blue-300"
                            : pred.points_awarded === 1
                            ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                            : "bg-slate-900 border-slate-700 text-slate-400"
                        }`}
                      >
                        +{pred.points_awarded} pkt
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
