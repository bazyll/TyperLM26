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
  Star,
  Trophy,
  Bell,
  Pin,
  Trash2,
  Download,
  UserPlus,
  Sparkles,
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
import {
  getSpecialCategoriesWithPredictionsAction,
  adminUpdateSpecialDeadlineAction,
  adminSettleSpecialCategoryAction,
} from "@/lib/specials/actions";
import {
  getPickemDataAction,
  adminUpdatePickemDeadlineAction,
  adminSettlePickemAction,
} from "@/lib/pickem/actions";
import {
  getAnnouncementsAction,
  adminCreateAnnouncementAction,
  adminUpdateAnnouncementAction,
  adminDeleteAnnouncementAction,
  adminTogglePinAnnouncementAction,
} from "@/lib/announcements/actions";
import {
  getAllPlayersAction,
  adminCreatePlayerAction,
  adminUpdatePlayerAction,
  adminTogglePlayerActiveAction,
} from "@/lib/players/actions";
import { Database, MatchStage, MatchStatus } from "@/types/database.types";
import { MatchWithTeams, SpecialCategoryWithPrediction, AnnouncementItem } from "@/types";
import { TeamLogo } from "@/components/team-logo";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type ConfigRow = Database["public"]["Tables"]["pickem_config"]["Row"];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    "matches" | "teams" | "players" | "users" | "specials" | "pickem" | "announcements" | "audit" | "export"
  >("matches");

  // Data states
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [specialCategories, setSpecialCategories] = useState<SpecialCategoryWithPrediction[]>([]);
  const [pickemConfig, setPickemConfig] = useState<ConfigRow | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
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

  // Players Modal state
  const [showCreatePlayerModal, setShowCreatePlayerModal] = useState(false);
  const [editPlayerModal, setEditPlayerModal] = useState<PlayerRow | null>(null);
  const [playerForm, setPlayerForm] = useState({ name: "", teamId: "", isActive: true });

  // Special Predictions Modal state
  const [settleSpecialModal, setSettleSpecialModal] = useState<SpecialCategoryWithPrediction | null>(null);
  const [editSpecialDeadlineModal, setEditSpecialDeadlineModal] = useState<SpecialCategoryWithPrediction | null>(null);
  const [selectedWinningTeamIds, setSelectedWinningTeamIds] = useState<string[]>([]);
  const [selectedWinningPlayerIds, setSelectedWinningPlayerIds] = useState<string[]>([]);
  const [specialDeadlineInput, setSpecialDeadlineInput] = useState("");

  // Pick'em State
  const [editPickemDeadlineModal, setEditPickemDeadlineModal] = useState(false);
  const [pickemDeadlineInput, setPickemDeadlineInput] = useState("");

  // Announcements Modal state
  const [showCreateAnnouncementModal, setShowCreateAnnouncementModal] = useState(false);
  const [editAnnouncementModal, setEditAnnouncementModal] = useState<AnnouncementItem | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", content: "", isPinned: false });

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, mList, tList, pList, specList, pickData, annList, logs] = await Promise.all([
        adminGetUsersListAction(),
        getMatchesWithPredictionsAction(),
        getAllTeamsAction(),
        getAllPlayersAction(true),
        getSpecialCategoriesWithPredictionsAction(),
        getPickemDataAction(),
        getAnnouncementsAction(),
        adminGetAuditLogsAction(),
      ]);

      setUsers(uList);
      setMatches(mList);
      setTeams(tList);
      setPlayers(pList);
      setSpecialCategories(specList);
      setPickemConfig(pickData.config);
      setAnnouncements(annList);
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

  // Handlers - Users
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    startTransition(async () => {
      const res = await adminCreateUserAction(createUserForm);
      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas tworzenia konta." });
      } else {
        setStatusMessage({ type: "success", text: `Konto @${createUserForm.username} zostało utworzone!` });
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
        setStatusMessage({ type: "error", text: res.error || "Błąd aktualizacji użytkownika." });
      } else {
        setStatusMessage({ type: "success", text: "Dane użytkownika zostały zaktualizowane!" });
        setEditUserModal(null);
        loadData();
      }
    });
  };

  const handleToggleRole = (user: ProfileRow) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    startTransition(async () => {
      const res = await adminToggleRoleAction(user.id, nextRole);
      if (res.success) {
        setStatusMessage({ type: "success", text: `Zmieniono rolę @${user.username} na ${nextRole}.` });
        loadData();
      }
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUser) return;
    startTransition(async () => {
      const res = await adminResetPasswordAction(resetPwdUser.id, tempPassword);
      if (res.success) {
        setStatusMessage({ type: "success", text: `Hasło dla @${resetPwdUser.username} zostało zaktualizowane!` });
        setResetPwdUser(null);
        setTempPassword("");
        loadData();
      }
    });
  };

  // Handlers - Matches
  const handleCreateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminCreateMatchAction({
        homeTeamId: createMatchForm.homeTeamId,
        awayTeamId: createMatchForm.awayTeamId,
        kickoffAt: new Date(createMatchForm.kickoffAt).toISOString(),
        stage: createMatchForm.stage,
        matchday: Number(createMatchForm.matchday),
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: "Mecz został dodany do terminarza!" });
        setShowCreateMatchModal(false);
        loadData();
      } else {
        setStatusMessage({ type: "error", text: res.error || "Błąd dodawania meczu." });
      }
    });
  };

  const handleUpdateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMatchModal) return;
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
      if (res.success) {
        setStatusMessage({ type: "success", text: "Dane meczu zaktualizowane!" });
        setEditMatchModal(null);
        loadData();
      }
    });
  };

  const handleUpdateLiveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMatchModal) return;
    startTransition(async () => {
      const res = await adminUpdateLiveScoreAction({
        matchId: liveMatchModal.id,
        homeScore: Number(liveScoreForm.homeScore),
        awayScore: Number(liveScoreForm.awayScore),
        liveMinute: Number(liveScoreForm.liveMinute),
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: "Wynik LIVE zaktualizowany!" });
        setLiveMatchModal(null);
        loadData();
      }
    });
  };

  const handleFinalizeMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalizeMatchModal) return;
    startTransition(async () => {
      const res = await adminFinalizeMatchAction({
        matchId: finalizeMatchModal.id,
        homeScore: Number(finalizeScoreForm.homeScore),
        awayScore: Number(finalizeScoreForm.awayScore),
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: "Mecz sfinalizowany, a punkty przeliczone atomowo!" });
        setFinalizeMatchModal(null);
        loadData();
      }
    });
  };

  // Handlers - Players
  const handleCreatePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminCreatePlayerAction({
        name: playerForm.name,
        teamId: playerForm.teamId,
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: `Zawodnik ${playerForm.name} dodany!` });
        setShowCreatePlayerModal(false);
        setPlayerForm({ name: "", teamId: teams[0]?.id || "", isActive: true });
        loadData();
      }
    });
  };

  const handleUpdatePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPlayerModal) return;
    startTransition(async () => {
      const res = await adminUpdatePlayerAction({
        id: editPlayerModal.id,
        name: playerForm.name,
        teamId: playerForm.teamId,
        isActive: playerForm.isActive,
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: `Zawodnik ${playerForm.name} zaktualizowany!` });
        setEditPlayerModal(null);
        loadData();
      }
    });
  };

  const handleTogglePlayerActive = (p: PlayerRow) => {
    startTransition(async () => {
      const res = await adminTogglePlayerActiveAction(p.id, !p.is_active);
      if (res.success) {
        setStatusMessage({ type: "success", text: `Zmieniono status zawodnika ${p.name}.` });
        loadData();
      }
    });
  };

  // Handlers - Specials
  const handleSettleSpecial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleSpecialModal) return;
    startTransition(async () => {
      const res = await adminSettleSpecialCategoryAction({
        categoryId: settleSpecialModal.id,
        correctTeamIds: selectedWinningTeamIds,
        correctPlayerIds: selectedWinningPlayerIds,
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: `Kategoria "${settleSpecialModal.title}" rozliczona pomyślnie!` });
        setSettleSpecialModal(null);
        setSelectedWinningTeamIds([]);
        setSelectedWinningPlayerIds([]);
        loadData();
      } else {
        setStatusMessage({ type: "error", text: res.error || "Błąd rozliczania kategorii." });
      }
    });
  };

  const handleUpdateSpecialDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSpecialDeadlineModal) return;
    startTransition(async () => {
      const res = await adminUpdateSpecialDeadlineAction({
        categoryId: editSpecialDeadlineModal.id,
        deadlineAt: new Date(specialDeadlineInput).toISOString(),
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: "Deadline kategorii zaktualizowany!" });
        setEditSpecialDeadlineModal(null);
        loadData();
      } else {
        setStatusMessage({ type: "error", text: res.error || "Błąd aktualizacji deadline'u." });
      }
    });
  };

  // Handlers - Pick'em
  const handleSettlePickem = () => {
    if (!confirm("Czy na pewno chcesz rozliczyć Pick'em na podstawie zakończonej tabeli fazy ligowej?")) return;
    startTransition(async () => {
      const res = await adminSettlePickemAction();
      if (res.success) {
        setStatusMessage({ type: "success", text: "Pick'em fazy ligowej został pomyślnie rozliczony!" });
        loadData();
      } else {
        setStatusMessage({ type: "error", text: res.error || "Błąd rozliczania Pick'em." });
      }
    });
  };

  const handleUpdatePickemDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminUpdatePickemDeadlineAction({
        deadlineAt: new Date(pickemDeadlineInput).toISOString(),
      });
      if (res.success) {
        setStatusMessage({ type: "success", text: "Deadline Pick'em zaktualizowany!" });
        setEditPickemDeadlineModal(false);
        loadData();
      } else {
        setStatusMessage({ type: "error", text: res.error || "Błąd aktualizacji deadline'u." });
      }
    });
  };

  // Handlers - Announcements
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await adminCreateAnnouncementAction(announcementForm);
        if (res.success) {
          setStatusMessage({ type: "success", text: "Ogłoszenie opublikowane!" });
          setShowCreateAnnouncementModal(false);
          setAnnouncementForm({ title: "", content: "", isPinned: false });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd dodawania ogłoszenia." });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Błąd dodawania ogłoszenia.",
        });
      }
    });
  };

  const handleUpdateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAnnouncementModal) return;
    startTransition(async () => {
      try {
        const res = await adminUpdateAnnouncementAction({
          id: editAnnouncementModal.id,
          title: announcementForm.title,
          content: announcementForm.content,
          isPinned: announcementForm.isPinned,
        });
        if (res.success) {
          setStatusMessage({ type: "success", text: "Ogłoszenie zaktualizowane!" });
          setEditAnnouncementModal(null);
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd edycji ogłoszenia." });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Błąd edycji ogłoszenia.",
        });
      }
    });
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to ogłoszenie?")) return;
    startTransition(async () => {
      try {
        const res = await adminDeleteAnnouncementAction(id);
        if (res.success) {
          setStatusMessage({ type: "success", text: "Ogłoszenie usunięte." });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd usuwania ogłoszenia." });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Błąd usuwania ogłoszenia.",
        });
      }
    });
  };

  const handleTogglePinAnnouncement = (id: string, currentPinned: boolean) => {
    startTransition(async () => {
      try {
        const res = await adminTogglePinAnnouncementAction(id, !currentPinned);
        if (res.success) {
          setStatusMessage({
            type: "success",
            text: !currentPinned ? "Ogłoszenie przypięte!" : "Ogłoszenie odpięte.",
          });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd zmiany przypięcia." });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Błąd zmiany przypięcia.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <Shield className="w-3.5 h-3.5" />
            Centrum Zarządzania
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Panel Administratora TyperLM26
          </h1>
        </div>

        {/* 9 Section Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 max-w-full">
          <Button size="sm" variant={activeTab === "matches" ? "default" : "outline"} onClick={() => setActiveTab("matches")} className="text-xs">
            <Calendar className="w-3.5 h-3.5 mr-1" /> Mecze ({matches.length})
          </Button>
          <Button size="sm" variant={activeTab === "players" ? "default" : "outline"} onClick={() => setActiveTab("players")} className="text-xs">
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Zawodnicy ({players.length})
          </Button>
          <Button size="sm" variant={activeTab === "specials" ? "default" : "outline"} onClick={() => setActiveTab("specials")} className="text-xs">
            <Star className="w-3.5 h-3.5 mr-1" /> Typy Specjalne
          </Button>
          <Button size="sm" variant={activeTab === "pickem" ? "default" : "outline"} onClick={() => setActiveTab("pickem")} className="text-xs">
            <Trophy className="w-3.5 h-3.5 mr-1" /> Pick&apos;em
          </Button>
          <Button size="sm" variant={activeTab === "announcements" ? "default" : "outline"} onClick={() => setActiveTab("announcements")} className="text-xs">
            <Bell className="w-3.5 h-3.5 mr-1" /> Ogłoszenia ({announcements.length})
          </Button>
          <Button size="sm" variant={activeTab === "users" ? "default" : "outline"} onClick={() => setActiveTab("users")} className="text-xs">
            <Users className="w-3.5 h-3.5 mr-1" /> Użytkownicy ({users.length})
          </Button>
          <Button size="sm" variant={activeTab === "audit" ? "default" : "outline"} onClick={() => setActiveTab("audit")} className="text-xs">
            <Activity className="w-3.5 h-3.5 mr-1" /> Audit Log
          </Button>
          <Button size="sm" variant={activeTab === "export" ? "default" : "outline"} onClick={() => setActiveTab("export")} className="text-xs">
            <FileText className="w-3.5 h-3.5 mr-1" /> Backup / Export
          </Button>
        </div>
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2.5 p-4 rounded-2xl text-xs font-medium border ${
            statusMessage.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/50 border-red-500/30 text-red-300"
          }`}
        >
          {statusMessage.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TAB: MATCHES */}
      {activeTab === "matches" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white">Mecze i Wyniki</CardTitle>
              <p className="text-xs text-slate-400">Dodawaj spotkania, aktualizuj wyniki na żywo i finalizuj punkty.</p>
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
              className="bg-blue-600 hover:bg-blue-500 text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Dodaj nowy mecz
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Mecz</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Wynik</th>
                  <th className="py-3 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {matches.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-xs text-slate-300">
                      <div className="font-semibold text-white">
                        {new Date(m.kickoffAt).toLocaleDateString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <span className="text-[10px] text-slate-500">{m.matchday ? `Kolejka ${m.matchday}` : m.stage}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {m.homeTeam.shortName} vs {m.awayTeam.shortName}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {m.status === "live" ? (
                        <Badge variant="destructive" className="animate-pulse text-[10px]">LIVE • {m.liveMinute}&apos;</Badge>
                      ) : m.status === "finished" ? (
                        <Badge variant="secondary" className="text-[10px]">ZAKOŃCZONY</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{m.status.toUpperCase()}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-base">
                      {m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} : ${m.awayScore}` : "- : -"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLiveMatchModal(m);
                            setLiveScoreForm({ homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0, liveMinute: m.liveMinute ?? 1 });
                          }}
                          className="h-8 px-2 text-xs border-red-500/40 text-red-300 hover:bg-red-950/40"
                        >
                          <Flame className="w-3.5 h-3.5 mr-1 text-red-400" /> LIVE
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFinalizeMatchModal(m);
                            setFinalizeScoreForm({ homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0 });
                          }}
                          className="h-8 px-2 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Zakończ
                        </Button>
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
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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

      {/* TAB: PLAYERS */}
      {activeTab === "players" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white">Zawodnicy (Król Strzelców / Asyst)</CardTitle>
              <p className="text-xs text-slate-400">Zarządzaj kontrolowaną listą piłkarzy dla typów specjalnych.</p>
            </div>
            <Button
              onClick={() => {
                setShowCreatePlayerModal(true);
                setPlayerForm({ name: "", teamId: teams[0]?.id || "", isActive: true });
              }}
              className="bg-blue-600 hover:bg-blue-500 text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Dodaj zawodnika
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Imię i Nazwisko</th>
                  <th className="py-3 px-4">Klub</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {players.map((p) => {
                  const t = teams.find((x) => x.id === p.team_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                      <td className="py-3 px-4 text-slate-300">{t?.name || "Brak"}</td>
                      <td className="py-3 px-4 text-center">
                        {p.is_active ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]">Aktywny</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Wyłączony</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTogglePlayerActive(p)}
                            className="h-8 px-2.5 text-xs text-slate-300"
                          >
                            {p.is_active ? "Dezaktywuj" : "Aktywuj"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditPlayerModal(p);
                              setPlayerForm({ name: p.name, teamId: p.team_id, isActive: p.is_active });
                            }}
                            className="h-8 px-2 text-xs text-slate-300 hover:text-white"
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
        </Card>
      )}

      {/* TAB: SPECIALS */}
      {activeTab === "specials" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white">Rozliczanie Typów Specjalnych</CardTitle>
              <p className="text-xs text-slate-400">
                Wskaż zwycięzcę (lub wielu zwycięzców w przypadku remisów) i rozlicz kategorie.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specialCategories.map((cat) => {
              const isPassed = new Date(cat.deadlineAt).getTime() <= Date.now() || cat.isLocked;

              return (
                <div key={cat.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-base">{cat.title}</span>
                      <Badge className={cat.status === "settled" ? "bg-purple-500/20 text-purple-300" : isPassed ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}>
                        {cat.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{cat.description}</p>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Deadline: {new Date(cat.deadlineAt).toLocaleString("pl-PL")}</span>
                    </div>

                    {cat.correctAnswers && cat.correctAnswers.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs">
                        <span className="font-bold text-emerald-400 uppercase tracking-wider block mb-1">Poprawny wynik:</span>
                        <div className="flex flex-col gap-0.5">
                          {cat.correctAnswers.map((ans, idx) => (
                            <span key={idx} className="font-semibold text-emerald-200">
                              • {ans.teamName || ans.playerName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    {!isPassed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditSpecialDeadlineModal(cat);
                          setSpecialDeadlineInput(new Date(cat.deadlineAt).toISOString().slice(0, 16));
                        }}
                        className="text-xs text-slate-300"
                      >
                        Zmień deadline
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        setSettleSpecialModal(cat);
                        setSelectedWinningTeamIds(cat.correctAnswers?.map((a) => a.teamId!).filter(Boolean) || []);
                        setSelectedWinningPlayerIds(cat.correctAnswers?.map((a) => a.playerId!).filter(Boolean) || []);
                      }}
                      className="bg-purple-600 hover:bg-purple-500 text-xs font-bold"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      {cat.status === "settled" ? "Popraw rozliczenie" : "Rozlicz kategorię"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB: PICK'EM */}
      {activeTab === "pickem" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white">Rozliczanie Pick&apos;em Fazy Ligowej</CardTitle>
              <p className="text-xs text-slate-400">
                Po zakończeniu wszystkich 144 meczów fazy ligowej rozlicz typy na podstawie końcowej tabeli UEFA.
              </p>
            </div>
            {pickemConfig && !pickemConfig.is_locked && new Date(pickemConfig.deadline_at).getTime() > Date.now() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditPickemDeadlineModal(true);
                  setPickemDeadlineInput(new Date(pickemConfig.deadline_at).toISOString().slice(0, 16));
                }}
                className="text-xs"
              >
                Zmień deadline Pick&apos;em
              </Button>
            )}
          </div>

          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Pick&apos;em:</span>
              <div className="text-lg font-extrabold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>{pickemConfig?.status === "settled" ? "Rozliczone (Wyniki zatwierdzone)" : "Otwarte / Oczekujące na zakończenie fazy ligowej"}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Deadline: {pickemConfig ? new Date(pickemConfig.deadline_at).toLocaleString("pl-PL") : "Brak"}
              </p>
            </div>

            <Button
              onClick={handleSettlePickem}
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-extrabold px-6 py-3"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              {pickemConfig?.status === "settled" ? "Przelicz ponownie Pick'em" : "Rozlicz Pick'em"}
            </Button>
          </div>
        </Card>
      )}

      {/* TAB: ANNOUNCEMENTS */}
      {activeTab === "announcements" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-white">Komunikaty i Ogłoszenia</CardTitle>
              <p className="text-xs text-slate-400">Publikuj komunikaty dla graczy i zarządzaj wpisami.</p>
            </div>
            <Button
              onClick={() => {
                setShowCreateAnnouncementModal(true);
                setAnnouncementForm({ title: "", content: "", isPinned: false });
              }}
              className="bg-blue-600 hover:bg-blue-500 text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nowe ogłoszenie
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{ann.title}</span>
                    {ann.isPinned && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[10px] text-blue-300 font-bold flex items-center gap-1">
                        <Pin className="w-2.5 h-2.5" /> Przypięte
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTogglePinAnnouncement(ann.id, ann.isPinned)}
                      className={`h-8 px-2 text-xs transition-colors ${
                        ann.isPinned ? "text-blue-400 hover:text-slate-300" : "text-slate-400 hover:text-blue-400"
                      }`}
                      title={ann.isPinned ? "Odepnij ogłoszenie" : "Przypnij ogłoszenie"}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditAnnouncementModal(ann);
                        setAnnouncementForm({ title: ann.title, content: ann.content, isPinned: ann.isPinned });
                      }}
                      className="h-8 px-2 text-xs text-slate-400 hover:text-white"
                      title="Edytuj"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="h-8 px-2 text-xs text-slate-400 hover:text-rose-400"
                      title="Usuń"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                  Opublikowano: {new Date(ann.createdAt).toLocaleString("pl-PL")}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB: USERS */}
      {activeTab === "users" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Input
                placeholder="Szukaj gracza..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-950 text-xs h-10"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <Button onClick={() => setShowCreateUserModal(true)} className="bg-blue-600 hover:bg-blue-500 text-xs w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-1.5" /> Utwórz konto użytkownika
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Użytkownik</th>
                  <th className="py-3 px-4">Rola</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {u.first_name} {u.last_name} (@{u.username})
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        aria-label={`Zmień rolę dla @${u.username}`}
                        onClick={() => handleToggleRole(u)}
                        className="cursor-pointer"
                      >
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role === "admin" ? "Admin" : "User"}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.is_active ? (
                        <span className="text-emerald-400 font-medium text-xs">Aktywny</span>
                      ) : (
                        <span className="text-red-400 font-medium text-xs">Zablokowany</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditUserModal(u);
                            setEditUserForm({ firstName: u.first_name, lastName: u.last_name, username: u.username, isActive: u.is_active });
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

      {/* TAB: AUDIT LOG */}
      {activeTab === "audit" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col gap-4">
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
              <thead className="bg-slate-950 font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data i czas</th>
                  <th className="py-3 px-4">Akcja</th>
                  <th className="py-3 px-4">Dotyczy</th>
                  <th className="py-3 px-4">Szczegóły</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
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

      {/* TAB: BACKUP / EXPORT */}
      {activeTab === "export" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div>
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span>Kopia Zapasowa i Eksport Danych</span>
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              Pobieraj migawki rankingu oraz kompletny snapshot bazy danych generowany w pamięci RAM bez zapisu na dysku serwera.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* TXT Ranking */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Tabela punktów (.txt)</h3>
                <p className="text-xs text-slate-400">
                  Przejrzyste tekstowe zestawienie z podziałem na punkty meczowe, typy specjalne i Pick&apos;em.
                </p>
              </div>
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold">
                <a href="/api/export/ranking?format=txt" download>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Pobierz TXT
                </a>
              </Button>
            </div>

            {/* CSV Ranking */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Arkusz kalkulacyjny (.csv)</h3>
                <p className="text-xs text-slate-400">
                  Format CSV z zabezpieczeniem przed CSV Formula Injection, gotowy do otwarcia w Excelu.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="text-xs font-semibold text-slate-200">
                <a href="/api/export/ranking?format=csv" download>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Pobierz CSV
                </a>
              </Button>
            </div>

            {/* JSON Backup */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Snapshot Bazy (.json)</h3>
                <p className="text-xs text-slate-400">
                  Wersjonowany zrzut danych domenowych (mecze, typy, pick&apos;em, ogłoszenia) bez sekretów i haseł.
                </p>
              </div>
              <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-500 text-xs font-semibold">
                <a href="/api/export/backup" download>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Pobierz JSON Backup
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* MODAL: SETTLE SPECIAL PREDICTION CATEGORY (Multiple Winners Support) */}
      {settleSpecialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-purple-500/40 p-6 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]">
            <CardTitle className="text-lg font-bold text-purple-400 mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span>Rozlicz kategorię: {settleSpecialModal.title}</span>
            </CardTitle>
            <p className="text-xs text-slate-400 mb-4">
              Zaznacz prawidłową odpowiedź (w przypadku remisu możesz zaznaczyć więcej niż jedną pozycję).
            </p>

            <form onSubmit={handleSettleSpecial} className="flex flex-col gap-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[45vh]">
                {settleSpecialModal.targetType === "team" ? (
                  teams.map((t) => {
                    const isChecked = selectedWinningTeamIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedWinningTeamIds((prev) =>
                            isChecked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left cursor-pointer ${
                          isChecked ? "bg-purple-600 text-white font-bold" : "bg-slate-950 hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                            <TeamLogo
                              logoUrl={t.logo_url}
                              teamName={t.name}
                              teamCode={t.code}
                              size={20}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span>{t.name}</span>
                        </div>
                        {isChecked && <CheckCircle2 className="w-5 h-5 text-white" />}
                      </button>
                    );
                  })
                ) : (
                  players.map((p) => {
                    const isChecked = selectedWinningPlayerIds.includes(p.id);
                    const pTeam = teams.find((t) => t.id === p.team_id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedWinningPlayerIds((prev) =>
                            isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left cursor-pointer ${
                          isChecked ? "bg-purple-600 text-white font-bold" : "bg-slate-950 hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        <div>
                          <span>{p.name}</span>
                          {pTeam && <span className="text-[10px] text-slate-400 block">{pTeam.name}</span>}
                        </div>
                        {isChecked && <CheckCircle2 className="w-5 h-5 text-white" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setSettleSpecialModal(null)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-purple-600 hover:bg-purple-500 font-bold">
                  Zatwierdź i przelicz punkty
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: EDIT SPECIAL DEADLINE */}
      {editSpecialDeadlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-2">Zmień deadline kategorii</CardTitle>
            <form onSubmit={handleUpdateSpecialDeadline} className="flex flex-col gap-4">
              <Input
                required
                type="datetime-local"
                value={specialDeadlineInput}
                onChange={(e) => setSpecialDeadlineInput(e.target.value)}
                className="bg-slate-950 text-xs"
              />
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditSpecialDeadlineModal(null)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  Zapisz
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: EDIT PICKEM DEADLINE */}
      {editPickemDeadlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-2">Zmień deadline Pick&apos;em</CardTitle>
            <form onSubmit={handleUpdatePickemDeadline} className="flex flex-col gap-4">
              <Input
                required
                type="datetime-local"
                value={pickemDeadlineInput}
                onChange={(e) => setPickemDeadlineInput(e.target.value)}
                className="bg-slate-950 text-xs"
              />
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditPickemDeadlineModal(false)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  Zapisz
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ANNOUNCEMENT */}
      {(showCreateAnnouncementModal || editAnnouncementModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">
              {editAnnouncementModal ? "Edytuj ogłoszenie" : "Nowe ogłoszenie"}
            </CardTitle>
            <form onSubmit={editAnnouncementModal ? handleUpdateAnnouncement : handleCreateAnnouncement} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-300 font-medium">Tytuł (maks. 120 znaków)</label>
                <Input
                  required
                  maxLength={120}
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="bg-slate-950 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Treść (maks. 5000 znaków)</label>
                <textarea
                  required
                  maxLength={5000}
                  rows={5}
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                  className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="pin-check"
                  type="checkbox"
                  checked={announcementForm.isPinned}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                />
                <label htmlFor="pin-check" className="text-xs font-semibold text-white cursor-pointer">
                  Przypnij ogłoszenie na samej górze feedu
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateAnnouncementModal(false);
                    setEditAnnouncementModal(null);
                  }}
                >
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  {editAnnouncementModal ? "Zapisz zmiany" : "Opublikuj ogłoszenie"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: CREATE / EDIT PLAYER */}
      {(showCreatePlayerModal || editPlayerModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">
              {editPlayerModal ? "Edytuj zawodnika" : "Dodaj nowego zawodnika"}
            </CardTitle>
            <form onSubmit={editPlayerModal ? handleUpdatePlayer : handleCreatePlayer} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-300 font-medium">Imię i Nazwisko</label>
                <Input
                  required
                  value={playerForm.name}
                  onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                  className="bg-slate-950 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Klub</label>
                <select
                  value={playerForm.teamId}
                  onChange={(e) => setPlayerForm({ ...playerForm, teamId: e.target.value })}
                  className="w-full h-10 mt-1 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-white"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {editPlayerModal && (
                <div className="flex items-center gap-2">
                  <input
                    id="player-active-check"
                    type="checkbox"
                    checked={playerForm.isActive}
                    onChange={(e) => setPlayerForm({ ...playerForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="player-active-check" className="text-xs font-semibold text-white cursor-pointer">
                    Zawodnik aktywny (dostępny na listach wyboru)
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreatePlayerModal(false);
                    setEditPlayerModal(null);
                  }}
                >
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">
                  {editPlayerModal ? "Zapisz zmiany" : "Dodaj zawodnika"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: LIVE SCORE / FINALIZE / MATCH EDIT / USER EDIT / PASSWORD MODALS REMAIN FUNCTIONAL */}
      {liveMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-red-500/40 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
              <Flame className="w-5 h-5" /> <span>Wynik Na Żywo (LIVE)</span>
            </CardTitle>
            <p className="text-xs text-slate-300 mb-4">{liveMatchModal.homeTeam.name} vs {liveMatchModal.awayTeam.name}</p>
            <form onSubmit={handleUpdateLiveScore} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300">{liveMatchModal.homeTeam.shortName}</label>
                  <Input required type="number" min="0" max="99" value={liveScoreForm.homeScore} onChange={(e) => setLiveScoreForm({ ...liveScoreForm, homeScore: Number(e.target.value) })} className="bg-slate-950 text-center font-bold" />
                </div>
                <div>
                  <label className="text-xs text-slate-300">{liveMatchModal.awayTeam.shortName}</label>
                  <Input required type="number" min="0" max="99" value={liveScoreForm.awayScore} onChange={(e) => setLiveScoreForm({ ...liveScoreForm, awayScore: Number(e.target.value) })} className="bg-slate-950 text-center font-bold" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-300">Minuta meczu</label>
                <Input required type="number" min="0" max="130" value={liveScoreForm.liveMinute} onChange={(e) => setLiveScoreForm({ ...liveScoreForm, liveMinute: Number(e.target.value) })} className="bg-slate-950 text-xs" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setLiveMatchModal(null)}>Anuluj</Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-red-600 hover:bg-red-500">Zapisz LIVE</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {finalizeMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-emerald-500/40 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-emerald-400 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> <span>Finalizacja Mecz</span>
            </CardTitle>
            <form onSubmit={handleFinalizeMatch} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300">{finalizeMatchModal.homeTeam.shortName}</label>
                  <Input required type="number" min="0" max="99" value={finalizeScoreForm.homeScore} onChange={(e) => setFinalizeScoreForm({ ...finalizeScoreForm, homeScore: Number(e.target.value) })} className="bg-slate-950 text-center font-bold text-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-300">{finalizeMatchModal.awayTeam.shortName}</label>
                  <Input required type="number" min="0" max="99" value={finalizeScoreForm.awayScore} onChange={(e) => setFinalizeScoreForm({ ...finalizeScoreForm, awayScore: Number(e.target.value) })} className="bg-slate-950 text-center font-bold text-lg" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setFinalizeMatchModal(null)}>Anuluj</Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500">Zakończ i przelicz</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {editMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Edycja meczu</CardTitle>
            <form onSubmit={handleUpdateMatch} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300">Gospodarz</label>
                  <select value={editMatchForm.homeTeamId} onChange={(e) => setEditMatchForm({ ...editMatchForm, homeTeamId: e.target.value })} className="w-full h-10 rounded-xl bg-slate-950 text-xs text-white">
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Gość</label>
                  <select value={editMatchForm.awayTeamId} onChange={(e) => setEditMatchForm({ ...editMatchForm, awayTeamId: e.target.value })} className="w-full h-10 rounded-xl bg-slate-950 text-xs text-white">
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-300">Kickoff</label>
                <Input required type="datetime-local" value={editMatchForm.kickoffAt} onChange={(e) => setEditMatchForm({ ...editMatchForm, kickoffAt: e.target.value })} className="bg-slate-950 text-xs" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditMatchModal(null)}>Anuluj</Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">Zapisz</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {showCreateMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Dodaj mecz</CardTitle>
            <form onSubmit={handleCreateMatch} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300">Gospodarz</label>
                  <select value={createMatchForm.homeTeamId} onChange={(e) => setCreateMatchForm({ ...createMatchForm, homeTeamId: e.target.value })} className="w-full h-10 rounded-xl bg-slate-950 text-xs text-white">
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Gość</label>
                  <select value={createMatchForm.awayTeamId} onChange={(e) => setCreateMatchForm({ ...createMatchForm, awayTeamId: e.target.value })} className="w-full h-10 rounded-xl bg-slate-950 text-xs text-white">
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-300">Kickoff</label>
                <Input required type="datetime-local" value={createMatchForm.kickoffAt} onChange={(e) => setCreateMatchForm({ ...createMatchForm, kickoffAt: e.target.value })} className="bg-slate-950 text-xs" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateMatchModal(false)}>Anuluj</Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">Dodaj mecz</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Utwórz użytkownika</CardTitle>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input required placeholder="Imię" value={createUserForm.firstName} onChange={(e) => setCreateUserForm({ ...createUserForm, firstName: e.target.value })} className="bg-slate-950 text-xs" />
                <Input required placeholder="Nazwisko" value={createUserForm.lastName} onChange={(e) => setCreateUserForm({ ...createUserForm, lastName: e.target.value })} className="bg-slate-950 text-xs" />
              </div>
              <Input required placeholder="Login (username)" value={createUserForm.username} onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })} className="bg-slate-950 text-xs" />
              <Input required type="password" placeholder="Hasło (min. 8 znaków)" value={createUserForm.password} onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })} className="bg-slate-950 text-xs" />
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateUserModal(false)}>Anuluj</Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">Utwórz</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {editUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Edytuj @{editUserModal.username}</CardTitle>
            <form onSubmit={handleUpdateUser} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input required value={editUserForm.firstName} onChange={(e) => setEditUserForm({ ...editUserForm, firstName: e.target.value })} className="bg-slate-950 text-xs" />
                <Input required value={editUserForm.lastName} onChange={(e) => setEditUserForm({ ...editUserForm, lastName: e.target.value })} className="bg-slate-950 text-xs" />
              </div>
              <Input required value={editUserForm.username} onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })} className="bg-slate-950 text-xs" />
              <div className="flex items-center gap-2">
                <input id="u-active" type="checkbox" checked={editUserForm.isActive} onChange={(e) => setEditUserForm({ ...editUserForm, isActive: e.target.checked })} className="w-4 h-4" />
                <label htmlFor="u-active" className="text-xs text-white">Konto aktywne</label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditUserModal(null)}>Anuluj</Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-500">Zapisz</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-2">Reset hasła dla @{resetPwdUser.username}</CardTitle>
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <Input required type="password" placeholder="Nowe hasło (min. 8 znaków)" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="bg-slate-950 text-xs" />
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setResetPwdUser(null)}>Anuluj</Button>
                <Button type="submit" size="sm" disabled={isPending || !tempPassword} className="bg-amber-600 hover:bg-amber-500">Ustaw hasło</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
