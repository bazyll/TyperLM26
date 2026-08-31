"use client";

import { useState } from "react";
import { User, Settings, Lock, Upload, Save, Trophy, Flame } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AccountPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState("bartosz");
  const [saveSuccess, setSaveSuccess] = useState(false);

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
          onClick={() => setShowSettings(!showSettings)}
          variant={showSettings ? "default" : "outline"}
          className="rounded-xl border-blue-500/30 text-xs font-semibold"
        >
          <Settings className="w-4 h-4 mr-2" />
          {showSettings ? "Powrót do podglądu" : "Ustawienia konta"}
        </Button>
      </div>

      {!showSettings ? (
        /* Profile View Mode */
        <div className="flex flex-col gap-6">
          <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-blue-500/40 shadow-xl">
                <AvatarFallback className="bg-gradient-to-br from-blue-900 to-indigo-950 text-2xl font-bold text-blue-300">
                  BB
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    Bartosz Kowalski
                  </h2>
                  <Badge variant="gold">#1 w rankingu</Badge>
                  <Badge variant="default">Admin</Badge>
                </div>
                <span className="text-sm text-slate-400 font-medium">@{username}</span>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3">
                  <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                    <span className="text-[11px] text-slate-400">Punkty</span>
                    <div className="text-lg font-extrabold text-blue-400">1 250</div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                    <span className="text-[11px] text-slate-400">Skuteczność</span>
                    <div className="text-lg font-extrabold text-emerald-400">68%</div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                    <span className="text-[11px] text-slate-400">Seria</span>
                    <div className="text-lg font-extrabold text-amber-400 flex items-center justify-center gap-1">
                      <span>5</span>
                      <Flame className="w-4 h-4 fill-amber-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* Settings Edit Mode */
        <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-2xl">
          <CardHeader className="p-0 pb-6">
            <CardTitle className="text-xl font-bold text-white">
              Edycja Ustawień Konta
            </CardTitle>
          </CardHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSaveSuccess(true);
              setTimeout(() => setSaveSuccess(false), 3000);
            }}
            className="flex flex-col gap-6 max-w-lg"
          >
            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs">
                Ustawienia konta zostały pomyślnie zaktualizowane!
              </div>
            )}

            {/* Non-editable first / last name notice */}
            <div className="p-3.5 rounded-2xl bg-[#101d36] border border-[#182645] text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Imię i nazwisko:</span> Bartosz Kowalski
              <p className="text-[11px] text-slate-500 mt-1">
                🔒 Zmiana imienia i nazwiska możliwa jest wyłącznie przez administratora.
              </p>
            </div>

            {/* Editable Username */}
            <div className="flex flex-col gap-2">
              <label htmlFor="edit-username" className="text-xs font-semibold text-slate-300">
                Nazwa użytkownika / Login
              </label>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-[#101d36]"
              />
              <span className="text-[11px] text-slate-500">
                Login jest unikalny i służy do logowania w aplikacji.
              </span>
            </div>

            {/* Change Password */}
            <div className="flex flex-col gap-2">
              <label htmlFor="new-password" className="text-xs font-semibold text-slate-300">
                Nowe hasło
              </label>
              <Input
                id="new-password"
                type="password"
                placeholder="Zostaw puste, jeśli nie zmieniasz"
                className="bg-[#101d36]"
              />
            </div>

            {/* Avatar Upload */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">
                Zdjęcie profilowe / Avatar
              </label>
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12 border border-blue-500/40">
                  <AvatarFallback className="bg-blue-900 text-blue-300 font-bold">
                    BB
                  </AvatarFallback>
                </Avatar>
                <Button type="button" variant="outline" size="sm" className="text-xs">
                  <Upload className="w-3.5 h-3.5 mr-2" />
                  Wgraj avatar (JPG, PNG, WebP)
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-fit mt-2 bg-blue-600 hover:bg-blue-500 text-white">
              <Save className="w-4 h-4 mr-2" />
              Zapisz zmiany
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
