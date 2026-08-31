"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Shield,
  Users,
  Plus,
  Edit2,
  KeyRound,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Calendar,
  Clock,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  adminCreateUserAction,
  adminUpdateUserAction,
  adminToggleRoleAction,
  adminResetPasswordAction,
  adminGetUsersListAction,
  adminGetAuditLogsAction,
} from "@/lib/auth/actions";
import {
  adminCreateMatchAction,
  adminUpdateMatchAction,
  adminUpdateLiveScoreAction,
  adminFinalizeMatchAction,
  getMatchesWithPredictionsAction,
  getAllTeamsAction,
} from "@/lib/matches/actions";
import { Database, MatchStage, MatchStatus } from "@/types/database.types";
import { MatchWithTeams } from "@/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "matches" | "audit" | "export">("matches");

  // Data states
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Feedback states
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // User Modals state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [editUserModal, setEditUserModal] = useState<ProfileRow | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<ProfileRow | null>(null);
  const [createUserForm, setCreateUserForm] = useState({ username: "", firstName: "", lastName: "", password: "", role: "user" as "user" | "admin" });
  const [editUserForm, setEditUserForm] = useState({ firstName: "", lastName: "", username: "", isActive: true });
  const [tempPassword, setTempPassword] = useState("");

  // Match Modals state
  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
  const [editMatchModal, setEditMatchModal] = useState<MatchWithTeams | null>(null);
  const [liveMatchModal, setLiveMatchModal] = useState<MatchWithTeams | null>(null);
  const [finalizeMatchModal, setFinalizeMatchModal] = useState<MatchWithTeams | null>(null);

  const [createMatchForm, setCreateMatchForm] = useState({
    homeTeamId: "",
    awayTeamId: "",
    kickoffAt: "",
    stage: "league" as MatchStage,
    matchday: 1,
  });

  const [editMatchForm, setEditMatchForm] = useState({
    homeTeamId: "",
    awayTeamId: "",
    kickoffAt: "",
    stage: "league" as MatchStage,
    matchday: 1,
    status: "scheduled" as MatchStatus,
    homeScore: 0,
    awayScore: 0,
    liveMinute: 0,
    isBettingLocked: false,
  });

  const [liveScoreForm, setLiveScoreForm] = useState({ homeScore: 0, awayScore: 0, liveMinute: 0 });
  const [finalizeScoreForm, setFinalizeScoreForm] = useState({ homeScore: 0, awayScore: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, mList, tList, logs] = await Promise.all([
        adminGetUsersListAction(),
        getMatchesWithPredictionsAction(),
        getAllTeamsAction(),
        adminGetAuditLogsAction(),
      ]);
      setUsers(uList);
      setMatches(mList);
      setTeams(tList);
      setAuditLogs(logs);

      if (tList.length >= 2 && !createMatchForm.homeTeamId) {
        setCreateMatchForm((prev) => ({
          ...prev,
          homeTeamId: tList[0].id,
          awayTeamId: tList[1].id,
        }));
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers - User Management
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminCreateUserAction(createUserForm);
      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas tworzenia konta." });
      } else {
        setStatusMessage({ type: "success", text: `Konto @${createUserForm.username} zostało pomyślnie utworzone!` });
        setShowCreateUserModal(false);
        setCreateUserForm({ username: "", firstName: "", lastName: "", password: "", role: "user" });
        loadData();
      }
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModal) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminUpdateUserAction({
        userId: editUserModal.id,
        firstName: editUserForm.firstName,
        lastName: editUserForm.lastName,
        username: editUserForm.username,
        isActive: editUserForm.isActive,
      });

      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas aktualizacji użytkownika." });
      } else {
        setStatusMessage({ type: "success", text: "Dane użytkownika zostały zaktualizowane!" });
        setEditUserModal(null);
        loadData();
      }
    });
  };

  const handleToggleRole = (user: ProfileRow) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminToggleRoleAction(user.id, nextRole);
      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas zmiany roli." });
      } else {
        setStatusMessage({ type: "success", text: `Zmieniono rolę użytkownika @${user.username} na ${nextRole}.` });
        loadData();
      }
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUser) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminResetPasswordAction(resetPwdUser.id, tempPassword);
      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas resetowania hasła." });
      } else {
        setStatusMessage({ type: "success", text: `Nowe hasło dla @${resetPwdUser.username} zostało ustawione!` });
        setResetPwdUser(null);
        setTempPassword("");
        loadData();
      }
    });
  };

  // Handlers - Match Management
  const handleCreateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminCreateMatchAction({
        homeTeamId: createMatchForm.homeTeamId,
        awayTeamId: createMatchForm.awayTeamId,
        kickoffAt: new Date(createMatchForm.kickoffAt).toISOString(),
        stage: createMatchForm.stage,
        matchday: Number(createMatchForm.matchday),
      });

      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas dodawania meczu." });
      } else {
        setStatusMessage({ type: "success", text: "Mecz został pomyślnie dodany do terminarza!" });
        setShowCreateMatchModal(false);
        loadData();
      }
    });
  };

  const handleUpdateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMatchModal) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminUpdateMatchAction({
        matchId: editMatchModal.id,
        homeTeamId: editMatchForm.homeTeamId,
        awayTeamId: editMatchForm.awayTeamId,
        kickoffAt: new Date(editMatchForm.kickoffAt).toISOString(),
        stage: editMatchForm.stage,
        matchday: Number(editMatchForm.matchday),
        status: editMatchForm.status,
        homeScore: editMatchForm.homeScore,
        awayScore: editMatchForm.awayScore,
        liveMinute: editMatchForm.liveMinute,
        isBettingLocked: editMatchForm.isBettingLocked,
      });

      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas edycji meczu." });
      } else {
        setStatusMessage({ type: "success", text: "Dane meczu zostały zaktualizowane!" });
        setEditMatchModal(null);
        loadData();
      }
    });
  };

  const handleUpdateLiveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMatchModal) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminUpdateLiveScoreAction({
        matchId: liveMatchModal.id,
        homeScore: Number(liveScoreForm.homeScore),
        awayScore: Number(liveScoreForm.awayScore),
        liveMinute: Number(liveScoreForm.liveMinute),
      });

      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas aktualizacji wyniku LIVE." });
      } else {
        setStatusMessage({ type: "success", text: "Wynik na żywo został zaktualizowany!" });
        setLiveMatchModal(null);
        loadData();
      }
    });
  };

  const handleFinalizeMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalizeMatchModal) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminFinalizeMatchAction({
        matchId: finalizeMatchModal.id,
        homeScore: Number(finalizeScoreForm.homeScore),
        awayScore: Number(finalizeScoreForm.awayScore),
      });

      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas finalizacji meczu." });
      } else {
        setStatusMessage({ type: "success", text: "Mecz został zakończony, a punkty wszystkich graczy zostały atomowo przeliczone!" });
        setFinalizeMatchModal(null);
        loadData();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <Shield className="w-3.5 h-3.5" />
            Panel Administracyjny
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Zarządzanie TyperLM26
          </h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={activeTab === "matches" ? "default" : "outline"}
            onClick={() => setActiveTab("matches")}
            className="text-xs"
          >
            <Calendar className="w-3.5 h-3.5 mr-1" />
            Mecze ({matches.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
            className="text-xs"
          >
            <Users className="w-3.5 h-3.5 mr-1" />
            Użytkownicy ({users.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "audit" ? "default" : "outline"}
            onClick={() => setActiveTab("audit")}
            className="text-xs"
          >
            <Activity className="w-3.5 h-3.5 mr-1" />
            Audit Log
          </Button>
          <Button
            size="sm"
            variant={activeTab === "export" ? "default" : "outline"}
            onClick={() => setActiveTab("export")}
            className="text-xs"
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            Eksport
          </Button>
        </div>
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

      {/* TAB: MATCHES */}
      {activeTab === "matches" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white">Mecze i Wyniki Ligi</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Zarządzaj terminarzem, aktualizuj wyniki na żywo i finalizuj punkty.
              </p>
            </div>

            <Button
              onClick={() => {
                setShowCreateMatchModal(true);
                const now = new Date();
                now.setHours(now.getHours() + 2);
                setCreateMatchForm({
                  homeTeamId: teams[0]?.id || "",
                  awayTeamId: teams[1]?.id || "",
                  kickoffAt: now.toISOString().slice(0, 16),
                  stage: "league",
                  matchday: 1,
                });
              }}
              className="bg-blue-600 hover:bg-blue-500 text-xs w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Dodaj nowy mecz
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#101d36] text-xs font-semibold text-slate-400 border-b border-[#182645]">
                  <tr>
                    <th className="py-3 px-4">Data i faza</th>
                    <th className="py-3 px-4">Mecz</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Wynik</th>
                    <th className="py-3 px-4 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182645]/60">
                  {matches.map((m) => {
                    const kickoff = new Date(m.kickoffAt);
                    return (
                      <tr key={m.id} className="hover:bg-[#162444]/40 transition-colors">
                        {/* Date & Stage */}
                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          <div className="font-semibold text-white">
                            {kickoff.toLocaleDateString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {m.matchday ? `Kolejka ${m.matchday}` : m.stage}
                          </span>
                        </td>

                        {/* Teams */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{m.homeTeam.shortName}</span>
                            <span className="text-slate-500">vs</span>
                            <span className="font-bold text-white">{m.awayTeam.shortName}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {m.status === "live" ? (
                            <Badge variant="destructive" className="animate-pulse text-[10px]">
                              LIVE • {m.liveMinute}&apos;
                            </Badge>
                          ) : m.status === "finished" ? (
                            <Badge variant="secondary" className="text-[10px] bg-slate-800">
                              ZAKOŃCZONY
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {m.status.toUpperCase()}
                            </Badge>
                          )}
                        </td>

                        {/* Score */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-base">
                          {m.homeScore !== null && m.awayScore !== null ? (
                            <span className="text-white">
                              {m.homeScore} : {m.awayScore}
                            </span>
                          ) : (
                            <span className="text-slate-600">- : -</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Live score updater */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLiveMatchModal(m);
                                setLiveScoreForm({
                                  homeScore: m.homeScore ?? 0,
                                  awayScore: m.awayScore ?? 0,
                                  liveMinute: m.liveMinute ?? 1,
                                });
                              }}
                              className="h-8 px-2 text-xs border-red-500/40 text-red-300 hover:bg-red-950/40"
                              title="Ustaw / Zmień wynik LIVE"
                            >
                              <Flame className="w-3.5 h-3.5 mr-1 text-red-400" />
                              LIVE
                            </Button>

                            {/* Finalize button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFinalizeMatchModal(m);
                                setFinalizeScoreForm({
                                  homeScore: m.homeScore ?? 0,
                                  awayScore: m.awayScore ?? 0,
                                });
                              }}
                              className="h-8 px-2 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                              title="Zakończ mecz i przelicz punkty"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                              Zakończ
                            </Button>

                            {/* Edit match button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditMatchModal(m);
                                setEditMatchForm({
                                  homeTeamId: m.homeTeam.id,
                                  awayTeamId: m.awayTeam.id,
                                  kickoffAt: new Date(m.kickoffAt).toISOString().slice(0, 16),
                                  stage: m.stage,
                                  matchday: m.matchday || 1,
                                  status: m.status,
                                  homeScore: m.homeScore ?? 0,
                                  awayScore: m.awayScore ?? 0,
                                  liveMinute: m.liveMinute ?? 0,
                                  isBettingLocked: m.isBettingLocked,
                                });
                              }}
                              className="h-8 px-2 text-xs text-slate-300 hover:text-white"
                              title="Edytuj mecz"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB: USERS */}
      {activeTab === "users" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Input
                placeholder="Szukaj gracza..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#101d36] text-xs h-10"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <Button
              onClick={() => setShowCreateUserModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-xs w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Utwórz konto użytkownika
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#101d36] text-xs font-semibold text-slate-400 border-b border-[#182645]">
                <tr>
                  <th className="py-3 px-4">Użytkownik</th>
                  <th className="py-3 px-4">Rola</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182645]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#162444]/40">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 border border-blue-500/20">
                          {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                          <AvatarFallback className="bg-[#162444] text-xs text-blue-300 font-bold">
                            {u.first_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-white">{u.first_name} {u.last_name}</div>
                          <div className="text-xs text-slate-400">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <button onClick={() => handleToggleRole(u)} className="cursor-pointer">
                        {u.role === "admin" ? (
                          <Badge variant="default" className="gap-1">
                            <ShieldCheck className="w-3 h-3 text-blue-400" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs">
                          <UserCheck className="w-3.5 h-3.5" /> Aktywny
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 font-medium text-xs">
                          <UserX className="w-3.5 h-3.5" /> Zablokowany
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditUserModal(u);
                            setEditUserForm({
                              firstName: u.first_name,
                              lastName: u.last_name,
                              username: u.username,
                              isActive: u.is_active,
                            });
                          }}
                          className="h-8 px-2.5 text-xs text-slate-300"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edytuj
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResetPwdUser(u);
                            setTempPassword("");
                          }}
                          className="h-8 px-2.5 text-xs text-amber-400 border-amber-500/30"
                        >
                          <KeyRound className="w-3.5 h-3.5 mr-1" /> Hasło
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB: AUDIT LOGS */}
      {activeTab === "audit" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span>Dziennik Zdarzeń Bezpieczeństwa (Append-Only)</span>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={loadData} className="text-xs">
              Odśwież
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#101d36] font-semibold text-slate-400 border-b border-[#182645]">
                <tr>
                  <th className="py-3 px-4">Data i czas</th>
                  <th className="py-3 px-4">Akcja</th>
                  <th className="py-3 px-4">Dotyczy</th>
                  <th className="py-3 px-4">Szczegóły</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182645]/60 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#162444]/40">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.created_at).toLocaleString("pl-PL")}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <Badge variant="secondary">{log.action}</Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.target_type}: {log.target_id?.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB: EXPORT */}
      {activeTab === "export" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-xl flex flex-col gap-4">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>Kopia Zapasowa i Eksport Danych</span>
          </CardTitle>
          <p className="text-xs text-slate-400 max-w-lg">
            Generuje plik `.txt` w pamięci RAM funkcji serverless i natychmiast wysyła go do przeglądarki.
          </p>

          <Button asChild size="lg" className="w-fit bg-blue-600 hover:bg-blue-500 text-xs font-semibold mt-2">
            <a href="/api/export/ranking" download>
              Pobierz tabelę punktów (.txt)
            </a>
          </Button>
        </Card>
      )}

      {/* MODAL: CREATE MATCH */}
      {showCreateMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-[#0c1527] border-[#182645] p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Dodaj nowy mecz</CardTitle>
            <form onSubmit={handleCreateMatch} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Gospodarz</label>
                  <select
                    value={createMatchForm.homeTeamId}
                    onChange={(e) => setCreateMatchForm({ ...createMatchForm, homeTeamId: e.target.value })}
                    className="w-full h-10 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Gość</label>
                  <select
                    value={createMatchForm.awayTeamId}
                    onChange={(e) => setCreateMatchForm({ ...createMatchForm, awayTeamId: e.target.value })}
                    className="w-full h-10 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Data i godzina rozpoczęcia (kickoff)</label>
                <Input
                  required
                  type="datetime-local"
                  value={createMatchForm.kickoffAt}
                  onChange={(e) => setCreateMatchForm({ ...createMatchForm, kickoffAt: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Etap</label>
                  <select
                    value={createMatchForm.stage}
                    onChange={(e) => setCreateMatchForm({ ...createMatchForm, stage: e.target.value as MatchStage })}
                    className="w-full h-10 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                  >
                    <option value="league">Faza ligowa</option>
                    <option value="playoff">Play-off</option>
                    <option value="round_of_16">1/8 finału</option>
                    <option value="quarter_finals">Ćwierćfinał</option>
                    <option value="semi_finals">Półfinał</option>
                    <option value="final">Finał</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium">Kolejka (1–8)</label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={createMatchForm.matchday}
                    onChange={(e) => setCreateMatchForm({ ...createMatchForm, matchday: Number(e.target.value) })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateMatchModal(false)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  Utwórz mecz
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: LIVE SCORE UPDATE */}
      {liveMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-[#0c1527] border-red-500/40 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
              <Flame className="w-5 h-5" />
              <span>Wynik Na Żywo (LIVE)</span>
            </CardTitle>
            <p className="text-xs text-slate-300 mb-4">
              {liveMatchModal.homeTeam.name} vs {liveMatchModal.awayTeam.name}
            </p>

            <form onSubmit={handleUpdateLiveScore} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">{liveMatchModal.homeTeam.shortName} (Gole)</label>
                  <Input
                    required
                    type="number"
                    min="0"
                    max="99"
                    value={liveScoreForm.homeScore}
                    onChange={(e) => setLiveScoreForm({ ...liveScoreForm, homeScore: Number(e.target.value) })}
                    className="bg-[#101d36] text-lg font-black text-center mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">{liveMatchModal.awayTeam.shortName} (Gole)</label>
                  <Input
                    required
                    type="number"
                    min="0"
                    max="99"
                    value={liveScoreForm.awayScore}
                    onChange={(e) => setLiveScoreForm({ ...liveScoreForm, awayScore: Number(e.target.value) })}
                    className="bg-[#101d36] text-lg font-black text-center mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Minuta meczu (np. 63&apos;)</label>
                <Input
                  required
                  type="number"
                  min="0"
                  max="130"
                  value={liveScoreForm.liveMinute}
                  onChange={(e) => setLiveScoreForm({ ...liveScoreForm, liveMinute: Number(e.target.value) })}
                  className="bg-[#101d36] text-sm mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setLiveMatchModal(null)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-red-600 hover:bg-red-500">
                  Zapisz wynik LIVE
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: FINALIZE MATCH */}
      {finalizeMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-[#0c1527] border-emerald-500/40 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-emerald-400 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Zakończenie Mecz i Przeliczenie Punktów</span>
            </CardTitle>
            <p className="text-xs text-slate-300 mb-4">
              Wprowadź oficjalny końcowy wynik spotkania: <strong>{finalizeMatchModal.homeTeam.name} vs {finalizeMatchModal.awayTeam.name}</strong>.
            </p>

            <form onSubmit={handleFinalizeMatch} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">{finalizeMatchModal.homeTeam.shortName}</label>
                  <Input
                    required
                    type="number"
                    min="0"
                    max="99"
                    value={finalizeScoreForm.homeScore}
                    onChange={(e) => setFinalizeScoreForm({ ...finalizeScoreForm, homeScore: Number(e.target.value) })}
                    className="bg-[#101d36] text-xl font-black text-center mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">{finalizeMatchModal.awayTeam.shortName}</label>
                  <Input
                    required
                    type="number"
                    min="0"
                    max="99"
                    value={finalizeScoreForm.awayScore}
                    onChange={(e) => setFinalizeScoreForm({ ...finalizeScoreForm, awayScore: Number(e.target.value) })}
                    className="bg-[#101d36] text-xl font-black text-center mt-1"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-300">
                ℹ️ Punkty wszystkich graczy zostaną przeliczone w jednej transakcji PostgreSQL. W razie pomyłki wynik można w dowolnej chwili skorygować.
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setFinalizeMatchModal(null)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500">
                  Zatwierdź i przelicz punkty
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: EDIT MATCH DETAILS */}
      {editMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-[#0c1527] border-[#182645] p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Edycja szczegółów meczu</CardTitle>
            <form onSubmit={handleUpdateMatch} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Gospodarz</label>
                  <select
                    value={editMatchForm.homeTeamId}
                    onChange={(e) => setEditMatchForm({ ...editMatchForm, homeTeamId: e.target.value })}
                    className="w-full h-10 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Gość</label>
                  <select
                    value={editMatchForm.awayTeamId}
                    onChange={(e) => setEditMatchForm({ ...editMatchForm, awayTeamId: e.target.value })}
                    className="w-full h-10 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Kickoff</label>
                <Input
                  required
                  type="datetime-local"
                  value={editMatchForm.kickoffAt}
                  onChange={(e) => setEditMatchForm({ ...editMatchForm, kickoffAt: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Status</label>
                  <select
                    value={editMatchForm.status}
                    onChange={(e) => setEditMatchForm({ ...editMatchForm, status: e.target.value as MatchStatus })}
                    className="w-full h-10 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                  >
                    <option value="scheduled">scheduled (zaplanowany)</option>
                    <option value="live">live (na żywo)</option>
                    <option value="finished">finished (zakończony)</option>
                    <option value="postponed">postponed (przełożony)</option>
                    <option value="cancelled">cancelled (odwołany)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="lock-check"
                    type="checkbox"
                    checked={editMatchForm.isBettingLocked}
                    onChange={(e) => setEditMatchForm({ ...editMatchForm, isBettingLocked: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="lock-check" className="text-xs font-semibold text-white cursor-pointer">
                    Blokada typowania
                  </label>
                </div>
              </div>

              {editMatchForm.status === "postponed" && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs">
                  ⚠️ <strong>Uwaga:</strong> Jeżeli pierwotny kickoff meczu już minął i typy zostały odsłonięte, blokada typowania pozostaje aktywna, aby zapobiec nieuczciwej zmianie typów po poznaniu typów rywali.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditMatchModal(null)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  Zapisz zmiany
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* USER MODALS (CREATE, EDIT, RESET PASSWORD) */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-[#0c1527] border-[#182645] p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Utwórz konto użytkownika</CardTitle>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Imię</label>
                  <Input
                    required
                    value={createUserForm.firstName}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, firstName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Nazwisko</label>
                  <Input
                    required
                    value={createUserForm.lastName}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, lastName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Login (username)</label>
                <Input
                  required
                  placeholder="np. player1"
                  value={createUserForm.username}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Hasło startowe</label>
                <Input
                  required
                  type="password"
                  placeholder="Min. 8 znaków"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Rola</label>
                <select
                  value={createUserForm.role}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value as "user" | "admin" })}
                  className="w-full h-10 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                >
                  <option value="user">Zwykły użytkownik (user)</option>
                  <option value="admin">Administrator (admin)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateUserModal(false)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  Utwórz konto
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-[#0c1527] border-[#182645] p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Edycja użytkownika @{editUserModal.username}</CardTitle>
            <form onSubmit={handleUpdateUser} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Imię</label>
                  <Input
                    required
                    value={editUserForm.firstName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, firstName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Nazwisko</label>
                  <Input
                    required
                    value={editUserForm.lastName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, lastName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Login (username)</label>
                <Input
                  required
                  value={editUserForm.username}
                  onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#101d36] border border-[#182645]">
                <input
                  id="active-check"
                  type="checkbox"
                  checked={editUserForm.isActive}
                  onChange={(e) => setEditUserForm({ ...editUserForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                />
                <label htmlFor="active-check" className="text-xs font-semibold text-white cursor-pointer">
                  Konto aktywne (odznaczenie natychmiast wyklucza z typowania i blokuje sesję)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditUserModal(null)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  Zapisz zmiany
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-[#0c1527] border-[#182645] p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-2">Reset hasła dla @{resetPwdUser.username}</CardTitle>
            <p className="text-xs text-slate-400 mb-4">
              Ustaw nowe hasło tymczasowe dla tego użytkownika. Hasło zostanie zaszyfrowane w Supabase Auth.
            </p>
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-300 font-medium">Nowe hasło tymczasowe</label>
                <Input
                  required
                  type="password"
                  placeholder="Min. 8 znaków"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setResetPwdUser(null)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending || !tempPassword} className="bg-amber-600 hover:bg-amber-500">
                  Ustaw nowe hasło
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
