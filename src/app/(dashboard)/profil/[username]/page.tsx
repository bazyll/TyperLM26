import { notFound } from "next/navigation";
import { User, Trophy, Flame, Lock, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const normalizedUsername = decodeURIComponent(username).toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", normalizedUsername)
    .maybeSingle();

  const profile = data as ProfileRow | null;

  if (error || !profile) {
    notFound();
  }

  const initials = `${profile.first_name[0] || "U"}${profile.last_name[0] || ""}`;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Profile Header Card */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-blue-500/40 shadow-xl">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.first_name} />}
            <AvatarFallback className="bg-gradient-to-br from-blue-900 to-indigo-950 text-2xl font-bold text-blue-300">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {profile.first_name} {profile.last_name}
              </h1>
              {profile.role === "admin" && (
                <Badge variant="default" className="gap-1">
                  <Shield className="w-3 h-3 text-blue-400" />
                  Admin
                </Badge>
              )}
              {!profile.is_active && (
                <Badge variant="destructive">Konto nieaktywne</Badge>
              )}
            </div>
            <span className="text-sm text-slate-400 font-medium">@{profile.username}</span>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3">
              <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                <span className="text-[11px] text-slate-400">Punkty</span>
                <div className="text-lg font-extrabold text-blue-400">0 pkt</div>
              </div>
              <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                <span className="text-[11px] text-slate-400">Skuteczność</span>
                <div className="text-lg font-extrabold text-emerald-400">-</div>
              </div>
              <div className="px-4 py-2 rounded-xl bg-[#162444]/60 border border-[#182645] text-center">
                <span className="text-[11px] text-slate-400">Seria</span>
                <div className="text-lg font-extrabold text-amber-400 flex items-center justify-center gap-1">
                  <span>-</span>
                  <Flame className="w-4 h-4 fill-amber-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Detailed Stats Grid Placeholder */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Dokładne (3 pkt)</span>
          <div className="text-xl font-extrabold text-white mt-1">-</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Różnica bramek (2 pkt)</span>
          <div className="text-xl font-extrabold text-white mt-1">-</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Rezultat (1 pkt)</span>
          <div className="text-xl font-extrabold text-white mt-1">-</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Nietrafione</span>
          <div className="text-xl font-extrabold text-slate-400 mt-1">-</div>
        </Card>
      </div>

      {/* Predictions History */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">Historia typów</h2>
        <div className="flex flex-col gap-2.5">
          <div className="p-6 text-center text-xs text-slate-500 rounded-2xl bg-[#101d36]/40 border border-[#182645]">
            Brak zakończonych spotkań w historii typów.
          </div>
        </div>
      </Card>
    </div>
  );
}
