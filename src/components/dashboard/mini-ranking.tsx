import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MiniRankingUser {
  rank: number;
  username: string;
  name: string;
  avatarUrl?: string | null;
  points: number;
}

const mockRanking: MiniRankingUser[] = [
  { rank: 1, username: "bartosz", name: "Bartosz", points: 1250 },
  { rank: 2, username: "michal", name: "Michał", points: 1120 },
  { rank: 3, username: "kamil", name: "Kamil", points: 980 },
  { rank: 4, username: "dominik", name: "Dominik", points: 870 },
  { rank: 5, username: "pawel", name: "Paweł", points: 760 },
];

export function MiniRanking() {
  return (
    <Card className="rounded-3xl border-[#182645] bg-[#0c1527] overflow-hidden shadow-xl">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg font-bold text-white tracking-tight flex items-center justify-between">
          <span>Ranking</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-0 flex flex-col gap-4">
        {/* Podium Graphic (Places 2, 1, 3) */}
        <div className="flex items-end justify-center gap-2 pt-3 pb-2 px-2 border-b border-[#182645]/60">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold text-slate-400 mb-1">Michał</span>
            <div className="w-14 h-12 rounded-t-xl bg-gradient-to-t from-slate-700/40 to-slate-500/20 border-t-2 border-slate-400 flex items-center justify-center font-bold text-slate-300 text-sm shadow-inner">
              2
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 animate-bounce mb-0.5" />
            <span className="text-[10px] font-bold text-amber-300 mb-1">Bartosz</span>
            <div className="w-16 h-18 rounded-t-xl bg-gradient-to-t from-amber-600/40 to-amber-400/20 border-t-2 border-amber-400 flex items-center justify-center font-extrabold text-amber-300 text-base shadow-lg shadow-amber-500/10">
              1
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold text-slate-400 mb-1">Kamil</span>
            <div className="w-14 h-10 rounded-t-xl bg-gradient-to-t from-amber-800/40 to-amber-700/20 border-t-2 border-amber-600 flex items-center justify-center font-bold text-amber-500 text-sm shadow-inner">
              3
            </div>
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="flex flex-col gap-1.5">
          {mockRanking.map((user) => {
            const isFirst = user.rank === 1;
            const isSecond = user.rank === 2;
            const isThird = user.rank === 3;

            return (
              <Link
                key={user.username}
                href={`/profil/${user.username}`}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-[#162444]/60 transition-all group"
              >
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      isFirst && "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30",
                      isSecond && "bg-slate-300 text-slate-950",
                      isThird && "bg-amber-700 text-white",
                      user.rank > 3 && "text-slate-400 font-semibold"
                    )}
                  >
                    {user.rank}
                  </div>

                  {/* Avatar */}
                  <Avatar className="w-7 h-7 border border-blue-500/20">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="bg-[#162444] text-[10px] text-blue-300 font-bold">
                      {user.name[0]}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name */}
                  <span className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {user.name}
                  </span>
                </div>

                {/* Points */}
                <span className="text-xs font-bold text-blue-400">
                  {new Intl.NumberFormat("pl-PL").format(user.points)} pkt
                </span>
              </Link>
            );
          })}
        </div>

        {/* Full Ranking Link */}
        <div className="pt-1 border-t border-[#182645]/60 text-center">
          <Link
            href="/ranking"
            className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors py-1"
          >
            <span>Pełny ranking</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
