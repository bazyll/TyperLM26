"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  BellOff,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  getPushStatusAction,
  savePushSubscriptionAction,
  deletePushSubscriptionAction,
  updatePushPreferencesAction,
  sendTestPushNotificationAction,
  PushPreferencesData,
} from "@/lib/push/actions";
import {
  isPushNotificationSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";

export function PushNotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferencesData>({
    enabled: true,
    notify_24h: true,
    notify_3h: true,
    notify_30m: true,
  });

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isPushNotificationSupported()) {
      setSupported(false);
      setLoading(false);
      return;
    }

    startTransition(async () => {
      const res = await getPushStatusAction();
      if (res.success && res.data) {
        setVapidKey(res.data.vapidPublicKey);
        setIsSubscribed(res.data.isSubscribed);
        setPreferences(res.data.preferences);
      }
      setLoading(false);
    });
  }, []);

  const handleToggleMasterPush = async () => {
    setMessage(null);

    if (!isSubscribed) {
      // User is enabling push
      if (!vapidKey) {
        setMessage({
          type: "error",
          text: "Brak skonfigurowanych kluczy VAPID na serwerze.",
        });
        return;
      }

      startTransition(async () => {
        try {
          const subData = await subscribeToPush(vapidKey);
          if (!subData) {
            setMessage({ type: "error", text: "Nie udało się utworzyć subskrypcji." });
            return;
          }

          const saveRes = await savePushSubscriptionAction({
            endpoint: subData.endpoint,
            p256dh: subData.p256dh,
            auth: subData.auth,
            userAgent: navigator.userAgent,
          });

          if (!saveRes.success) {
            setMessage({ type: "error", text: saveRes.error || "Błąd zapisu subskrypcji." });
            return;
          }

          setIsSubscribed(true);
          setPreferences((prev) => ({ ...prev, enabled: true }));
          setMessage({
            type: "success",
            text: "Powiadomienia Push zostały pomyślnie włączone!",
          });
        } catch (err: any) {
          setMessage({
            type: "error",
            text: err?.message || "Odmowa dostępu do powiadomień lub błąd rejestracji.",
          });
        }
      });
    } else {
      // User is disabling push
      startTransition(async () => {
        try {
          const endpoint = await unsubscribeFromPush();
          if (endpoint) {
            await deletePushSubscriptionAction(endpoint);
          }

          await updatePushPreferencesAction({
            ...preferences,
            enabled: false,
          });

          setIsSubscribed(false);
          setPreferences((prev) => ({ ...prev, enabled: false }));
          setMessage({
            type: "success",
            text: "Powiadomienia Push zostały wyłączone na tym urządzeniu.",
          });
        } catch (err: any) {
          setMessage({
            type: "error",
            text: err?.message || "Błąd podczas wyłączania powiadomień.",
          });
        }
      });
    }
  };

  const handleToggleWindow = (key: "notify_24h" | "notify_3h" | "notify_30m") => {
    const updated = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(updated);

    startTransition(async () => {
      const res = await updatePushPreferencesAction(updated);
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Błąd zapisu preferencji." });
      }
    });
  };

  const handleSendTestPush = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await sendTestPushNotificationAction();
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Nie udało się wysłać testu." });
      } else {
        setMessage({
          type: "success",
          text: `Wysłano powiadomienie testowe na ${res.deliveredCount || 1} zarejestrowane urządzenie(-a)!`,
        });
      }
    });
  };

  if (!supported) {
    return (
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] shadow-xl overflow-hidden p-6">
        <div className="flex items-center gap-3 text-slate-400">
          <BellOff className="w-5 h-5 text-slate-500" />
          <p className="text-sm">
            Twoja obecna przeglądarka nie obsługuje powiadomień Web Push.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-[#182645] bg-[#0c1527] shadow-xl overflow-hidden">
      <CardHeader className="p-6 border-b border-[#182645]/60 bg-[#101d36]/40">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Powiadomienia Web Push
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  NA ŻYWO
                </span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Otrzymuj przypomnienia o zbliżających się meczach, jeśli jeszcze ich nie wytypowałeś.
              </CardDescription>
            </div>
          </div>

          <Button
            size="sm"
            disabled={loading || isPending}
            onClick={handleToggleMasterPush}
            className={`text-xs font-bold px-4 h-9 rounded-xl transition-all cursor-pointer ${
              isSubscribed
                ? "bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSubscribed ? (
              <>
                <BellOff className="w-4 h-4 mr-1.5" />
                Wyłącz powiadomienia
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-1.5" />
                Włącz powiadomienia
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Feedback message */}
        {message && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
              message.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/25 text-rose-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Smart Rule Explanation */}
        <div className="p-4 rounded-2xl bg-[#091120] border border-[#182645] flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white font-semibold">Inteligentna reguła wysyłki:</strong>
            <p className="text-slate-400 mt-1">
              Powiadomienie zostanie wysłane <strong className="text-slate-200">tylko wtedy</strong>, gdy w danym oknie masz co najmniej jeden niewypełniony typ. Jeżeli wszystkie mecze w oknie są już obstawione, system nie wyśle żadnego alertu.
            </p>
          </div>
        </div>

        {/* Windows Preferences */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Okna przypomnień
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 24h */}
            <div
              onClick={() => isSubscribed && handleToggleWindow("notify_24h")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                !isSubscribed
                  ? "opacity-50 cursor-not-allowed border-[#182645] bg-[#091120]"
                  : preferences.notify_24h
                  ? "border-blue-500/50 bg-[#121f3a] shadow-md shadow-blue-950/20"
                  : "border-[#182645] bg-[#091120] hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">24 godziny przed</span>
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    preferences.notify_24h && isSubscribed
                      ? "bg-blue-500 text-white"
                      : "bg-[#182645] text-slate-500"
                  }`}
                >
                  {preferences.notify_24h && isSubscribed ? "✓" : ""}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Wczesne ostrzeżenie przed kolejką.
              </p>
            </div>

            {/* 3h */}
            <div
              onClick={() => isSubscribed && handleToggleWindow("notify_3h")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                !isSubscribed
                  ? "opacity-50 cursor-not-allowed border-[#182645] bg-[#091120]"
                  : preferences.notify_3h
                  ? "border-blue-500/50 bg-[#121f3a] shadow-md shadow-blue-950/20"
                  : "border-[#182645] bg-[#091120] hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">3 godziny przed</span>
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    preferences.notify_3h && isSubscribed
                      ? "bg-blue-500 text-white"
                      : "bg-[#182645] text-slate-500"
                  }`}
                >
                  {preferences.notify_3h && isSubscribed ? "✓" : ""}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                W sam raz przed wyjściem z pracy/domu.
              </p>
            </div>

            {/* 30m */}
            <div
              onClick={() => isSubscribed && handleToggleWindow("notify_30m")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                !isSubscribed
                  ? "opacity-50 cursor-not-allowed border-[#182645] bg-[#091120]"
                  : preferences.notify_30m
                  ? "border-blue-500/50 bg-[#121f3a] shadow-md shadow-blue-950/20"
                  : "border-[#182645] bg-[#091120] hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">30 minut przed</span>
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    preferences.notify_30m && isSubscribed
                      ? "bg-blue-500 text-white"
                      : "bg-[#182645] text-slate-500"
                  }`}
                >
                  {preferences.notify_30m && isSubscribed ? "✓" : ""}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ostatni dzwonek przed pierwszym gwizdkiem!
              </p>
            </div>
          </div>
        </div>

        {/* Test Push Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[#182645]/60">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Sprawdź, czy powiadomienia dochodzą na to urządzenie.</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={!isSubscribed || isPending}
            onClick={handleSendTestPush}
            className="rounded-xl border-[#182645] bg-[#101d36] hover:bg-[#16274a] text-slate-200 text-xs font-semibold px-4 h-8 shrink-0 cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5" />
            )}
            Wyślij powiadomienie testowe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
