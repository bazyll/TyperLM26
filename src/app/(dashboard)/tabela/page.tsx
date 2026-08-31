import { Table as TableIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockUCLTable = [
  { rank: 1, name: "Manchester City", code: "MCI", played: 1, won: 1, drawn: 0, lost: 0, gf: 3, ga: 0, gd: 3, pts: 3, zone: "top8" },
  { rank: 2, name: "Real Madryt", code: "RMA", played: 1, won: 1, drawn: 0, lost: 0, gf: 3, ga: 1, gd: 2, pts: 3, zone: "top8" },
  { rank: 3, name: "Bayern Monachium", code: "BAY", played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 0, gd: 2, pts: 3, zone: "top8" },
  { rank: 4, name: "Arsenal FC", code: "ARS", played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 1, gd: 1, pts: 3, zone: "top8" },
  { rank: 5, name: "FC Barcelona", code: "BAR", played: 1, won: 1, drawn: 0, lost: 0, gf: 1, ga: 0, gd: 1, pts: 3, zone: "top8" },
  { rank: 6, name: "Liverpool FC", code: "LIV", played: 1, won: 1, drawn: 0, lost: 0, gf: 1, ga: 0, gd: 1, pts: 3, zone: "top8" },
  { rank: 7, name: "PSG", code: "PSG", played: 1, won: 0, drawn: 1, lost: 0, gf: 1, ga: 1, gd: 0, pts: 1, zone: "top8" },
  { rank: 8, name: "Inter Mediolan", code: "INT", played: 1, won: 0, drawn: 1, lost: 0, gf: 1, ga: 1, gd: 0, pts: 1, zone: "top8" },
  { rank: 9, name: "Bayer Leverkusen", code: "B04", played: 1, won: 0, drawn: 1, lost: 0, gf: 0, ga: 0, gd: 0, pts: 1, zone: "playoff" },
  { rank: 10, name: "Borussia Dortmund", code: "BVB", played: 1, won: 0, drawn: 1, lost: 0, gf: 0, ga: 0, gd: 0, pts: 1, zone: "playoff" },
];

export default function TablePage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <TableIcon className="w-3.5 h-3.5" />
          Faza ligowa Champions League
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Tabela Ligi Mistrzów 2026/2027
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Tabela jest wyliczana w 100% automatycznie z wprowadzonych wyników spotkań według oficjalnych kryteriów i tiebreakerów UEFA.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-500/80 border border-blue-400" />
          <span className="text-slate-300">1–8: Bezpośredni awans do 1/8 finału</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-400/60" />
          <span className="text-slate-300">9–24: Play-offy fazy pucharowej</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500/30 border border-red-400/40" />
          <span className="text-slate-300">25–36: Eliminacja</span>
        </div>
      </div>

      {/* Table Card */}
      <Card className="rounded-3xl border-[#182645] bg-[#0c1527] overflow-hidden shadow-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#101d36] text-xs font-semibold text-slate-400 border-b border-[#182645]">
                <tr>
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4">Drużyna</th>
                  <th className="py-3.5 px-3 text-center">M</th>
                  <th className="py-3.5 px-3 text-center hidden sm:table-cell">W</th>
                  <th className="py-3.5 px-3 text-center hidden sm:table-cell">R</th>
                  <th className="py-3.5 px-3 text-center hidden sm:table-cell">P</th>
                  <th className="py-3.5 px-3 text-center hidden md:table-cell">Gole</th>
                  <th className="py-3.5 px-3 text-center">+/-</th>
                  <th className="py-3.5 px-4 text-right">Pkt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182645]/60">
                {mockUCLTable.map((row) => (
                  <tr key={row.code} className="hover:bg-[#162444]/40 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          row.zone === "top8"
                            ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {row.name}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-300">{row.played}</td>
                    <td className="py-3 px-3 text-center text-slate-300 hidden sm:table-cell">{row.won}</td>
                    <td className="py-3 px-3 text-center text-slate-300 hidden sm:table-cell">{row.drawn}</td>
                    <td className="py-3 px-3 text-center text-slate-300 hidden sm:table-cell">{row.lost}</td>
                    <td className="py-3 px-3 text-center text-slate-300 hidden md:table-cell">{row.gf}:{row.ga}</td>
                    <td className="py-3 px-3 text-center font-medium text-slate-300">
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-blue-400">
                      {row.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
