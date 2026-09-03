/**
 * Live Match Clock Estimator (Sandbox Diagnostic Feature)
 *
 * Algorithm:
 * - Status HT has absolute priority -> "PRZERWA"
 * - Status FT/FINISHED has absolute priority -> "FT"
 * - Status POSTPONED -> "ODŁOŻONY"
 * - 0m .. 45m from kickoffUtc -> ~1' .. ~45' (first_half)
 * - 46m .. 65m from kickoffUtc (~20m buffer for injury time + break) -> "PRZERWA" (half_time)
 * - 66m .. 110m from kickoffUtc -> ~46' .. ~90' (second_half)
 * - >110m -> ~90+' (stoppage_time)
 * - Anchor Correction: If a genuine event (goal/card) has a higher minute, anchors to that minute.
 */

export interface EstimatedClockResult {
  display: string;
  numericMinute: number | null;
  source: "event_anchor" | "kickoff_estimate" | "status_override";
  sourceLabel: string;
  phase: "first_half" | "half_time" | "second_half" | "stoppage_time" | "finished" | "scheduled";
}

export function calculateEstimatedClock(input: {
  kickoffUtc: string;
  rawStatus: string;
  mappedStatus: "scheduled" | "live" | "finished" | "postponed";
  latestEventMinute?: number | null;
  latestEventDescription?: string | null;
  now?: number;
}): EstimatedClockResult {
  const rawStatusUpper = (input.rawStatus || "").trim().toUpperCase();

  // 1. Terminal & Status Overrides
  if (input.mappedStatus === "finished" || rawStatusUpper === "FINISHED" || rawStatusUpper === "FT") {
    return {
      display: "FT",
      numericMinute: 90,
      source: "status_override",
      sourceLabel: "Oficjalny status providera: FINISHED",
      phase: "finished",
    };
  }

  if (input.mappedStatus === "postponed" || rawStatusUpper === "POSTPONED") {
    return {
      display: "ODŁOŻONY",
      numericMinute: null,
      source: "status_override",
      sourceLabel: "Oficjalny status providera: POSTPONED",
      phase: "scheduled",
    };
  }

  if (rawStatusUpper === "HT" || rawStatusUpper === "HALF_TIME" || rawStatusUpper === "HALFTIME") {
    return {
      display: "PRZERWA",
      numericMinute: 45,
      source: "status_override",
      sourceLabel: "Oficjalny status providera: HT (Przerwa)",
      phase: "half_time",
    };
  }

  const nowMs = input.now ?? Date.now();
  const kickoffMs = new Date(input.kickoffUtc).getTime();

  if (isNaN(kickoffMs)) {
    return {
      display: "LIVE",
      numericMinute: null,
      source: "status_override",
      sourceLabel: "Brak daty rozpoczęcia",
      phase: "first_half",
    };
  }

  const elapsedMs = nowMs - kickoffMs;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes < 0) {
    return {
      display: new Date(input.kickoffUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      numericMinute: 0,
      source: "status_override",
      sourceLabel: "Przed rozpoczęciem meczu",
      phase: "scheduled",
    };
  }

  // 2. Phased estimation based on elapsed minutes
  let estimatedMinute = 1;
  let phase: EstimatedClockResult["phase"] = "first_half";
  let display = "~1'";

  if (elapsedMinutes < 1) {
    estimatedMinute = 1;
    display = "~1'";
    phase = "first_half";
  } else if (elapsedMinutes <= 45) {
    estimatedMinute = elapsedMinutes;
    display = `~${estimatedMinute}'`;
    phase = "first_half";
  } else if (elapsedMinutes <= 65) {
    estimatedMinute = 45;
    display = "PRZERWA";
    phase = "half_time";
  } else if (elapsedMinutes <= 110) {
    const secondHalfElapsed = elapsedMinutes - 65;
    estimatedMinute = Math.min(90, 45 + secondHalfElapsed);
    display = `~${estimatedMinute}'`;
    phase = "second_half";
  } else {
    estimatedMinute = 90;
    display = "~90+'";
    phase = "stoppage_time";
  }

  // 3. Event Anchor correction (if genuine event has a verified higher minute)
  if (input.latestEventMinute && input.latestEventMinute > 0) {
    if (input.latestEventMinute > estimatedMinute) {
      return {
        display: `~${input.latestEventMinute}'`,
        numericMinute: input.latestEventMinute,
        source: "event_anchor",
        sourceLabel: `Kotwica zdarzenia: ${input.latestEventDescription || `minuta ${input.latestEventMinute}'`}`,
        phase,
      };
    }
  }

  const kickoffTimeStr = new Date(input.kickoffUtc).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return {
    display,
    numericMinute: estimatedMinute,
    source: "kickoff_estimate",
    sourceLabel: `Estymacja z kickoff (${kickoffTimeStr} UTC)`,
    phase,
  };
}
