"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MatchStatus } from "@/types/database.types";

export interface RealtimeMatchPayload {
  id: string;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  last_synced_at: string | null;
  is_manual_override: boolean;
  is_betting_locked: boolean;
}

interface UseRealtimeMatchesOptions {
  onMatchUpdate: (payload: RealtimeMatchPayload) => void;
  enabled?: boolean;
}

/**
 * React hook that subscribes to Supabase Realtime UPDATE events on 'matches' table.
 * Seamlessly updates UI state without requiring full page reload or client polling.
 */
export function useRealtimeMatches({ onMatchUpdate, enabled = true }: UseRealtimeMatchesOptions) {
  useEffect(() => {
    if (!enabled) return;

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (err) {
      console.warn("Supabase client initialization skipped for Realtime:", err);
      return;
    }

    const channelName = `realtime_matches_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object" && "id" in payload.new) {
            const raw = payload.new as any;
            onMatchUpdate({
              id: raw.id,
              home_score: raw.home_score ?? null,
              away_score: raw.away_score ?? null,
              status: raw.status as MatchStatus,
              last_synced_at: raw.last_synced_at ?? null,
              is_manual_override: Boolean(raw.is_manual_override),
              is_betting_locked: Boolean(raw.is_betting_locked),
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("Supabase Realtime subscription error (falling back to standard navigation):", err);
        }
      });

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [enabled, onMatchUpdate]);
}
