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
import { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "audit" | "export">("users");

  // Data states
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Feedback states
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUserModal, setEditUserModal] = useState<ProfileRow | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<ProfileRow | null>(null);

  // Form states for modals
  const [createForm, setCreateForm] = useState({ username: "", firstName: "", lastName: "", password: "", role: "user" as "user" | "admin" });
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", username: "", isActive: true });
  const [tempPassword, setTempPassword] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, logs] = await Promise.all([adminGetUsersListAction(), adminGetAuditLogsAction()]);
      setUsers(uList);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    startTransition(async () => {
      const res = await adminCreateUserAction(createForm);
      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas tworzenia konta." });
      } else {
        setStatusMessage({ type: "success", text: `Konto @${createForm.username} zostało pomyślnie utworzone!` });
        setShowCreateModal(false);
        setCreateForm({ username: "", firstName: "", lastName: "", password: "", role: "user" });
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
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        username: editForm.username,
        isActive: editForm.isActive,
      });

      if (!res.success) {
        setStatusMessage({ type: "error", text: res.error || "Błąd podczas aktualizacji użytkownika." });
      } else {
        setStatusMessage({ type: "success", text: "Dane użytkownika i status konta zostały zaktualizowane!" });
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

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q)
    );
  });

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
            Zarządzanie Ligą i Użytkownikami
          </h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
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

      {/* Status Alerts */}
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

      {/* TAB: USERS */}
      {activeTab === "users" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Input
                placeholder="Szukaj gracza (login, imię)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#101d36] text-xs h-10"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-xs w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Utwórz konto użytkownika
            </Button>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : (
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
                  {filteredUsers.map((u) => {
                    const initials = `${u.first_name[0] || "U"}${u.last_name[0] || ""}`;
                    return (
                      <tr key={u.id} className="hover:bg-[#162444]/40 transition-colors">
                        {/* User info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8 border border-blue-500/20">
                              {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                              <AvatarFallback className="bg-[#162444] text-xs text-blue-300 font-bold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">
                                {u.first_name} {u.last_name}
                              </span>
                              <span className="text-xs text-slate-400">@{u.username}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleRole(u)}
                            disabled={isPending}
                            className="cursor-pointer"
                            title="Kliknij, aby zmienić rolę"
                          >
                            {u.role === "admin" ? (
                              <Badge variant="default" className="gap-1 cursor-pointer">
                                <ShieldCheck className="w-3 h-3 text-blue-400" />
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="cursor-pointer">
                                User
                              </Badge>
                            )}
                          </button>
                        </td>

                        {/* Active status */}
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs">
                              <UserCheck className="w-3.5 h-3.5" />
                              Aktywny
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 font-medium text-xs">
                              <UserX className="w-3.5 h-3.5" />
                              Zablokowany
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditUserModal(u);
                                setEditForm({
                                  firstName: u.first_name,
                                  lastName: u.last_name,
                                  username: u.username,
                                  isActive: u.is_active,
                                });
                              }}
                              className="h-8 px-2.5 text-xs text-slate-300 hover:text-white"
                              title="Edytuj dane i status aktywności"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Edytuj
                            </Button>

                            {/* Reset Password */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setResetPwdUser(u);
                                setTempPassword("");
                              }}
                              className="h-8 px-2.5 text-xs text-amber-400 hover:text-amber-300 border-amber-500/30"
                              title="Resetuj hasło"
                            >
                              <KeyRound className="w-3.5 h-3.5 mr-1" />
                              Hasło
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
              <tbody className="divide-y divide-[#182645]/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#162444]/40 font-mono">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.created_at).toLocaleString("pl-PL")}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="font-sans">
                        {log.action}
                      </Badge>
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

      {/* MODAL: CREATE USER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-[#0c1527] border-[#182645] p-6 rounded-3xl shadow-2xl">
            <CardTitle className="text-lg font-bold text-white mb-4">Utwórz konto użytkownika</CardTitle>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Imię</label>
                  <Input
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Nazwisko</label>
                  <Input
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Login (username)</label>
                <Input
                  required
                  placeholder="np. player1"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Hasło startowe</label>
                <Input
                  required
                  type="password"
                  placeholder="Min. 8 znaków"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Rola</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as "user" | "admin" })}
                  className="w-full h-11 mt-1 rounded-xl border border-[#182645] bg-[#101d36] px-3 text-xs text-white"
                >
                  <option value="user">Zwykły użytkownik (user)</option>
                  <option value="admin">Administrator (admin)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#182645]">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
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
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Nazwisko</label>
                  <Input
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="bg-[#101d36] text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Login (username)</label>
                <Input
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="bg-[#101d36] text-xs mt-1"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#101d36] border border-[#182645]">
                <input
                  id="active-check"
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
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
