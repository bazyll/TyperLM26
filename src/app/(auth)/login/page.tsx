"use client";

import { useActionState, useState } from "react";
import { Lock, User, Eye, EyeOff, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithUsernameAction } from "@/lib/auth/actions";
import { ActionResult } from "@/lib/auth/schemas";

const initialState: ActionResult = {
  success: false,
};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginWithUsernameAction,
    initialState
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b14] p-4 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 flex flex-col gap-6">
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white shadow-xl shadow-blue-600/30">
            <Sparkles className="w-7 h-7 text-blue-200" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-2">
            Typer<span className="text-blue-500 font-extrabold">LM26</span>
          </h1>
          <p className="text-xs text-slate-400">
            Prywatna liga typowania UEFA Champions League 2026/2027
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Logowanie</h2>
            <p className="text-xs text-slate-400 mt-1">
              Wprowadź swój login i hasło nadane przez administratora.
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            {/* Error Message */}
            {state?.error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{state.error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xs font-semibold text-slate-300"
              >
                Login / Nazwa użytkownika
              </label>
              <div className="relative">
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="np. player1"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="pl-10"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-slate-300"
              >
                Hasło
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  className="pl-10 pr-10"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer p-1"
                  aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending}
              className="mt-2 w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              {isPending ? "Logowanie..." : "Zaloguj się"}
            </Button>
          </form>

          {/* Info Notice regarding registration */}
          <div className="mt-6 pt-4 border-t border-[#182645]/60 text-center">
            <p className="text-[11px] text-slate-400">
              🔒 Rejestracja publiczna jest wyłączona.
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              W razie problemów z dostępem skontaktuj się z administratorem ligi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
