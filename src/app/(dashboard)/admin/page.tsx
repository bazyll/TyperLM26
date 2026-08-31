"use client";

import { useState } from "react";
import {
  Shield,
  Users,
  CalendarDays,
  Download,
  FileText,
  Activity,
  Plus,
  Edit2,
  CheckCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "matches" | "users" | "export">("dashboard");

  const downloadRankingSnapshot = () => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);
    const content = `TyperLM26
Snapshot rankingu

Data wygenerowania:
${now.toLocaleString("pl-PL")}

1. Bartosz Kowalski (@bartosz) — 1 250 pkt
2. Michał Nowak (@michal) — 1 120 pkt
3. Kamil Wiśniewski (@kamil) — 980 pkt
4. Dominik Wójcik (@dominik) — 870 pkt
5. Paweł Kamiński (@pawel) — 760 pkt
6. Mateusz Lewandowski (@mateusz) — 710 pkt
7. Tomasz Zieliński (@tomasz) — 680 pkt
8. Krzysztof Szymański (@krzysztof) — 620 pkt
9. Piotr Woźniak (@piotr) — 590 pkt
10. Łukasz Kozłowski (@lukasz) — 540 pkt
`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TyperLM26-ranking-${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <Shield className="w-3.5 h-3.5" />
            Panel Zarządzania Ligą
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Panel Administratora
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Zarządzanie meczami, wynikami live, kontami użytkowników, audytem i kopiami zapasowymi.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={activeTab === "dashboard" ? "default" : "outline"}
            onClick={() => setActiveTab("dashboard")}
            className="text-xs"
          >
            Dashboard
          </Button>
          <Button
            size="sm"
            variant={activeTab === "matches" ? "default" : "outline"}
            onClick={() => setActiveTab("matches")}
            className="text-xs"
          >
            Mecze
          </Button>
          <Button
            size="sm"
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
            className="text-xs"
          >
            Użytkownicy
          </Button>
          <Button
            size="sm"
            variant={activeTab === "export" ? "default" : "outline"}
            onClick={() => setActiveTab("export")}
            className="text-xs"
          >
            Backup / Export
          </Button>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div className="flex flex-col gap-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-5">
              <span className="text-xs text-slate-400">Uczestnicy ligi</span>
              <div className="text-2xl font-extrabold text-white mt-1">10</div>
            </Card>
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-5">
              <span className="text-xs text-slate-400">Wszystkie mecze</span>
              <div className="text-2xl font-extrabold text-blue-400 mt-1">144</div>
            </Card>
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-5">
              <span className="text-xs text-slate-400">Zakończone mecze</span>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">0</div>
            </Card>
            <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-5">
              <span className="text-xs text-slate-400">Najbliższy kickoff</span>
              <div className="text-lg font-extrabold text-amber-400 mt-1">15.09, 18:45</div>
            </Card>
          </div>

          {/* Recent Audit Log Preview */}
          <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
            <CardTitle className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span>Ostatnie Aktywności (Append-Only Audit Log)</span>
            </CardTitle>

            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-2xl bg-[#101d36] border border-[#182645] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">ADMIN_AUTH</Badge>
                  <span className="text-slate-300 font-medium">Utworzono początkowy schemat bazy i konta demonstracyjne</span>
                </div>
                <span className="text-slate-500">Dzisiaj 17:36</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "matches" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-lg font-bold text-white">
              Zarządzanie Meczami i Wynikami
            </CardTitle>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj mecz
            </Button>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Wprowadzaj aktualne wyniki live oraz wyniki końcowe. Po zatwierdzeniu wyniku ranking i tabela LM zostaną zaktualizowane w czasie rzeczywistym.
          </p>
        </Card>
      )}

      {activeTab === "users" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-lg font-bold text-white">
              Uczestnicy Ligi (Brak Rejestracji Publicznej)
            </CardTitle>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs">
              <Plus className="w-4 h-4 mr-1" />
              Utwórz konto użytkownika
            </Button>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Administrator zarządza kontami, nadaje loginy i hasła startowe oraz przypisuje role (user / admin).
          </p>
        </Card>
      )}

      {activeTab === "export" && (
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-xl">
          <CardTitle className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" />
            <span>Kopia Zapasowa i Eksport Danych</span>
          </CardTitle>
          <p className="text-xs text-slate-400 mb-6">
            Eksportuj aktualny stan rankingu do niezależnego pliku tekstowego jako snapshot bezpieczeństwa.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button
              onClick={downloadRankingSnapshot}
              size="lg"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30"
            >
              <FileText className="w-4 h-4 mr-2" />
              Pobierz tabelę punktów (.txt)
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
