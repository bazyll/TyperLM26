import React from "react";

interface UclHeaderAccentProps {
  className?: string;
}

/**
 * Subtle prism light line with a micro star mark for key page headers.
 * Adds authentic UEFA Champions League visual polish without layout changes.
 */
export function UclHeaderAccent({ className = "" }: UclHeaderAccentProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center w-full max-w-xs mt-1.5 mb-1 ${className}`}
    >
      {/* 1px Light Prism Line */}
      <div className="h-[1.5px] w-full bg-gradient-to-r from-cyan-400/60 via-blue-500/40 to-transparent rounded-full" />

      {/* Subtle Micro Star Dot */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-cyan-300 shadow-[0_0_6px_#38bdf8]" />
    </div>
  );
}
