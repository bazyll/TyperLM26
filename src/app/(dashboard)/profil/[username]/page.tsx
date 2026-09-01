import { notFound } from "next/navigation";
import { Trophy, Star, Lock, Shield, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getUserStatsAction, getLeaderboardAction } from "@/lib/matches/actions";
import { Database } from "@/types/database.types";
import { TeamLogo } from "@/components/team-logo";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PredictionRow = Database["public"]["Tables"]["predictions"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type SpecialCategoryRow = Database["public"]["Tables"]["special_prediction_categories"]["Row"];
type SpecialPredictionRow = Database["public"]["Tables"]["special_predictions"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type PickemConfigRow = Database["public"]["Tables"]["pickem_config"]["Row"];
type PickemSubmissionRow = Database["public"]["Tables"]["pickem_submissions"]["Row"];
type PickemSelectionRow = Database["public"]["Tables"]["pickem_selections"]["Row"];

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

  const isOwner = currentUser?.id === profile.id;

  const [stats, leaderboard, { data: rawMatchesPreds }, { data: rawSpecialCats }, { data: rawSpecialPreds }, { data: rawTeams }, { data: rawPlayers }, { data: rawPickemCfg }, { data: rawPickemSub }, { data: rawPickemSels }] = await Promise.all([
    getUserStatsAction(profile.id),
    getLeaderboardAction(),
    supabase
      .from("predictions")
      .select(`
        *,
        match:matches(
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        )
      `)
      .eq("user_id", profile.id),
    supabase.from("special_prediction_categories").select("*").order("created_at", { ascending: true }),
    supabase.from("special_predictions").select("*").eq("user_id", profile.id),
    supabase.from("teams").select("*"),
    supabase.from("players").select("*"),
    supabase.from("pickem_config").select("*").maybeSingle(),
    supabase.from("pickem_submissions").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.from("pickem_selections").select("*"),
  ]);

  const userEntry = leaderboard.find((e) => e.userId === profile.id);
  const userRank = userEntry?.rank;

  const teamsMap = new Map<string, TeamRow>();
  (rawTeams as unknown as TeamRow[] || []).forEach((t) => teamsMap.set(t.id, t));

  const playersMap = new Map<string, PlayerRow>();
  (rawPlayers as unknown as PlayerRow[] || []).forEach((p) => playersMap.set(p.id, p));

  const specialCategories = (rawSpecialCats || []) as unknown as SpecialCategoryRow[];
  const specialPredictions = (rawSpecialPreds || []) as unknown as SpecialPredictionRow[];
  const pickemConfig = rawPickemCfg as unknown as PickemConfigRow | null;
  const pickemSub = rawPickemSub as unknown as PickemSubmissionRow | null;
  const pickemSels = (rawPickemSels || []) as unknown as PickemSelectionRow[];

  const isPickemLocked = Boolean(pickemConfig && (new Date(pickemConfig.deadline_at).getTime() <= Date.now() || pickemConfig.is_locked));
  const canViewPickem = isOwner || isPickemLocked;

  const initials = `${profile.first_name[0] || "U"}${profile.last_name[0] || ""}`;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Profile Header Card */}
      <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
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
                <Badge variant="default" className="gap-1 bg-blue-600/30 text-blue-300 border-blue-500/40">
                  <Shield className="w-3 h-3 text-blue-400" />
                  Admin
                </Badge>
              )}
              {!profile.is_active && (
                <Badge variant="destructive">Konto nieaktywne</Badge>
              )}
            </div>
            <span className="text-sm text-slate-400 font-medium">@{profile.username}</span>

            {/* Total Points & Breakdown Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3 w-full sm:w-auto">
              <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Miejsce</span>
                <div className="text-base sm:text-lg font-extrabold text-white">{userRank ? `#${userRank}` : "-"}</div>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Mecze</span>
                <div className="text-base sm:text-lg font-extrabold text-blue-400">{userEntry?.matchPoints || 0} pkt</div>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Specjalne</span>
                <div className="text-base sm:text-lg font-extrabold text-purple-400">{userEntry?.specialPoints || 0} pkt</div>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Pick&apos;em</span>
                <div className="text-base sm:text-lg font-extrabold text-amber-400">{userEntry?.pickemPoints || 0} pkt</div>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-blue-950/40 border border-blue-500/40 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] text-blue-300 uppercase font-bold">RAZEM</span>
                <div className="text-base sm:text-lg font-extrabold text-white">{userEntry?.totalPoints || 0} pkt</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Special Predictions Profile Section */}
      <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Typy Specjalne</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {specialCategories.map((cat) => {
            const isCatLocked = new Date(cat.deadline_at).getTime() <= Date.now() || cat.is_locked;
            const canViewCat = isOwner || isCatLocked;
            const pred = specialPredictions.find((p) => p.category_id === cat.id);

            const team = pred?.selected_team_id ? teamsMap.get(pred.selected_team_id) : undefined;
            const player = pred?.selected_player_id ? playersMap.get(pred.selected_player_id) : undefined;

            return (
              <div key={cat.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">{cat.title}</span>
                  {canViewCat ? (
                    <div className="mt-1 flex items-center gap-2">
                      {team ? (
                        <>
                          <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                            <TeamLogo
                              logoUrl={team.logo_url}
                              teamName={team.name}
                              teamCode={team.code}
                              size={20}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-sm font-bold text-white">{team.name}</span>
                        </>
                      ) : player ? (
                        <span className="text-sm font-bold text-white">{player.name}</span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Brak typu</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ukryty do deadline&apos;u</span>
                    </div>
                  )}
                </div>

                {cat.status === "settled" && pred && pred.points_awarded !== null && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                    <span className={`text-xs font-bold ${pred.points_awarded > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {pred.points_awarded > 0 ? `✅ +${pred.points_awarded} pkt` : `❌ 0 pkt`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Pick'em Profile Section */}
      <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Pick&apos;em fazy ligowej</h2>
          </div>
          {pickemSub?.points_awarded !== null && pickemSub?.points_awarded !== undefined && (
            <span className="text-sm font-extrabold text-amber-400">
              Zdobyte: {pickemSub.points_awarded} pkt
            </span>
          )}
        </div>

        {canViewPickem ? (
          pickemSub ? (
            (() => {
              const userSelections = pickemSels.filter((s) => s.submission_id === pickemSub.id);
              const firstSelection = userSelections.find((s) => s.category === "first");
              const top8Selections = userSelections.filter((s) => s.category === "top8");
              const outSelections = userSelections.filter((s) => s.category === "out");

              return (
                <div className="space-y-3">
                  {/* FIRST */}
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                      🥇 FIRST (1. miejsce)
                    </span>
                    <span className="text-sm font-bold text-white">
                      {firstSelection?.team_id ? teamsMap.get(firstSelection.team_id)?.name : "Brak"}
                    </span>
                  </div>

                  {/* TOP 8 */}
                  <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">
                      🔵 TOP 8 (miejsca 1–8)
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {top8Selections.map((s) => (
                        <span key={s.id} className="px-2 py-0.5 rounded-md bg-blue-500/20 text-xs font-semibold text-blue-200">
                          {teamsMap.get(s.team_id)?.short_name || s.team_id}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* OUT */}
                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
                    <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
                      🔴 OUT (miejsca 25–36)
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {outSelections.map((s) => (
                        <span key={s.id} className="px-2 py-0.5 rounded-md bg-rose-500/20 text-xs font-semibold text-rose-200">
                          {teamsMap.get(s.team_id)?.short_name || s.team_id}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-xs text-slate-500 italic">Użytkownik nie zapisał zestawu Pick&apos;em.</p>
          )
        ) : (
          <div className="p-6 text-center rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Zestaw Pick&apos;em gracza pozostaje ukryty do momentu zamknięcia typowania.</span>
          </div>
        )}
      </Card>

      {/* Match Predictions History */}
      <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">Historia typów meczowych</h2>

        {!rawMatchesPreds || rawMatchesPreds.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 rounded-2xl bg-slate-950 border border-slate-800">
            Użytkownik nie obstawił jeszcze żadnego spotkania.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(rawMatchesPreds as unknown as Array<PredictionRow & {
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
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">
                      {match.home_team?.short_name} vs {match.away_team?.short_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {match.matchday ? `Kolejka ${match.matchday}` : match.stage}
                    </span>
                  </div>

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
