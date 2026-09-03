"use client";

import React from "react";
import { Trophy, Shield, Info, Calendar } from "lucide-react";

export interface KnockoutTeam {
  id: string;
  name: string;
  shortName?: string;
  code?: string;
  logoUrl?: string | null;
}

export interface KnockoutLeg {
  homeScore?: number | null;
  awayScore?: number | null;
  kickoffAt?: string | null;
  status?: "scheduled" | "live" | "finished";
}

export interface KnockoutTieNode {
  id: string;
  round: "playoffs" | "r16" | "qf" | "sf" | "final";
  tieNumber: number;
  label: string;
  teamA?: KnockoutTeam;
  teamB?: KnockoutTeam;
  isSingleLeg?: boolean; // true for Final
  leg1?: KnockoutLeg;
  leg2?: KnockoutLeg;
  aggregateScore?: { teamA: number; teamB: number };
  winnerTeamId?: string | null;
  userPickWinnerId?: string | null;
}

// Generate placeholder bracket ties for the UCL Knockout Phase
function generatePlaceholderTies(): Record<string, KnockoutTieNode[]> {
  const playoffs: KnockoutTieNode[] = Array.from({ length: 8 }, (_, i) => ({
    id: `po-${i + 1}`,
    round: "playoffs",
    tieNumber: i + 1,
    label: `Baraż ${i + 1}`,
  }));

  const r16: KnockoutTieNode[] = Array.from({ length: 8 }, (_, i) => ({
    id: `r16-${i + 1}`,
    round: "r16",
    tieNumber: i + 1,
    label: `1/8 finału ${i + 1}`,
  }));

  const qf: KnockoutTieNode[] = Array.from({ length: 4 }, (_, i) => ({
    id: `qf-${i + 1}`,
    round: "qf",
    tieNumber: i + 1,
    label: `Ćwierćfinał ${i + 1}`,
  }));

  const sf: KnockoutTieNode[] = Array.from({ length: 2 }, (_, i) => ({
    id: `sf-${i + 1}`,
    round: "sf",
    tieNumber: i + 1,
    label: `Półfinał ${i + 1}`,
  }));

  const final: KnockoutTieNode[] = [
    {
      id: "final-1",
      round: "final",
      tieNumber: 1,
      label: "Finał UCL 2027",
      isSingleLeg: true,
    },
  ];

  return { playoffs, r16, qf, sf, final };
}

interface KnockoutBracketProps {
  ties?: Record<string, KnockoutTieNode[]>;
}

export function KnockoutBracket({ ties }: KnockoutBracketProps) {
  const bracketData = ties || generatePlaceholderTies();

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Disclaimer / Info Header */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-300">
        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>
          Pary fazy pucharowej (baraże i 1/8 finału) zostaną wyłonione automatycznie po zakończeniu fazy ligowej. Wtedy też wystartuje dedykowany Pick&apos;em pucharowy.
        </span>
      </div>

      {/* Responsive Bracket Container with Horizontal Scroll on Mobile */}
      <div className="w-full overflow-x-auto pb-6 pt-2 no-scrollbar">
        <div className="min-w-[1000px] grid grid-cols-5 gap-4 items-center">
          {/* Column 1: Play-offs */}
          <BracketColumn
            title="Baraże o 1/8"
            subtitle="8 dwumeczów (miejsca 9–24)"
            ties={bracketData.playoffs}
          />

          {/* Column 2: Round of 16 */}
          <BracketColumn
            title="1/8 finału"
            subtitle="8 dwumeczów (TOP 8 + wygrani)"
            ties={bracketData.r16}
          />

          {/* Column 3: Quarter-finals */}
          <BracketColumn
            title="Ćwierćfinały"
            subtitle="4 dwumecze"
            ties={bracketData.qf}
          />

          {/* Column 4: Semi-finals */}
          <BracketColumn
            title="Półfinały"
            subtitle="2 dwumecze"
            ties={bracketData.sf}
          />

          {/* Column 5: Final */}
          <BracketColumn
            title="Finał"
            subtitle="1 mecz mistrzowski"
            ties={bracketData.final}
            isFinalColumn
          />
        </div>
      </div>
    </div>
  );
}

function BracketColumn({
  title,
  subtitle,
  ties,
  isFinalColumn = false,
}: {
  title: string;
  subtitle: string;
  ties: KnockoutTieNode[];
  isFinalColumn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Column Header */}
      <div className="text-center pb-2 border-b border-[#182645]/80">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h3>
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {/* Ties List */}
      <div className={`flex flex-col justify-around gap-3 min-h-[580px]`}>
        {ties.map((tie) => (
          <TieCard key={tie.id} tie={tie} isFinal={isFinalColumn} />
        ))}
      </div>
    </div>
  );
}

function TieCard({ tie, isFinal }: { tie: KnockoutTieNode; isFinal?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-2.5 transition-all ${
        isFinal
          ? "bg-gradient-to-b from-blue-950/40 via-[#0c1527] to-[#070b14] border-blue-500/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
          : "bg-[#0c1527]/90 border-[#182645] hover:border-blue-500/30"
      }`}
    >
      {/* Tie Header */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-2">
        <span className="truncate">{tie.label}</span>
        {isFinal ? (
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            <Trophy className="w-3 h-3" /> Finał
          </span>
        ) : (
          <span className="text-[9px] text-slate-500 uppercase">Dwumecz</span>
        )}
      </div>

      {/* Team A */}
      <div className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg bg-[#101d36]/50 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 rounded-full bg-[#182645] flex items-center justify-center text-[8px] font-bold text-slate-400 shrink-0">
            {tie.teamA?.code || "—"}
          </div>
          <span className="text-xs font-semibold text-slate-300 truncate">
            {tie.teamA?.name || "TBD"}
          </span>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {tie.aggregateScore?.teamA ?? "-"}
        </span>
      </div>

      {/* Team B */}
      <div className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg bg-[#101d36]/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 rounded-full bg-[#182645] flex items-center justify-center text-[8px] font-bold text-slate-400 shrink-0">
            {tie.teamB?.code || "—"}
          </div>
          <span className="text-xs font-semibold text-slate-300 truncate">
            {tie.teamB?.name || "TBD"}
          </span>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {tie.aggregateScore?.teamB ?? "-"}
        </span>
      </div>
    </div>
  );
}
