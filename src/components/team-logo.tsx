"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface TeamLogoProps {
  logoUrl?: string | null;
  teamName: string;
  teamCode?: string | null;
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  fallbackClassName?: string;
  priority?: boolean;
}

export function getTeamFallbackText(name?: string, code?: string | null): string {
  if (code && code.trim().length > 0) {
    return code.trim().toUpperCase();
  }
  if (!name || !name.trim()) {
    return "FC";
  }
  const cleanName = name.trim();
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    const initials = (words[0][0] + words[1][0]).toUpperCase();
    return initials;
  }
  return cleanName.slice(0, 3).toUpperCase();
}

/**
 * Reusable Team Logo component with resilient fallback.
 * 
 * Rules:
 * - If logoUrl is a valid non-empty string, renders next/image.
 * - If logoUrl is null, undefined, "", or whitespace, renders an aesthetic badge fallback.
 * - If image fails to load, gracefully falls back to the badge.
 */
export function TeamLogo({
  logoUrl,
  teamName,
  teamCode,
  size,
  width,
  height,
  className,
  fallbackClassName,
  priority = false,
}: TeamLogoProps) {
  const [imageError, setImageError] = useState(false);

  const cleanUrl = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const hasValidUrl = cleanUrl.length > 0;

  useEffect(() => {
    setImageError(false);
  }, [cleanUrl]);

  const targetWidth = width || size;
  const targetHeight = height || size;
  const fallbackText = getTeamFallbackText(teamName, teamCode);

  // Dynamic font sizing for fallback badge if size is known
  const effectiveSize = targetWidth || targetHeight || 32;
  const fontSizeClass =
    effectiveSize <= 22
      ? "text-[9px] tracking-tighter"
      : effectiveSize <= 28
      ? "text-[10px] tracking-tight"
      : effectiveSize <= 36
      ? "text-xs tracking-normal"
      : effectiveSize <= 48
      ? "text-sm tracking-wider"
      : "text-base tracking-wider";

  if (!hasValidUrl || imageError) {
    const sizeStyle =
      targetWidth && targetHeight
        ? { width: `${targetWidth}px`, height: `${targetHeight}px` }
        : undefined;

    return (
      <div
        data-testid="team-logo-fallback"
        style={sizeStyle}
        className={cn(
          "w-full h-full flex items-center justify-center rounded-full bg-gradient-to-br from-[#162444] to-[#0d172e] border border-blue-500/30 text-blue-300 font-extrabold uppercase shadow-inner select-none shrink-0",
          fontSizeClass,
          fallbackClassName,
          className
        )}
        title={teamName}
        aria-label={teamName}
      >
        <span>{fallbackText}</span>
      </div>
    );
  }

  // Render Image
  if (targetWidth && targetHeight) {
    return (
      <Image
        data-testid="team-logo-image"
        src={cleanUrl}
        alt={teamName || fallbackText}
        width={targetWidth}
        height={targetHeight}
        priority={priority}
        unoptimized
        onError={() => setImageError(true)}
        className={cn("object-contain", className)}
      />
    );
  }

  return (
    <Image
      data-testid="team-logo-image"
      src={cleanUrl}
      alt={teamName || fallbackText}
      fill
      priority={priority}
      unoptimized
      onError={() => setImageError(true)}
      className={cn("object-contain", className)}
    />
  );
}
