import { describe, it, expect } from "vitest";
import { calculateEstimatedClock } from "./clock-estimator";

describe("Live Match Clock Estimator (calculateEstimatedClock)", () => {
  const kickoff = "2026-09-03T15:00:00.000Z";
  const kickoffMs = new Date(kickoff).getTime();

  it("returns FT when mapped status is finished or raw status is FINISHED", () => {
    const res1 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "FINISHED",
      mappedStatus: "finished",
    });
    expect(res1.display).toBe("FT");
    expect(res1.phase).toBe("finished");
    expect(res1.source).toBe("status_override");

    const res2 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "finished",
    });
    expect(res2.display).toBe("FT");
  });

  it("returns PRZERWA when raw status is HT", () => {
    const res = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "HT",
      mappedStatus: "live",
      now: kickoffMs + 30 * 60 * 1000,
    });
    expect(res.display).toBe("PRZERWA");
    expect(res.phase).toBe("half_time");
    expect(res.source).toBe("status_override");
  });

  it("calculates 1st half minutes accurately with tilde", () => {
    // 10 minutes in
    const res10 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "live",
      now: kickoffMs + 10 * 60 * 1000 + 15000,
    });
    expect(res10.display).toBe("~10'");
    expect(res10.phase).toBe("first_half");
    expect(res10.source).toBe("kickoff_estimate");

    // 44 minutes in
    const res44 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "live",
      now: kickoffMs + 44 * 60 * 1000,
    });
    expect(res44.display).toBe("~44'");
    expect(res44.phase).toBe("first_half");
  });

  it("handles half-time transition window (~46m to ~65m) as PRZERWA fallback", () => {
    // 55 minutes after kickoff (1st half injury time + 15m break)
    const res55 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "live",
      now: kickoffMs + 55 * 60 * 1000,
    });
    expect(res55.display).toBe("PRZERWA");
    expect(res55.phase).toBe("half_time");
  });

  it("calculates 2nd half minutes accurately after ~65m", () => {
    // 75 minutes after kickoff (approx ~55th minute of play: 45 + (75 - 65) = 55)
    const res75 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "live",
      now: kickoffMs + 75 * 60 * 1000,
    });
    expect(res75.display).toBe("~55'");
    expect(res75.phase).toBe("second_half");

    // 100 minutes after kickoff (approx ~80th minute)
    const res100 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "live",
      now: kickoffMs + 100 * 60 * 1000,
    });
    expect(res100.display).toBe("~80'");
    expect(res100.phase).toBe("second_half");
  });

  it("shows ~90+' in stoppage time (>110m)", () => {
    const res115 = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "live",
      now: kickoffMs + 115 * 60 * 1000,
    });
    expect(res115.display).toBe("~90+'");
    expect(res115.phase).toBe("stoppage_time");
  });

  it("adjusts anchor when a genuine event has a higher verified minute", () => {
    // Wall clock estimate is 20m, but event (goal) happened at 35'
    const resAnchored = calculateEstimatedClock({
      kickoffUtc: kickoff,
      rawStatus: "LIVE",
      mappedStatus: "live",
      latestEventMinute: 35,
      latestEventDescription: "Goal - J. Ekuban (35')",
      now: kickoffMs + 20 * 60 * 1000,
    });
    expect(resAnchored.display).toBe("~35'");
    expect(resAnchored.numericMinute).toBe(35);
    expect(resAnchored.source).toBe("event_anchor");
    expect(resAnchored.sourceLabel).toContain("J. Ekuban");
  });
});
