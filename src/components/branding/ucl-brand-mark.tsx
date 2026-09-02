import React from "react";

interface UclBrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * Geometric UEFA Champions League Starball brand mark.
 * High-precision inline vector SVG with celestial gradient and crisp star geometry.
 */
export function UclBrandMark({ size = 32, className = "" }: UclBrandMarkProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#1d4ed8] via-[#1e3a8a] to-[#0f172a] shadow-md shadow-blue-600/30 border border-blue-400/30 shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[72%] h-[72%] text-white drop-shadow-[0_0_6px_rgba(147,197,253,0.6)]"
      >
        <defs>
          <linearGradient id="uclStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#c7d2fe" />
          </linearGradient>
        </defs>

        {/* Outer Circular Starball Arcs */}
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="url(#uclStarGrad)"
          strokeWidth="1.5"
          strokeDasharray="4 8"
          opacity="0.4"
        />

        {/* 8 Geometric Stars of Champions League Starball */}
        {/* Top */}
        <path
          d="M50 8 L53 20 L65 20 L55 27 L59 39 L50 32 L41 39 L45 27 L35 20 L47 20 Z"
          fill="url(#uclStarGrad)"
        />
        {/* Top-Right */}
        <path
          d="M80 20 L78 32 L89 37 L77 41 L76 53 L69 43 L58 48 L65 38 L59 28 L70 31 Z"
          fill="url(#uclStarGrad)"
          transform="scale(0.85) translate(14, 2)"
        />
        {/* Right */}
        <path
          d="M92 50 L80 53 L80 65 L73 55 L61 59 L68 50 L61 41 L73 45 L80 35 L80 47 Z"
          fill="url(#uclStarGrad)"
          transform="scale(0.85) translate(14, 10)"
        />
        {/* Bottom-Right */}
        <path
          d="M80 80 L68 78 L63 89 L59 77 L47 76 L57 69 L52 58 L62 65 L72 59 L69 70 Z"
          fill="url(#uclStarGrad)"
          transform="scale(0.85) translate(8, 14)"
        />
        {/* Bottom */}
        <path
          d="M50 92 L47 80 L35 80 L45 73 L41 61 L50 68 L59 61 L55 73 L65 80 L53 80 Z"
          fill="url(#uclStarGrad)"
        />
        {/* Bottom-Left */}
        <path
          d="M20 80 L32 78 L37 89 L41 77 L53 76 L43 69 L48 58 L38 65 L28 59 L31 70 Z"
          fill="url(#uclStarGrad)"
          transform="scale(0.85) translate(2, 14)"
        />
        {/* Left */}
        <path
          d="M8 50 L20 47 L20 35 L27 45 L39 41 L32 50 L39 59 L27 55 L20 65 L20 53 Z"
          fill="url(#uclStarGrad)"
          transform="scale(0.85) translate(2, 10)"
        />
        {/* Top-Left */}
        <path
          d="M20 20 L22 32 L11 37 L23 41 L24 53 L31 43 L42 48 L35 38 L41 28 L30 31 Z"
          fill="url(#uclStarGrad)"
          transform="scale(0.85) translate(2, 2)"
        />

        {/* Central Core Star Refraction */}
        <circle cx="50" cy="50" r="6" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
}
