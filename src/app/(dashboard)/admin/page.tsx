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
  Globe,
  RefreshCw,
  Unlink,
  Link2,
  Check,
  X,
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
import { AdminSpecialsSettlement } from "@/components/admin/admin-specials-settlement";
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
import {
  adminGetGoalApiSyncStatusAction,
  adminCheckGoalApiConnectionAction,
  adminGetGoalApiMappingPreviewAction,
  adminTriggerManualGoalApiSyncAction,
  adminSetMatchGoalApiMappingAction,
  adminToggleMatchManualOverrideAction,
  adminSyncUclScheduleAction,
  adminCleanupSafeOrphanTeamsAction,
  adminBootstrapFullUclScheduleAction,
  adminSyncUclPlayersAction,
} from "@/lib/goal-api/actions";
import { GoalApiSyncStatus, GoalApiSyncResult, MappingPreviewItem, GoalApiPlayersSyncResult } from "@/lib/goal-api/types";
import { UclScheduleSyncResult } from "@/lib/goal-api/import";
import { OrphanCleanupResult } from "@/lib/goal-api/cleanup";
import { BootstrapUclScheduleResult } from "@/lib/goal-api/bootstrap";
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
    "matches" | "teams" | "players" | "users" | "specials" | "pickem" | "announcements" | "audit" | "export" | "goal_api"
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

  // GOAL API State
  const [goalApiStatus, setGoalApiStatus] = useState<GoalApiSyncStatus | null>(null);
  const [goalApiLoading, setGoalApiLoading] = useState(false);
  const [mappingPreviews, setMappingPreviews] = useState<MappingPreviewItem[]>([]);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [syncResultModal, setSyncResultModal] = useState<GoalApiSyncResult | null>(null);
  const [scheduleSyncModal, setScheduleSyncModal] = useState<UclScheduleSyncResult | null>(null);
  const [showConfirmScheduleSync, setShowConfirmScheduleSync] = useState(false);
  const [cleanupOrphanModal, setCleanupOrphanModal] = useState<OrphanCleanupResult | null>(null);
  const [showConfirmCleanupOrphans, setShowConfirmCleanupOrphans] = useState(false);
  const [bootstrapUclModal, setBootstrapUclModal] = useState<BootstrapUclScheduleResult | null>(null);
  const [showConfirmBootstrapUcl, setShowConfirmBootstrapUcl] = useState(false);
  const [syncPlayersResultModal, setSyncPlayersResultModal] = useState<GoalApiPlayersSyncResult | null>(null);
  const [showConfirmSyncPlayers, setShowConfirmSyncPlayers] = useState(false);

  const loadGoalApiStatus = async () => {
    setGoalApiLoading(true);
    try {
      const status = await adminGetGoalApiSyncStatusAction();
      setGoalApiStatus(status);
    } catch (err) {
      console.error("Error loading goal api status:", err);
    } finally {
      setGoalApiLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, mList, tList, pList, specList, pickData, annList, logs, gStatus] = await Promise.all([
        adminGetUsersListAction(),
        getMatchesWithPredictionsAction(),
        getAllTeamsAction(),
        getAllPlayersAction(true),
        getSpecialCategoriesWithPredictionsAction(),
        getPickemDataAction(),
        getAnnouncementsAction(),
        adminGetAuditLogsAction(),
        adminGetGoalApiSyncStatusAction(),
      ]);

      setUsers(uList);
      setMatches(mList);
      setTeams(tList);
      setPlayers(pList);
      setSpecialCategories(specList);
      setPickemConfig(pickData.config);
      setAnnouncements(annList);
      setAuditLogs(logs);
      setGoalApiStatus(gStatus);

      if (tList.length >= 2 && !createMatchForm.homeTeamId) {
        setCreateMatchForm((prev) => ({
          ...prev,
          homeTeamId: tList[0].id,
          awayTeamId: tList[1].id,
        }));
      }
    } catch (err) {
      console.error("Admin: Error loading data:", err);
      setStatusMessage({ type: "error", text: "Nie udało się załadować danych administracyjnych." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers - GOAL API
  const handleCheckGoalApiConnection = () => {
    startTransition(async () => {
      try {
        const res = await adminCheckGoalApiConnectionAction();
        if (res.success) {
          setStatusMessage({ type: "success", text: res.message });
          loadGoalApiStatus();
        } else {
          setStatusMessage({ type: "error", text: res.message });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd połączenia." });
      }
    });
  };

  const handleLoadMappingPreview = () => {
    startTransition(async () => {
      try {
        const res = await adminGetGoalApiMappingPreviewAction();
        if (res.success) {
          setMappingPreviews(res.previews);
          setShowMappingModal(true);
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd pobierania podglądu mapowania." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd pobierania podglądu." });
      }
    });
  };

  const handleManualGoalApiSync = () => {
    startTransition(async () => {
      try {
        const res = await adminTriggerManualGoalApiSyncAction();
        setSyncResultModal(res);
        if (res.success) {
          setStatusMessage({
            type: "success",
            text: `Synchronizacja zakończona sukcesem! Zaktualizowano ${res.syncedMatchesCount} meczów (${res.reconciledEventsCount} eventów).`,
          });
          loadData();
          loadGoalApiStatus();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd podczas synchronizacji." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd synchronizacji." });
      }
    });
  };

  const handleSyncUclSchedule = () => {
    setShowConfirmScheduleSync(false);
    startTransition(async () => {
      try {
        const res = await adminSyncUclScheduleAction();
        setScheduleSyncModal(res);
        if (res.success) {
          setStatusMessage({
            type: "success",
            text: `Pomyślnie zsynchronizowano terminarz UCL 2026/27! Dodano ${res.newTeamsCount} drużyn (${res.updatedTeamsCount} zaktualizowano), dodano ${res.newMatchesCount} meczów (${res.updatedMatchesCount} zaktualizowano).`,
          });
          loadData();
          loadGoalApiStatus();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd podczas synchronizacji terminarza." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd synchronizacji terminarza." });
      }
    });
  };

  const handleCleanupOrphans = () => {
    setShowConfirmCleanupOrphans(false);
    startTransition(async () => {
      try {
        const res = await adminCleanupSafeOrphanTeamsAction();
        setCleanupOrphanModal(res);
        if (res.success) {
          setStatusMessage({
            type: "success",
            text: `Pomyślnie usunięto ${res.deletedCount} zbędnych klubów seedowych (${res.skippedCount} pominięto).`,
          });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd podczas usuwania klubów seedowych." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd usuwania klubów." });
      }
    });
  };

  const handleBootstrapUclSchedule = () => {
    setShowConfirmBootstrapUcl(false);
    startTransition(async () => {
      try {
        const res = await adminBootstrapFullUclScheduleAction();
        setBootstrapUclModal(res);
        if (res.success) {
          setStatusMessage({
            type: "success",
            text: `Pomyślnie wdrożono pełny terminarz UEFA! (${res.newMatchesInsertedCount} nowych meczów, ${res.existingReusedCount} zachowanych).`,
          });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd podczas wdrażania terminarza UEFA." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd wdrażania terminarza UEFA." });
      }
    });
  };

  const handleSyncUclPlayers = () => {
    setShowConfirmSyncPlayers(false);
    startTransition(async () => {
      try {
        const res = await adminSyncUclPlayersAction();
        setSyncPlayersResultModal(res);
        if (res.success) {
          setStatusMessage({
            type: "success",
            text: `Pomyślnie zsynchronizowano składy UCL! (${res.insertedCount} dodano, ${res.updatedCount} zaktualizowano, ${res.deactivatedCount} wyłączono).`,
          });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd podczas synchronizacji składów UCL." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd synchronizacji składów." });
      }
    });
  };

  const handleToggleManualOverride = (matchId: string, current: boolean) => {
    startTransition(async () => {
      try {
        const res = await adminToggleMatchManualOverrideAction(matchId, !current);
        if (res.success) {
          setStatusMessage({
            type: "success",
            text: !current ? "Włączono blokadę ręczną dla meczu (manual override)." : "Przywrócono automatyczną synchronizację meczu.",
          });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd zmiany trybu." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd zmiany trybu." });
      }
    });
  };

  const handleSetMatchMapping = (matchId: string, fixtureId: string | null) => {
    startTransition(async () => {
      try {
        const res = await adminSetMatchGoalApiMappingAction(matchId, fixtureId);
        if (res.success) {
          setStatusMessage({ type: "success", text: fixtureId ? "Zmapowano mecz z GOAL API." : "Usunięto mapowanie meczu." });
          loadData();
        } else {
          setStatusMessage({ type: "error", text: res.error || "Błąd zapisu mapowania." });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Błąd zapisu mapowania." });
      }
    });
  };

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
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5" />
          Centrum Zarządzania
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Panel Administratora TyperLM26
        </h1>
      </div>

      {/* Responsive Navigation Tabs (flex-wrap, clean layout, no horizontal scroll) */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-[#0c1527] border border-[#182645]/80 shadow-md">
        <Button
          size="sm"
          variant={activeTab === "matches" ? "default" : "outline"}
          onClick={() => setActiveTab("matches")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "matches"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 mr-1.5" /> Mecze ({matches.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "players" ? "default" : "outline"}
          onClick={() => setActiveTab("players")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "players"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Zawodnicy ({players.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "specials" ? "default" : "outline"}
          onClick={() => setActiveTab("specials")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "specials"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <Star className="w-3.5 h-3.5 mr-1.5" /> Typy Specjalne
        </Button>
        <Button
          size="sm"
          variant={activeTab === "pickem" ? "default" : "outline"}
          onClick={() => setActiveTab("pickem")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "pickem"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <Trophy className="w-3.5 h-3.5 mr-1.5" /> Pick&apos;em
        </Button>
        <Button
          size="sm"
          variant={activeTab === "announcements" ? "default" : "outline"}
          onClick={() => setActiveTab("announcements")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "announcements"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <Bell className="w-3.5 h-3.5 mr-1.5" /> Ogłoszenia ({announcements.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "users" ? "default" : "outline"}
          onClick={() => setActiveTab("users")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "users"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" /> Użytkownicy ({users.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "audit" ? "default" : "outline"}
          onClick={() => setActiveTab("audit")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "audit"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <Activity className="w-3.5 h-3.5 mr-1.5" /> Audit Log
        </Button>
        <Button
          size="sm"
          variant={activeTab === "export" ? "default" : "outline"}
          onClick={() => setActiveTab("export")}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "export"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" /> Backup / Export
        </Button>
        <Button
          size="sm"
          variant={activeTab === "goal_api" ? "default" : "outline"}
          onClick={() => {
            setActiveTab("goal_api");
            loadGoalApiStatus();
          }}
          className={`text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "goal_api"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 border-blue-500/40"
              : "border-[#182645] bg-[#101d36]/60 text-slate-300 hover:text-white hover:bg-[#101d36]"
          }`}
        >
          <Globe className="w-3.5 h-3.5 mr-1.5" /> GOAL API
        </Button>
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
                        <Badge variant="destructive" className="animate-pulse text-[10px]">LIVE</Badge>
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
        <div className="space-y-6">
          <AdminSpecialsSettlement />
        </div>
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

      {/* TAB: GOAL API */}
      {activeTab === "goal_api" && (
        <Card className="rounded-3xl border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span>GOAL API — Zarządzanie i Synchronizacja Live</span>
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                Centralna integracja server-side z GOAL API dla Ligi Mistrzów 2026/2027.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckGoalApiConnection}
                disabled={isPending}
                className="text-xs"
              >
                <Activity className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                Sprawdź połączenie
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleLoadMappingPreview}
                disabled={isPending}
                className="text-xs"
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Podgląd mapowania
              </Button>

              <Button
                size="sm"
                onClick={() => setShowConfirmScheduleSync(true)}
                disabled={isPending}
                className="bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                )}
                Synchronizuj kluby i MD1 (GOAL API)
              </Button>

              <Button
                size="sm"
                onClick={() => setShowConfirmBootstrapUcl(true)}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Wdróż pełny terminarz UEFA (144 mecze)
              </Button>

              <Button
                size="sm"
                onClick={() => setShowConfirmSyncPlayers(true)}
                disabled={isPending}
                className="bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                )}
                Synchronizuj składy UCL
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirmCleanupOrphans(true)}
                disabled={isPending}
                className="text-xs border-slate-700 text-slate-300 hover:bg-red-950/30 hover:border-red-500/50 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-400" />
                Wyczyść 16 orphanów
              </Button>

              <Button
                size="sm"
                onClick={handleManualGoalApiSync}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Synchronizuj teraz (Live)
              </Button>
            </div>
          </div>

          {/* Status & Quota Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Stan konfiguracji</div>
              <div className="mt-1 flex items-center gap-2">
                {goalApiStatus?.isConfigured ? (
                  <Badge className="bg-emerald-600/30 border-emerald-500/50 text-emerald-300">
                    <CheckCircle className="w-3 h-3 mr-1" /> Skonfigurowano
                  </Badge>
                ) : (
                  <Badge className="bg-red-600/30 border-red-500/50 text-red-300">
                    <AlertCircle className="w-3 h-3 mr-1" /> Brak w .env.local
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-2">GOAL_API_KEY (Server-side)</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Limit zapytań (Quota)</div>
              <div className="text-xl font-extrabold text-white mt-1">
                {goalApiStatus?.quotaRemaining !== null && goalApiStatus?.quotaRemaining !== undefined
                  ? `${goalApiStatus.quotaRemaining} / ${goalApiStatus.quotaLimit ?? 1000}`
                  : "1000 / 1000"}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Reset: Codziennie o północy UTC</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Ostatni udany sync</div>
              <div className="text-xs font-semibold text-white mt-1 truncate">
                {goalApiStatus?.lastSuccessAt
                  ? new Date(goalApiStatus.lastSuccessAt).toLocaleString("pl-PL")
                  : "Brak"}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Lease lock: <span className="font-mono text-slate-300">{goalApiStatus?.leaseStatus || "idle"}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Ostatni błąd</div>
              <div className="text-xs text-red-400 mt-1 truncate" title={goalApiStatus?.lastError || "Brak błędów"}>
                {goalApiStatus?.lastError || "Brak błędów"}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Status HTTP / API Error</div>
            </div>
          </div>

          {/* Mappings Table */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Mecze w TyperLM26 i status powiązania z GOAL API ({matches.length})</span>
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Mecz</th>
                    <th className="py-3 px-4">Kickoff (UTC)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">GOAL API Fixture ID</th>
                    <th className="py-3 px-4">Blokada ręczna (Override)</th>
                    <th className="py-3 px-4 text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {matches.map((m) => {
                    const isManual = (m as any).is_manual_override;
                    const fixtureId = (m as any).goal_api_fixture_id;

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{m.homeTeam.name}</span>
                            <span className="text-slate-500 font-mono">vs</span>
                            <span>{m.awayTeam.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(m.kickoffAt).toLocaleString("pl-PL")}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className={
                              m.status === "live"
                                ? "bg-red-950 text-red-400 border-red-800"
                                : m.status === "finished"
                                ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                                : ""
                            }
                          >
                            {m.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {fixtureId ? (
                            <span className="text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/50">
                              {fixtureId}
                            </span>
                          ) : (
                            <span className="text-slate-600">Niezmapowany</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleManualOverride(m.id, isManual)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                              isManual
                                ? "bg-amber-950/80 text-amber-300 border border-amber-800/50 hover:bg-amber-900/80"
                                : "bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800"
                            }`}
                          >
                            {isManual ? (
                              <>
                                <Shield className="w-3 h-3 text-amber-400" />
                                Ręczny override aktywny
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3 text-blue-400" />
                                Auto-sync włączony
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fixtureId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetMatchMapping(m.id, null)}
                              className="text-[10px] h-7 text-red-400 border-red-900 hover:bg-red-950/50"
                            >
                              <Unlink className="w-3 h-3 mr-1" /> Odmapuj
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleLoadMappingPreview}
                              className="text-[10px] h-7 text-blue-300 border-blue-900 hover:bg-blue-950/50"
                            >
                              <Link2 className="w-3 h-3 mr-1" /> Zmapuj
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* MODAL: MAPPING PREVIEW */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-4xl bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-purple-400" />
                <span>Podgląd Mapowania GOAL API vs TyperLM26</span>
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowMappingModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Poniżej znajduje się bezpieczny podgląd dopasowania terminarza Ligi Mistrzów 2026/27. Mapowanie nie nadpisuje automatycznie bazy danych bez Twojej akceptacji.
            </p>

            <div className="overflow-y-auto flex-1 rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 font-semibold text-slate-400 border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">GOAL API Mecz</th>
                    <th className="py-2.5 px-3">Kickoff</th>
                    <th className="py-2.5 px-3">Sugerowany mecz w TyperLM26</th>
                    <th className="py-2.5 px-3">Pewność</th>
                    <th className="py-2.5 px-3 text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {mappingPreviews.map((p) => (
                    <tr key={p.goalApiFixtureId} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {p.goalApiHomeTeam} vs {p.goalApiAwayTeam}
                        <div className="text-[10px] text-slate-500 font-mono">{p.goalApiFixtureId}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(p.kickoffUtc).toLocaleString("pl-PL")}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {p.suggestedMatchId ? (
                          <div>
                            <span className="font-semibold text-white">
                              {p.suggestedHomeTeam} vs {p.suggestedAwayTeam}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">Brak jednoznacznego dopasowania</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="secondary"
                          className={
                            p.confidence === "exact"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : p.confidence === "high"
                              ? "bg-blue-950 text-blue-300 border-blue-800"
                              : p.confidence === "low"
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : "bg-slate-950 text-slate-500"
                          }
                        >
                          {p.confidence.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {p.suggestedMatchId && !p.isMapped && (
                          <Button
                            size="sm"
                            onClick={() => {
                              handleSetMatchMapping(p.suggestedMatchId!, p.goalApiFixtureId);
                              setShowMappingModal(false);
                            }}
                            className="text-[10px] h-7 bg-purple-600 hover:bg-purple-500"
                          >
                            Zatwierdź mapowanie
                          </Button>
                        )}
                        {p.isMapped && (
                          <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800">
                            Zmapowano
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: SYNC RESULT REPORT */}
      {syncResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-blue-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              {syncResultModal.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span>Raport Synchronizacji GOAL API</span>
            </CardTitle>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Zaktualizowane mecze (LIVE)</span>
                <span className="text-lg font-bold text-white">{syncResultModal.syncedMatchesCount}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Sfinalizowane mecze (FT)</span>
                <span className="text-lg font-bold text-emerald-400">{syncResultModal.finalizedMatchesCount}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Zsynchronizowane zdarzenia</span>
                <span className="text-lg font-bold text-purple-400">{syncResultModal.reconciledEventsCount}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Pominięte (Manual Override)</span>
                <span className="text-lg font-bold text-amber-400">{syncResultModal.skippedManualOverridesCount}</span>
              </div>
            </div>

            {syncResultModal.error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
                {syncResultModal.error}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Button size="sm" onClick={() => setSyncResultModal(null)} className="bg-blue-600 hover:bg-blue-500">
                Zamknij raport
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: CONFIRM SCHEDULE SYNC */}
      {showConfirmScheduleSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-purple-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <span>Synchronizacja Terminarza UCL 2026/27</span>
            </CardTitle>

            <p className="text-xs text-slate-300 leading-relaxed">
              Czy na pewno chcesz zsynchronizować oficjalny terminarz UEFA Champions League 2026/27 z GOAL API?
            </p>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bezpieczeństwo typów:</span>
              </div>
              <p>
                Operacja jest w 100% idempotentna. Istniejące typy, punkty i historia użytkowników pozostaną nienaruszone.
              </p>
              <div className="flex items-center gap-1.5 text-blue-400 font-semibold pt-1">
                <Globe className="w-3.5 h-3.5" />
                <span>Zakres:</span>
              </div>
              <p>
                36 drużyn fazy ligowej oraz 18 meczów 1. kolejki (8–10 września 2026). Kwalifikacje zostaną pominięte.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirmScheduleSync(false)}
                disabled={isPending}
                className="text-xs"
              >
                Anuluj
              </Button>
              <Button
                size="sm"
                onClick={handleSyncUclSchedule}
                disabled={isPending}
                className="bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5 mr-1.5" />}
                Tak, synchronizuj terminarz
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: SCHEDULE SYNC RESULT REPORT */}
      {scheduleSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-purple-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              {scheduleSyncModal.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span>Raport Synchronizacji Terminarza UCL 2026/27</span>
            </CardTitle>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Drużyny Fazy Ligowej</span>
                <span className="text-lg font-bold text-white">{scheduleSyncModal.teamsSyncedCount}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ({scheduleSyncModal.newTeamsCount} nowych, {scheduleSyncModal.updatedTeamsCount} zaktualizowanych)
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Mecze Fazy Ligowej</span>
                <span className="text-lg font-bold text-purple-400">{scheduleSyncModal.matchesSyncedCount}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ({scheduleSyncModal.newMatchesCount} nowych, {scheduleSyncModal.updatedMatchesCount} zaktualizowanych)
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Kwalifikacje pominięte</span>
                <span className="text-lg font-bold text-slate-400">{scheduleSyncModal.qualifyingIgnoredCount}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Ignorowane zgodnie z regułami</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Pominięte (Manual Override)</span>
                <span className="text-lg font-bold text-amber-400">{scheduleSyncModal.manualOverridesSkippedCount}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Mecze chronione blokadą ręczną</span>
              </div>
            </div>

            {scheduleSyncModal.error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
                {scheduleSyncModal.error}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Button size="sm" onClick={() => setScheduleSyncModal(null)} className="bg-purple-600 hover:bg-purple-500 text-white">
                Zamknij raport
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: CONFIRM CLEANUP 16 ORPHANS */}
      {showConfirmCleanupOrphans && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-red-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              <span>Usunięcie 16 zbędnych klubów seedowych</span>
            </CardTitle>
            <p className="text-xs text-slate-300">
              Ta operacja bezpiecznie usunie 16 klubów z pierwotnego seeda, które nie biorą udziału w Lidze Mistrzów 2026/27 i posiadają 0 powiązań FK w bazie.
            </p>
            <p className="text-[11px] text-slate-400">
              Klub Juventus FC (posiadający wybór w Pick&apos;em) nie zostanie usunięty. Bezpośrednio przed usunięciem każdego rekordu nastąpi weryfikacja FK w czasie rzeczywistym.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setShowConfirmCleanupOrphans(false)} disabled={isPending} className="text-xs">
                Anuluj
              </Button>
              <Button size="sm" onClick={handleCleanupOrphans} disabled={isPending} className="bg-red-600 hover:bg-red-500 text-xs font-semibold text-white">
                {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Tak, usuń 16 klubów
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: CLEANUP ORPHANS RESULT */}
      {cleanupOrphanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Raport Czyszczenia Klubów Seedowych</span>
            </CardTitle>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Usunięte rekordy</span>
                <span className="text-lg font-bold text-emerald-400">{cleanupOrphanModal.deletedCount}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Pominięte rekordy</span>
                <span className="text-lg font-bold text-slate-400">{cleanupOrphanModal.skippedCount}</span>
              </div>
            </div>
            {cleanupOrphanModal.deletedTeamNames.length > 0 && (
              <div className="text-[11px] text-slate-400 max-h-32 overflow-y-auto bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-semibold block mb-1">Usunięto:</span>
                {cleanupOrphanModal.deletedTeamNames.join(", ")}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Button size="sm" onClick={() => setCleanupOrphanModal(null)} className="bg-slate-800 hover:bg-slate-700 text-white">
                Zamknij
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: CONFIRM BOOTSTRAP 144 UEFA FIXTURES */}
      {showConfirmBootstrapUcl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-emerald-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Wdrożenie Pełnego Terminarza UEFA (144 mecze)</span>
            </CardTitle>
            <p className="text-xs text-slate-300">
              Operacja wdroży kompletny kalendarz fazy ligowej Ligi Mistrzów 2026/27 (kolejki 1–8).
            </p>
            <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-1">
              <li>18 istniejących meczów 1. kolejki zostanie w 100% zachowanych (UUID, typy, statusy).</li>
              <li>126 nowych meczów (kolejki 2–8) zostanie dodanych ze statusem zaplanowany.</li>
              <li>GOAL API po opublikowaniu kolejnych kolejek automatycznie połączy wyniki z tymi meczami.</li>
            </ul>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setShowConfirmBootstrapUcl(false)} disabled={isPending} className="text-xs">
                Anuluj
              </Button>
              <Button size="sm" onClick={handleBootstrapUclSchedule} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white">
                {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                Tak, wdróż 144 mecze
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: BOOTSTRAP RESULT */}
      {bootstrapUclModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-emerald-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              {bootstrapUclModal.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span>Raport Wdrożenia Terminarza UEFA (144 mecze)</span>
            </CardTitle>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Łącznie w kalendarzu</span>
                <span className="text-lg font-bold text-white">{bootstrapUclModal.totalDatasetMatches}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Zachowane mecze</span>
                <span className="text-lg font-bold text-emerald-400">{bootstrapUclModal.existingReusedCount}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Nowo dodane</span>
                <span className="text-lg font-bold text-blue-400">{bootstrapUclModal.newMatchesInsertedCount}</span>
              </div>
            </div>
            {bootstrapUclModal.error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
                {bootstrapUclModal.error}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Button size="sm" onClick={() => setBootstrapUclModal(null)} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                Zamknij raport
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: CONFIRM SYNC PLAYERS (36 CLUBS) */}
      {showConfirmSyncPlayers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-slate-900 border-purple-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span>Synchronizacja Składów 36 Klubów UCL</span>
            </CardTitle>
            <p className="text-xs text-slate-300">
              Operacja pobierze z GOAL API oficjalne składy wszystkich 36 drużyn fazy ligowej.
            </p>
            <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-1">
              <li>Zawodnicy zostaną zidentyfikowani po stabilnym external ID (CUID oraz apiId).</li>
              <li>Stan aktywności graczy zostanie pobrany z pola <code>isActive</code> providera.</li>
              <li>Globalna dezaktywacja nieobecnych graczy uruchomi się tylko przy 100% udanych zapytaniach (36/36).</li>
              <li>Żadne rekordy zawodników nie zostaną usunięte z bazy.</li>
            </ul>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setShowConfirmSyncPlayers(false)} disabled={isPending} className="text-xs">
                Anuluj
              </Button>
              <Button size="sm" onClick={handleSyncUclPlayers} disabled={isPending} className="bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white">
                {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Users className="w-3.5 h-3.5 mr-1.5" />}
                Rozpocznij synchronizację (36 drużyn)
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: PLAYERS SYNC RESULT */}
      {syncPlayersResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-slate-900 border-purple-500/40 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              {syncPlayersResultModal.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span>Raport Synchronizacji Składów UCL</span>
            </CardTitle>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Ukończone kluby</span>
                <span className="text-lg font-bold text-white">{syncPlayersResultModal.successfulTeamsCount} / {syncPlayersResultModal.totalTeamsChecked}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Nowo dodani</span>
                <span className="text-lg font-bold text-emerald-400">{syncPlayersResultModal.insertedCount}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-medium">Zaktualizowani</span>
                <span className="text-lg font-bold text-blue-400">{syncPlayersResultModal.updatedCount}</span>
              </div>
            </div>
            {syncPlayersResultModal.error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
                {syncPlayersResultModal.error}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Button size="sm" onClick={() => setSyncPlayersResultModal(null)} className="bg-purple-600 hover:bg-purple-500 text-white">
                Zamknij raport
              </Button>
            </div>
          </Card>
        </div>
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
