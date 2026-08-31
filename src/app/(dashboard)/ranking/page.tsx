import { Trophy, Flame, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RankingPlayer {
  rank: number;
  name: string;
  username: string;
  points: number;
  exactCount: number;
  diffCount: number;
  outcomeCount: number;
  streak: number;
}

const mockFullRanking: RankingPlayer[] = [
  { rank: 1, name: "Bartosz", username: "bartosz", points: 1250, exactCount: 18, diffCount: 12, outcomeCount: 8, streak: 5 },
  { rank: 2, name: "Michał", username: "michal", points: 1120, exactCount: 15, diffCount: 14, outcomeCount: 9, streak: 3 },
  { rank: 3, name: "Kamil", username: "kamil", points: 980, exactCount: 12, diffCount: 10, outcomeCount: 14, streak: 2 },
  { rank: 4, name: "Dominik", username: "dominik", points: 870, exactCount: 10, diffCount: 11, outcomeCount: 12, streak: 1 },
  { rank: 5, name: "Paweł", username: "pawel", points: 760, exactCount: 8, diffCount: 9, outcomeCount: 15, streak: 0 },
  { rank: 6, name: "Mateusz", username: "mateusz", points: 710, exactCount: 7, diffCount: 10, outcomeCount: 12, streak: 1 },
  { rank: 7, name: "Tomasz", username: "tomasz", points: 680, exactCount: 6, diffCount: 8, outcomeCount: 16, streak: 0 },
  { rank: 8, name: "Krzysztof", username: "krzysztof", points: 620, exactCount: 5, diffCount: 9, outcomeCount: 14, streak: 2 },
  { rank: 9, name: "Piotr", username: "piotr", points: 590, exactCount: 4, diffCount: 11, outcomeCount: 11, streak: 0 },
  { rank: 10, name: "Łukasz", username: "lukasz", points: 540, exactCount: 4, diffCount: 8, outcomeCount: 12, streak: 1 },
];

export default function RankingPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Trophy className="w-3.5 h-3.5" />
          Tabela ligowa typerów
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Ranking Główny
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Klasyfikacja generalna po wszystkich kolejkach. Punkty są naliczane automatycznie po zakończeniu spotkań.
        </p>
      </div>

      {/* Main Ranking Table Card */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] overflow-hidden shadow-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#101d36] text-xs font-semibold text-slate-400 border-b border-[#182645]">
                <tr>
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4">Gracz</th>
                  <th className="py-3.5 px-4 text-center hidden sm:table-cell">Dokładne (3 pkt)</th>
                  <th className="py-3.5 px-4 text-center hidden sm:table-cell">Różnica (2 pkt)</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">Rezultat (1 pkt)</th>
                  <th className="py-3.5 px-4 text-center hidden lg:table-cell">Seria</th>
                  <th className="py-3.5 px-4 text-right">Punkty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182645]/60">
                {mockFullRanking.map((player) => {
                  const is1st = player.rank === 1;
                  const is2nd = player.rank === 2;
                  const is3rd = player.rank === 3;

                  return (
                    <tr
                      key={player.username}
                      className={cn(
                        "hover:bg-[#162444]/40 transition-colors",
                        is1st && "bg-amber-500/5"
                      )}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center">
                        <div
                          className={cn(
                            "w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-bold",
                            is1st && "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30",
                            is2nd && "bg-slate-300 text-slate-950",
                            is3rd && "bg-amber-700 text-white",
                            player.rank > 3 && "text-slate-400"
                          )}
                        >
                          {player.rank}
                        </div>
                      </td>

                      {/* Player Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 border border-blue-500/20">
                            <AvatarFallback className="bg-[#162444] text-xs text-blue-300 font-bold">
                              {player.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {player.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              @{player.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="py-3.5 px-4 text-center hidden sm:table-cell text-slate-300 font-medium">
                        {player.exactCount}
                      </td>
                      <td className="py-3.5 px-4 text-center hidden sm:table-cell text-slate-300 font-medium">
                        {player.diffCount}
                      </td>
                      <td className="py-3.5 px-4 text-center hidden md:table-cell text-slate-300 font-medium">
                        {player.outcomeCount}
                      </td>
                      <td className="py-3.5 px-4 text-center hidden lg:table-cell">
                        {player.streak > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                            <span>{player.streak}</span>
                            <Flame className="w-3.5 h-3.5 fill-amber-400" />
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>

                      {/* Total Points */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-blue-400 text-base">
                        {new Intl.NumberFormat("pl-PL").format(player.points)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
