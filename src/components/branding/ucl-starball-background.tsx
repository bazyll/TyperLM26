import React from "react";

/**
 * Ambient background lighting and subtle Starball constellation patterns
 * inspired by UEFA Champions League branding aesthetics.
 * Rendered with low opacity (4-8%) to ensure zero impact on readability.
 */
export function UclStarballBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
    >
      {/* 1. Ambient Lighting Glow Orbs */}
      {/* Top-Right: Deep Royal Blue & Cyan Glow */}
      <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-600/10 via-cyan-500/5 to-transparent blur-[120px]" />

      {/* Top-Left: Subtle Violet & Indigo Glow */}
      <div className="absolute top-1/4 -left-48 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-indigo-700/8 via-purple-600/5 to-transparent blur-[140px]" />

      {/* Bottom-Right: Deep Navy / Electric Stadium Light */}
      <div className="absolute -bottom-40 right-1/4 w-[700px] h-[500px] rounded-full bg-gradient-to-t from-blue-700/6 via-indigo-900/4 to-transparent blur-[160px]" />

      {/* 2. Vector Geometric Starball Constellation (Top-Right Corner) */}
      <svg
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute -top-16 -right-16 w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] text-blue-300 opacity-[0.05]"
      >
        {/* Concentric Spherical Curves */}
        <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1" strokeDasharray="6 10" />
        <circle cx="200" cy="200" r="140" stroke="currentColor" strokeWidth="0.75" />
        <circle cx="200" cy="200" r="90" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 6" />

        {/* Constellation Stars */}
        <path d="M200 30 L204 48 L222 48 L208 58 L213 76 L200 65 L187 76 L192 58 L178 48 L196 48 Z" fill="currentColor" />
        <path d="M330 110 L333 124 L347 124 L336 132 L340 146 L330 137 L320 146 L324 132 L313 124 L327 124 Z" fill="currentColor" />
        <path d="M360 230 L363 244 L377 244 L366 252 L370 266 L360 257 L350 266 L354 252 L343 244 L357 244 Z" fill="currentColor" />
        <path d="M290 330 L293 344 L307 344 L296 352 L300 366 L290 357 L280 366 L284 352 L273 344 L287 344 Z" fill="currentColor" />
        <path d="M110 330 L113 344 L127 344 L116 352 L120 366 L110 357 L100 366 L104 352 L93 344 L107 344 Z" fill="currentColor" />
        <path d="M40 230 L43 244 L57 244 L46 252 L50 266 L40 257 L30 266 L34 252 L23 244 L37 244 Z" fill="currentColor" />
        <path d="M70 110 L73 124 L87 124 L76 132 L80 146 L70 137 L60 146 L64 132 L53 124 L67 124 Z" fill="currentColor" />

        {/* Connecting Geometric Lines */}
        <line x1="200" y1="50" x2="330" y2="130" stroke="currentColor" strokeWidth="0.75" />
        <line x1="330" y1="130" x2="360" y2="250" stroke="currentColor" strokeWidth="0.75" />
        <line x1="360" y1="250" x2="290" y2="350" stroke="currentColor" strokeWidth="0.75" />
        <line x1="290" y1="350" x2="110" y2="350" stroke="currentColor" strokeWidth="0.75" />
        <line x1="110" y1="350" x2="40" y2="250" stroke="currentColor" strokeWidth="0.75" />
        <line x1="40" y1="250" x2="70" y2="130" stroke="currentColor" strokeWidth="0.75" />
        <line x1="70" y1="130" x2="200" y2="50" stroke="currentColor" strokeWidth="0.75" />
      </svg>

      {/* 3. Bottom-Left Stadium Arch Refraction */}
      <svg
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute -bottom-20 -left-20 w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] text-indigo-400 opacity-[0.04]"
      >
        <circle cx="150" cy="150" r="130" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
        <path d="M150 20 L153 34 L167 34 L156 42 L160 56 L150 47 L140 56 L144 42 L133 34 L147 34 Z" fill="currentColor" />
        <path d="M240 80 L243 94 L257 94 L246 102 L250 116 L240 107 L230 116 L234 102 L223 94 L237 94 Z" fill="currentColor" />
        <path d="M260 170 L263 184 L277 184 L266 192 L270 206 L260 197 L250 206 L254 192 L243 184 L257 184 Z" fill="currentColor" />
        <line x1="150" y1="40" x2="240" y2="100" stroke="currentColor" strokeWidth="0.5" />
        <line x1="240" y1="100" x2="260" y2="190" stroke="currentColor" strokeWidth="0.5" />
      </svg>
    </div>
  );
}
