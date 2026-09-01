"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { User, Settings, Lock, Upload, Save, Trophy, Flame, Shield, CheckCircle, AlertCircle, Loader2, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  updateUsernameAction,
  changePasswordAction,
  updateAvatarUrlAction,
  getCurrentUserProfile,
} from "@/lib/auth/actions";
import { getUserStatsAction, getLeaderboardAction, getMatchesWithPredictionsAction } from "@/lib/matches/actions";
import { uploadAvatar } from "@/lib/supabase/storage";
import { UserProfile, UserMatchStats, MatchWithTeams } from "@/types";
import { ProfilePredictionsHistory } from "@/components/profile/profile-predictions-history";

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserMatchStats | null>(null);
  const [userRank, setUserRank] = useState<number | undefined>(undefined);
  const [userMatches, setUserMatches] = useState<MatchWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Form states
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");

  // Feedback states
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const p = await getCurrentUserProfile();
        if (p) {
          setProfile(p);
          setUsernameInput(p.username);

          const [userStats, leaderboard, allMatches] = await Promise.all([
            getUserStatsAction(p.id),
            getLeaderboardAction(),
            getMatchesWithPredictionsAction(),
          ]);

          setStats(userStats);
          const rank = leaderboard.find((e) => e.userId === p.id)?.rank;
          setUserRank(rank);

          const predictedMatches = allMatches.filter((m) => m.userPrediction);
          setUserMatches(predictedMatches);
        }
      } catch (err) {
        console.error("Error loading account data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleUpdateUsername = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    startTransition(async () => {
      const res = await updateUsernameAction(usernameInput);
      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas zmiany loginu." });
      } else {
        setStatusMessage({ type: "success", text: "Login został pomyślnie zaktualizowany!" });
        if (profile) setProfile({ ...profile, username: usernameInput.toLowerCase().trim() });
      }
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (passwordInput !== confirmPasswordInput) {
      setStatusMessage({ type: "error", text: "Hasła nie są identyczne." });
      return;
    }

    startTransition(async () => {
      const res = await changePasswordAction(passwordInput);
      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas zmiany hasła." });
      } else {
        setStatusMessage({ type: "success", text: "Hasło zostało pomyślnie zmienione!" });
        setPasswordInput("");
        setConfirmPasswordInput("");
      }
    });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setStatusMessage(null);

    startTransition(async () => {
      const uploadRes = await uploadAvatar(profile.id, file);
      if (!uploadRes.success || !uploadRes.avatarUrl) {
        setStatusMessage({ type: "error", text: uploadRes.error || "Błąd podczas przesyłania zdjęcia." });
        return;
      }

      const updateRes = await updateAvatarUrlAction(uploadRes.avatarUrl);
      if (!updateRes.success) {
        setStatusMessage({ type: "error", text: updateRes.error || "Błąd podczas zapisu avatara." });
      } else {
        setProfile({ ...profile, avatarUrl: uploadRes.avatarUrl });
        setStatusMessage({ type: "success", text: "Zdjęcie profilowe zostało zaktualizowane!" });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const initials = profile ? `${profile.firstName[0] || "U"}${profile.lastName[0] || ""}` : "BB";

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <User className="w-3.5 h-3.5" />
            Twój Profil
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Moje Konto
          </h1>
        </div>

        <Button
          onClick={() => {
            setShowSettings(!showSettings);
            setStatusMessage(null);
          }}
          variant={showSettings ? "default" : "outline"}
          className="rounded-xl border-blue-500/30 text-xs font-semibold"
        >
          <Settings className="w-4 h-4 mr-2" />
          {showSettings ? "Powrót do profilu" : "Ustawienia konta"}
        </Button>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2.5 p-4 rounded-2xl text-xs font-medium border ${
            statusMessage.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/50 border-red-500/30 text-red-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {!showSettings ? (
        /* Normal Profile View with Stats & Matches */
        <div className="flex flex-col gap-6">
          {/* Main User Banner */}
          <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-blue-500/40 shadow-xl">
                {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.firstName} />}
                <AvatarFallback className="bg-gradient-to-br from-blue-900 to-indigo-950 text-2xl font-bold text-blue-300">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {profile ? `${profile.firstName} ${profile.lastName}` : "Bartosz"}
                  </h2>
                  {profile?.role === "admin" && (
                    <Badge variant="default" className="gap-1">
                      <Shield className="w-3 h-3 text-blue-400" />
                      Admin
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-slate-400 font-medium">@{profile?.username}</span>

                {/* Metrics */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                  <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                    <span className="text-[11px] text-slate-400">Miejsce w lidze</span>
                    <div className="text-lg font-extrabold text-white">{userRank ? `#${userRank}` : "-"}</div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                    <span className="text-[11px] text-slate-400">Punkty</span>
                    <div className="text-lg font-extrabold text-blue-400">{stats?.totalPoints ?? 0} pkt</div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                    <span className="text-[11px] text-slate-400">Skuteczność</span>
                    <div className="text-lg font-extrabold text-emerald-400">{stats?.accuracyRate ?? 0}%</div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                    <span className="text-[11px] text-slate-400">Śr. pkt/mecz</span>
                    <div className="text-lg font-extrabold text-amber-400">{stats?.averagePointsPerMatch ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Detailed Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
              <span className="text-xs text-slate-400">Dokładne (3 pkt)</span>
              <div className="text-xl font-extrabold text-emerald-400 mt-1">{stats?.exactScoresCount ?? 0}</div>
            </Card>
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
              <span className="text-xs text-slate-400">Różnica / remis (2 pkt)</span>
              <div className="text-xl font-extrabold text-blue-400 mt-1">{stats?.diffScoresCount ?? 0}</div>
            </Card>
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
              <span className="text-xs text-slate-400">Rezultat (1 pkt)</span>
              <div className="text-xl font-extrabold text-indigo-400 mt-1">{stats?.outcomeScoresCount ?? 0}</div>
            </Card>
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
              <span className="text-xs text-slate-400">Nietrafione (0 pkt)</span>
              <div className="text-xl font-extrabold text-slate-400 mt-1">{stats?.incorrectScoresCount ?? 0}</div>
            </Card>
          </div>

          {/* Predictions History */}
          <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4">Twoje obstawione mecze</h2>

            {(() => {
              const formattedPreds = userMatches
                .filter((m) => m.userPrediction)
                .map((m) => ({
                  id: m.id,
                  homeScore: m.userPrediction!.homeScore,
                  awayScore: m.userPrediction!.awayScore,
                  pointsAwarded: m.userPrediction!.pointsAwarded ?? null,
                  match: {
                    id: m.id,
                    stage: m.stage,
                    matchday: m.matchday,
                    kickoffAt: m.kickoffAt,
                    status: m.status,
                    isBettingLocked: m.isBettingLocked,
                    homeScore: m.homeScore,
                    awayScore: m.awayScore,
                    homeTeamName: m.homeTeam.name,
                    homeTeamShort: m.homeTeam.shortName,
                    awayTeamName: m.awayTeam.name,
                    awayTeamShort: m.awayTeam.shortName,
                  },
                }));

              return <ProfilePredictionsHistory predictions={formattedPreds} isOwner={true} />;
            })()}
          </Card>
        </div>
      ) : (
        /* Settings View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Username & Avatar */}
          <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl flex flex-col gap-6">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              <span>Profil i Awatar</span>
            </CardTitle>

            {/* Read-Only Names Notice */}
            <div className="p-3.5 rounded-2xl bg-[#101d36] border border-[#182645] text-xs text-slate-300">
              <div className="font-semibold text-white">
                {profile?.firstName} {profile?.lastName}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                🔒 Imię i nazwisko mogą być zmienione wyłącznie przez administratora ligi.
              </p>
            </div>

            {/* Avatar Upload */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-semibold text-slate-300">Zdjęcie profilowe (Awatar)</label>
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14 border border-blue-500/40">
                  {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
                  <AvatarFallback className="bg-blue-900 text-blue-300 font-bold text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Wgraj nowy awatar
                  </Button>
                  <p className="text-[10px] text-slate-500 mt-1">Formaty: JPG, PNG, WebP (maks. 2 MB)</p>
                </div>
              </div>
            </div>

            {/* Change Username Form */}
            <form onSubmit={handleUpdateUsername} className="flex flex-col gap-3 pt-4 border-t border-[#182645]/60">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="user-name-input" className="text-xs font-semibold text-slate-300">
                  Nazwa użytkownika (Login)
                </label>
                <Input
                  id="user-name-input"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                  className="bg-[#101d36]"
                />
                <span className="text-[11px] text-slate-500">
                  Login jest unikalny i służy do logowania w TyperLM26.
                </span>
              </div>

              <Button type="submit" disabled={isPending} size="sm" className="w-fit bg-blue-600 hover:bg-blue-500 text-xs">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Zapisz login
              </Button>
            </form>
          </Card>

          {/* Section 2: Password Change */}
          <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl flex flex-col justify-between gap-6">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-blue-400" />
                <span>Bezpieczeństwo i Hasło</span>
              </CardTitle>
              <p className="text-xs text-slate-400 mb-6">
                Zmień hasło do swojego konta. Hasło musi mieć co najmniej 8 znaków.
              </p>

              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pwd-input" className="text-xs font-semibold text-slate-300">
                    Nowe hasło
                  </label>
                  <Input
                    id="pwd-input"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    placeholder="Min. 8 znaków"
                    className="bg-[#101d36]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pwd-confirm-input" className="text-xs font-semibold text-slate-300">
                    Powtórz nowe hasło
                  </label>
                  <Input
                    id="pwd-confirm-input"
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    required
                    placeholder="Powtórz hasło"
                    className="bg-[#101d36]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isPending || !passwordInput || !confirmPasswordInput}
                  size="sm"
                  className="w-fit mt-2 bg-blue-600 hover:bg-blue-500 text-xs"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  Zmień hasło
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
