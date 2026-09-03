"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
  Radio,
  RefreshCw,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Globe,
  Activity,
  Layers,
  Sparkles,
  Database,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TeamLogo } from "@/components/team-logo";
import { useRealtimeMatches } from "@/lib/supabase/use-realtime-matches";
import {
  adminGetLiveFixturesAction,
  adminStartSandboxSessionAction,
  adminTickSandboxSyncAction,
  adminTeardownSandboxAction,
  LiveSandboxFixtureSummary,
  LiveSandboxSessionState,
} from "@/lib/sandbox/actions";
import { calculateEstimatedClock } from "@/lib/sandbox/clock-estimator";

const MAX_SANDBOX_REQUESTS = 150;

export function LiveSandboxClient() {
  const [fixtures, setFixtures] = useState<LiveSandboxFixtureSummary[]>([]);
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
  const [fixturesError, setFixturesError] = useState<string | null>(null);

  const [activeSession, setActiveSession] = useState<LiveSandboxSessionState | null>(null);
  const [initialPredictions, setInitialPredictions] = useState<Record<string, { home: number; away: number }>>({});
  const [isStartingSession, setIsStartingSession] = useState(false);

  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [isTicking, setIsTicking] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  const [isTeardownPending, setIsTeardownPending] = useState(false);
  const [realtimePulse, setRealtimePulse] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  const [nowTime, setNowTime] = useState<number>(Date.now());
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localClockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPending, startTransition] = useTransition();

  // Local ticker every 10s for smooth match minute progress (zero API requests)
  useEffect(() => {
    localClockTimerRef.current = setInterval(() => {
      setNowTime(Date.now());
    }, 10000);

    return () => {
      if (localClockTimerRef.current) clearInterval(localClockTimerRef.current);
    };
  }, []);

  // Supabase Realtime hook listening to UPDATE on 'matches' table
  useRealtimeMatches({
    enabled: Boolean(activeSession),
    onMatchUpdate: (updated) => {
      if (activeSession && updated.id === activeSession.matchId) {
        setRealtimePulse(true);
        setTimeout(() => setRealtimePulse(false), 2000);

        setActiveSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            dbScore: {
              home: updated.home_score ?? prev.dbScore.home,
              away: updated.away_score ?? prev.dbScore.away,
            },
            mappedStatus: updated.status as any,
            isBettingLocked: updated.is_betting_locked,
          };
        });

        addLog(`[REALTIME WEBSOCKET] Otrzymano zdarzenie UPDATE z PostgreSQL: Wynik ${updated.home_score ?? 0}:${updated.away_score ?? 0}, Status: ${updated.status}`);
      }
    },
  });

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setSyncLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 30)]);
  };

  // 1. Fetch live fixtures from GOAL API
  const handleFetchLiveFixtures = async () => {
    setIsLoadingFixtures(true);
    setFixturesError(null);
    try {
      const res = await adminGetLiveFixturesAction();
      if (!res.success || !res.fixtures) {
        setFixturesError(res.error || "Brak dostępnych meczów LIVE.");
        setFixtures([]);
      } else {
        setFixtures(res.fixtures);
        // Initialize default prediction inputs
        const init: Record<string, { home: number; away: number }> = {};
        res.fixtures.forEach((f) => {
          init[f.fixtureId] = { home: f.homeScore || 1, away: f.awayScore || 1 };
        });
        setInitialPredictions(init);
        addLog(`Znaleziono ${res.fixtures.length} meczów LIVE w GOAL API.`);
      }
    } catch (err: any) {
      setFixturesError(err.message || "Błąd pobierania meczów LIVE.");
    } finally {
      setIsLoadingFixtures(false);
    }
  };

  // 2. Start sandbox session for a chosen fixture
  const handleStartSession = async (fixture: LiveSandboxFixtureSummary) => {
    setIsStartingSession(true);
    const pred = initialPredictions[fixture.fixtureId] || { home: fixture.homeScore, away: fixture.awayScore };

    try {
      const res = await adminStartSandboxSessionAction({
        fixtureId: fixture.fixtureId,
        userHomeScore: pred.home,
        userAwayScore: pred.away,
      });

      if (!res.success || !res.sessionState) {
        alert(res.error || "Nie udało się uruchomić sesji.");
        return;
      }

      setActiveSession(res.sessionState);
      addLog(`Utworzono mecz testowy (ID: ${res.sessionState.matchId.slice(0, 8)}...) powiązany z GOAL API ID: ${fixture.fixtureId}`);
      addLog(`Zapisano typ testowy: ${pred.home}:${pred.away}`);
    } catch (err: any) {
      alert(err.message || "Błąd podczas startu.");
    } finally {
      setIsStartingSession(false);
    }
  };

  // 3. Manual / automated tick
  const handleSyncTick = async () => {
    if (!activeSession || isTicking) return;
    setIsTicking(true);

    try {
      const res = await adminTickSandboxSyncAction({
        matchId: activeSession.matchId,
        fixtureId: activeSession.fixtureId,
        currentRequestCount: activeSession.requestCount,
        currentHomeScore: activeSession.providerScore.home,
        currentAwayScore: activeSession.providerScore.away,
        currentLatestEventMinute: activeSession.latestEventMinute,
        currentLatestEventDescription: activeSession.latestEventDescription,
      });

      if (!res.success) {
        addLog(`[BŁĄD SYNC] ${res.error}`);
        return;
      }

      setActiveSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          dbScore: res.dbScore || prev.dbScore,
          providerScore: res.providerScore || prev.providerScore,
          mappedStatus: res.mappedStatus || prev.mappedStatus,
          rawStatus: res.rawStatus || prev.rawStatus,
          kickoffUtc: res.kickoffUtc || prev.kickoffUtc,
          providerUpdatedAt: res.providerUpdatedAt !== undefined ? res.providerUpdatedAt : prev.providerUpdatedAt,
          latestEventMinute: res.latestEventMinute !== undefined ? res.latestEventMinute : prev.latestEventMinute,
          latestEventDescription: res.latestEventDescription !== undefined ? res.latestEventDescription : prev.latestEventDescription,
          isFinished: Boolean(res.isFinished),
          eventsReconciledCount: res.eventsCount ?? prev.eventsReconciledCount,
          userPrediction: {
            ...prev.userPrediction,
            pointsAwarded: res.pointsAwarded !== undefined ? res.pointsAwarded : prev.userPrediction.pointsAwarded,
          },
          requestCount: res.requestCount || prev.requestCount + 1,
          lastSyncedAt: res.lastSyncedAt || new Date().toISOString(),
        };
      });

      addLog(`[SYNC TICK #${res.requestCount}] Provider: ${res.providerScore?.home}:${res.providerScore?.away} (Raw: ${res.rawStatus}, Mapped: ${res.mappedStatus}${res.latestEventMinute ? `, Event: ${res.latestEventMinute}'` : ""})`);

      if (res.isFinished) {
        addLog(`[MECZ ZAKOŃCZONY FT] Wywołano finalizację i uzgadnianie zdarzeń (${res.eventsCount ?? 0} zdarzeń). Przyznane punkty: ${res.pointsAwarded ?? 0} pkt`);
      }
    } catch (err: any) {
      addLog(`[BŁĄD TICK] ${err.message}`);
    } finally {
      setIsTicking(false);
    }
  };

  // 4. Teardown session
  const handleTeardown = async () => {
    if (!activeSession) return;
    if (!confirm("Czy na pewno chcesz zakończyć test i usunąć dane sesji sandboxowej ze Stagingu?")) return;

    setIsTeardownPending(true);
    try {
      const res = await adminTeardownSandboxAction({ matchId: activeSession.matchId });
      if (!res.success) {
        alert(res.error || "Błąd czyszczenia danych.");
        return;
      }

      addLog("Sesja testowa została zakończona. Dane testowe usunięte ze Stagingu.");
      setActiveSession(null);
    } catch (err: any) {
      alert(err.message || "Błąd podczas usuwania.");
    } finally {
      setIsTeardownPending(false);
    }
  };

  // Auto-polling effect (1 request per 60 seconds)
  useEffect(() => {
    if (!activeSession || !isAutoSyncEnabled || activeSession.isFinished) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    pollingTimerRef.current = setInterval(() => {
      handleSyncTick();
    }, 60000); // 60s cadence

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [activeSession, isAutoSyncEnabled]);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-indigo-950/60 via-blue-950/40 to-slate-900 border border-blue-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-600/20 border border-blue-400/30 text-blue-400 shadow-inner">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Staging Sandbox E2E • fvdwforzjjtghyrkqmfi
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Live Fixture Sandbox
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Bezpieczny poligon do weryfikacji pełnego potoku: <strong>GOAL API → Staging DB → Supabase Realtime → UI</strong> na prawdziwym meczu bez wpływu na dane UCL.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Badge className="bg-emerald-950/60 text-emerald-300 border-emerald-500/40 px-3 py-1.5 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-ping" />
            Staging Guard: ACTIVE
          </Badge>
        </div>
      </div>

      {/* Mode A: Discovery / Selection View (When no session active) */}
      {!activeSession && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                1. Wykryj trwający mecz LIVE
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pobierz listę aktualnie trwających meczów z endpointu <code>/fixtures/live</code> w GOAL API.
              </p>
            </div>

            <Button
              onClick={handleFetchLiveFixtures}
              disabled={isLoadingFixtures}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-semibold shadow-lg shadow-blue-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFixtures ? "animate-spin" : ""}`} />
              {isLoadingFixtures ? "Pobieranie..." : "Znajdź mecze LIVE"}
            </Button>
          </div>

          {fixturesError && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{fixturesError}</span>
            </div>
          )}

          {fixtures.length === 0 && !isLoadingFixtures && !fixturesError && (
            <Card className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-slate-900/40 border-slate-800">
              <Activity className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-300">Brak załadowanych meczów</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Kliknij „Znajdź mecze LIVE”, aby odpytać GOAL API o aktualnie trwające spotkania na świecie.
              </p>
            </Card>
          )}

          {/* Fixtures Table / Grid */}
          {fixtures.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fixtures.map((f) => {
                const pred = initialPredictions[f.fixtureId] || { home: f.homeScore, away: f.awayScore };
                const fixtureClock = calculateEstimatedClock({
                  kickoffUtc: f.kickoffUtc,
                  rawStatus: f.rawStatus,
                  mappedStatus: f.isFinished ? "finished" : "live",
                  latestEventMinute: f.latestEventMinute,
                  latestEventDescription: f.latestEventDescription,
                  now: nowTime,
                });
                return (
                  <Card
                    key={f.fixtureId}
                    className="p-5 rounded-3xl bg-[#0c1527]/90 border border-blue-900/40 hover:border-blue-500/40 transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-2 border-b border-slate-800/60">
                        <span className="font-semibold text-blue-300 truncate max-w-[200px]">
                          {f.leagueName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <Badge className="bg-red-950/60 text-red-300 border-red-500/30 text-[10px] font-bold px-2">
                            {f.rawStatus} • {fixtureClock.display}
                          </Badge>
                        </div>
                      </div>

                      {/* Teams & Score */}
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 my-2">
                        <div className="text-right">
                          <div className="font-bold text-white text-sm truncate">{f.homeTeamName}</div>
                        </div>

                        <div className="px-4 py-2 rounded-2xl bg-blue-950/60 border border-blue-500/20 text-center">
                          <span className="text-lg font-black text-white tracking-wider">
                            {f.homeScore} : {f.awayScore}
                          </span>
                        </div>

                        <div className="text-left">
                          <div className="font-bold text-white text-sm truncate">{f.awayTeamName}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                      {/* Prediction Inputs */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">Twój typ testowy:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={pred.home}
                            onChange={(e) =>
                              setInitialPredictions((prev) => ({
                                ...prev,
                                [f.fixtureId]: { ...pred, home: parseInt(e.target.value) || 0 },
                              }))
                            }
                            className="w-10 h-8 rounded-lg bg-slate-950 border border-slate-700 text-center text-xs font-bold text-white"
                          />
                          <span className="text-slate-500 text-xs font-bold">:</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={pred.away}
                            onChange={(e) =>
                              setInitialPredictions((prev) => ({
                                ...prev,
                                [f.fixtureId]: { ...pred, away: parseInt(e.target.value) || 0 },
                              }))
                            }
                            className="w-10 h-8 rounded-lg bg-slate-950 border border-slate-700 text-center text-xs font-bold text-white"
                          />
                        </div>
                      </div>

                      <Button
                        size="sm"
                        disabled={isStartingSession}
                        onClick={() => handleStartSession(f)}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Rozpocznij test
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mode B: Active Test Session View */}
      {activeSession && (
        <div className="flex flex-col gap-6">
          {/* Active Session Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span>
                Aktywna sesja testowa: <strong>{activeSession.homeTeam.name} vs {activeSession.awayTeam.name}</strong> (GOAL ID: <code>{activeSession.fixtureId}</code>)
              </span>
            </div>

            <Button
              variant="destructive"
              size="sm"
              disabled={isTeardownPending}
              onClick={handleTeardown}
              className="text-xs gap-1.5 self-end sm:self-auto"
            >
              <Square className="w-3.5 h-3.5" />
              {isTeardownPending ? "Usuwanie..." : "Zakończ test i usuń dane"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Realtime Match Card (1:1 Production Component styling) */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Karta Meczowa LIVE (Supabase Realtime)
                </h3>

                <Badge
                  className={`transition-all duration-500 ${
                    realtimePulse
                      ? "bg-cyan-500 text-white scale-105 shadow-lg shadow-cyan-500/50"
                      : "bg-blue-950/60 text-blue-300 border-blue-500/30"
                  } text-[11px] px-2.5 py-1`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2 animate-ping" />
                  WebSocket: {realtimePulse ? "ZMIANA DANYCH!" : "NASŁUCHIWANIE"}
                </Badge>
              </div>

              {/* Match Card */}
              <Card className="p-6 rounded-3xl bg-[#0c1527] border border-[#182645] shadow-2xl relative overflow-hidden">
                {/* Header Tag */}
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-400 text-xs font-bold border border-blue-500/20">
                      MECZ TESTOWY LIVE
                    </span>
                    {(() => {
                      const activeClock = calculateEstimatedClock({
                        kickoffUtc: activeSession.kickoffUtc,
                        rawStatus: activeSession.rawStatus,
                        mappedStatus: activeSession.mappedStatus,
                        latestEventMinute: activeSession.latestEventMinute,
                        latestEventDescription: activeSession.latestEventDescription,
                        now: nowTime,
                      });
                      return (
                        <Badge className="bg-red-950/70 text-red-300 border-red-500/40 text-[11px] font-extrabold px-2.5 py-0.5 animate-pulse">
                          ● {activeClock.display === "FT" || activeClock.display === "PRZERWA" ? activeClock.display : `LIVE • ${activeClock.display}`}
                        </Badge>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Typowanie zablokowane</span>
                  </div>
                </div>

                {/* Score Board */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
                  {/* Home Team */}
                  <div className="flex flex-col items-center sm:items-end text-center sm:text-right gap-2">
                    <TeamLogo
                      logoUrl={activeSession.homeTeam.logoUrl}
                      teamName={activeSession.homeTeam.name}
                      teamCode={activeSession.homeTeam.code}
                      size={56}
                      className="shadow-lg"
                    />
                    <div className="font-extrabold text-white text-base sm:text-lg">
                      {activeSession.homeTeam.name}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      [{activeSession.homeTeam.code}]
                    </span>
                  </div>

                  {/* Realtime Live Score Display */}
                  <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-3xl bg-gradient-to-b from-blue-950/80 to-slate-950 border border-blue-500/30 shadow-2xl">
                    <div className="text-3xl sm:text-4xl font-black text-white tracking-widest font-mono">
                      {activeSession.dbScore.home} : {activeSession.dbScore.away}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      Aktualny Wynik DB
                    </div>
                  </div>

                  {/* Away Team */}
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
                    <TeamLogo
                      logoUrl={activeSession.awayTeam.logoUrl}
                      teamName={activeSession.awayTeam.name}
                      teamCode={activeSession.awayTeam.code}
                      size={56}
                      className="shadow-lg"
                    />
                    <div className="font-extrabold text-white text-base sm:text-lg">
                      {activeSession.awayTeam.name}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      [{activeSession.awayTeam.code}]
                    </span>
                  </div>
                </div>

                {/* Footer Status Bar: User Prediction & Scoring Status */}
                <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-slate-400 font-medium">Twój zapisany typ:</span>
                    <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 font-bold text-white">
                      {activeSession.userPrediction.home} : {activeSession.userPrediction.away}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeSession.isFinished ? (
                      <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-xs font-bold px-3 py-1">
                        ✓ Przyznane punkty: {activeSession.userPrediction.pointsAwarded ?? 0} pkt
                      </Badge>
                    ) : (
                      <span className="text-slate-400 italic">
                        Punkty zostaną przyznane po sędziowskim FT (0 pkt w trakcie LIVE)
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: Diagnostic Monitor & Controls */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                Panel Diagnostyczny Sync
              </h3>

              <Card className="p-5 rounded-3xl bg-[#0c1527] border border-[#182645] flex flex-col gap-4 text-xs">
                {/* Metrics */}
                <div className="flex flex-col gap-2.5 divide-y divide-slate-800/60">
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">Stan Realtime:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Połączono (WebSockets)
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-400">Licznik zapytań sesji:</span>
                    <span className="font-bold text-white font-mono">
                      {activeSession.requestCount} / {MAX_SANDBOX_REQUESTS} limit
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-400">Wynik Providera GOAL:</span>
                    <span className="font-bold text-cyan-300 font-mono">
                      {activeSession.providerScore.home} : {activeSession.providerScore.away}
                    </span>
                  </div>

                  {(() => {
                    const activeClock = calculateEstimatedClock({
                      kickoffUtc: activeSession.kickoffUtc,
                      rawStatus: activeSession.rawStatus,
                      mappedStatus: activeSession.mappedStatus,
                      latestEventMinute: activeSession.latestEventMinute,
                      latestEventDescription: activeSession.latestEventDescription,
                      now: nowTime,
                    });

                    const secondsAgo = activeSession.providerUpdatedAt
                      ? Math.max(0, Math.floor((nowTime - new Date(activeSession.providerUpdatedAt).getTime()) / 1000))
                      : null;

                    return (
                      <>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-slate-400">Estimated match minute:</span>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {activeClock.display}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <span className="text-slate-400">Clock source:</span>
                          <span
                            className="font-mono text-[11px] text-slate-300 text-right max-w-[190px] truncate"
                            title={activeClock.sourceLabel}
                          >
                            {activeClock.sourceLabel}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <span className="text-slate-400">Raw Provider Status:</span>
                          <Badge className="bg-slate-900 border-slate-700 text-slate-300 font-mono text-[10px]">
                            {activeSession.rawStatus || "—"}
                          </Badge>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <span className="text-slate-400">Provider last updated:</span>
                          <span className="text-slate-300 font-mono text-[11px]">
                            {secondsAgo !== null
                              ? `${secondsAgo} s temu`
                              : "Brak"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <span className="text-slate-400">Mapped App Status:</span>
                          <Badge className="bg-blue-950 border-blue-700 text-blue-300 font-mono text-[10px]">
                            {activeSession.mappedStatus}
                          </Badge>
                        </div>
                      </>
                    );
                  })()}

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-400">Ostatnia synchronizacja:</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {activeSession.lastSyncedAt
                        ? new Date(activeSession.lastSyncedAt).toLocaleTimeString()
                        : "Brak"}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="pt-3 border-t border-slate-800/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Auto-Sync (1/min):</span>
                    <button
                      onClick={() => setIsAutoSyncEnabled((p) => !p)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        isAutoSyncEnabled
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {isAutoSyncEnabled ? "WŁĄCZONE" : "PAUZA"}
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isTicking}
                    onClick={handleSyncTick}
                    className="w-full border-blue-500/30 hover:bg-blue-950/60 text-blue-300 text-xs font-semibold gap-2 mt-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTicking ? "animate-spin" : ""}`} />
                    {isTicking ? "Synchronizacja..." : "Manual Tick (Wymuś)"}
                  </Button>
                </div>
              </Card>

              {/* Event Log Console */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Dziennik zdarzeń sesji
                </span>
                <div className="p-3 rounded-2xl bg-black/60 border border-slate-800 font-mono text-[11px] text-slate-300 h-44 overflow-y-auto flex flex-col gap-1">
                  {syncLogs.length === 0 ? (
                    <span className="text-slate-600 italic">Oczekiwanie na zdarzenia...</span>
                  ) : (
                    syncLogs.map((log, i) => (
                      <div key={i} className="leading-tight">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
