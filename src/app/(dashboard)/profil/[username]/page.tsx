import { User, Trophy, Flame, Target, Lock, CheckCircle, Award } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Profile Header Card */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-blue-500/40 shadow-xl">
            <AvatarFallback className="bg-gradient-to-br from-blue-900 to-indigo-950 text-2xl font-bold text-blue-300">
              {username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {username === "bartosz" ? "Bartosz Kowalski" : username}
              </h1>
              <Badge variant="gold">#1 w rankingu</Badge>
            </div>
            <span className="text-sm text-slate-400 font-medium">@{username}</span>

            {/* Quick Metrics */}
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

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Dokładne (3 pkt)</span>
          <div className="text-xl font-extrabold text-white mt-1">18</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Różnica bramek (2 pkt)</span>
          <div className="text-xl font-extrabold text-white mt-1">12</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Rezultat (1 pkt)</span>
          <div className="text-xl font-extrabold text-white mt-1">8</div>
        </Card>
        <Card className="rounded-2xl border-[#182645] bg-[#0c1527] p-4 text-center">
          <span className="text-xs text-slate-400">Nietrafione</span>
          <div className="text-xl font-extrabold text-red-400 mt-1">6</div>
        </Card>
      </div>

      {/* Predictions History */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">Historia typów</h2>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#101d36] border border-[#182645]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">Jutro 21:00</span>
              <span className="text-sm font-semibold text-white">Real Madryt vs Man City</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Typ ukryty do rozpoczęcia meczu</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
