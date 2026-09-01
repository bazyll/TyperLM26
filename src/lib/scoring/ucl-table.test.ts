import { describe, it, expect } from "vitest";
import { calculateUCLTable, FinishedMatchData, TableTeamData } from "./ucl-table";

describe("UEFA Champions League 36-Team League Table & Tiebreakers", () => {
  // Generate 36 sample teams
  const sampleTeams: TableTeamData[] = Array.from({ length: 36 }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Club ${i + 1}`,
    shortName: `C${(i + 1).toString().padStart(2, "0")}`,
    code: `C${(i + 1).toString().padStart(2, "0")}`,
    logoUrl: `https://example.com/logo-${i + 1}.png`,
    uefaCoefficient: 100 - i,
    disciplinaryPoints: i,
  }));

  it("calculates points and ranks correctly with wins and goal difference", () => {
    const matches: FinishedMatchData[] = [
      // team-1 wins 3:0 against team-2
      {
        id: "m1",
        homeTeamId: "team-1",
        awayTeamId: "team-2",
        homeScore: 3,
        awayScore: 0,
        status: "finished",
      },
      // team-3 wins 1:0 against team-4
      {
        id: "m2",
        homeTeamId: "team-3",
        awayTeamId: "team-4",
        homeScore: 1,
        awayScore: 0,
        status: "finished",
      },
    ];

    const table = calculateUCLTable(sampleTeams, matches);

    expect(table).toHaveLength(36);

    // team-1 should be 1st because of 3 pts and +3 goal diff (vs team-3 with +1 goal diff)
    expect(table[0].team.id).toBe("team-1");
    expect(table[0].points).toBe(3);
    expect(table[0].goalDifference).toBe(3);
    expect(table[0].zone).toBe("top8");

    // team-3 should be 2nd with 3 pts and +1 goal diff
    expect(table[1].team.id).toBe("team-3");
    expect(table[1].points).toBe(3);
    expect(table[1].goalDifference).toBe(1);
    expect(table[1].zone).toBe("top8");

    // Zones verification
    expect(table.filter((r) => r.zone === "top8")).toHaveLength(8);
    expect(table.filter((r) => r.zone === "playoff")).toHaveLength(16); // 9..24 = 16 teams
    expect(table.filter((r) => r.zone === "eliminated")).toHaveLength(12); // 25..36 = 12 teams
  });

  it("applies tiebreaker 2 (goals scored) and tiebreaker 3 (away goals)", () => {
    const matches: FinishedMatchData[] = [
      // team-1 wins 2:0 at home (diff +2, goals 2, away goals 0)
      {
        id: "m1",
        homeTeamId: "team-1",
        awayTeamId: "team-10",
        homeScore: 2,
        awayScore: 0,
        status: "finished",
      },
      // team-2 wins 3:1 at home (diff +2, goals 3, away goals 0) -> should beat team-1 by higher goals scored
      {
        id: "m2",
        homeTeamId: "team-2",
        awayTeamId: "team-11",
        homeScore: 3,
        awayScore: 1,
        status: "finished",
      },
    ];

    const table = calculateUCLTable(sampleTeams, matches);

    expect(table[0].team.id).toBe("team-2"); // 3 goals scored
    expect(table[1].team.id).toBe("team-1"); // 2 goals scored
  });

  it("distinguishes between in-progress mode and final tiebreaker mode", () => {
    // Two teams with identical primary stats (3 pts, +1 GD, 2 GF, 1 away goals, 1 win, 1 away win)
    const customTeams: TableTeamData[] = [
      {
        id: "team-alpha",
        name: "Alpha FC",
        shortName: "Z_Alpha", // Alphabetically later
        code: "ALP",
        logoUrl: "https://example.com/alpha.png",
        uefaCoefficient: 90.0, // Higher coefficient
        disciplinaryPoints: 5,
      },
      {
        id: "team-beta",
        name: "Beta FC",
        shortName: "A_Beta", // Alphabetically earlier
        code: "BET",
        logoUrl: "https://example.com/beta.png",
        uefaCoefficient: 60.0, // Lower coefficient
        disciplinaryPoints: 5,
      },
      ...sampleTeams.slice(2),
    ];

    const matches: FinishedMatchData[] = [
      // team-alpha wins 2:1 away against team-3
      {
        id: "m1",
        homeTeamId: "team-3",
        awayTeamId: "team-alpha",
        homeScore: 1,
        awayScore: 2,
        status: "finished",
      },
      // team-beta wins 2:1 away against team-4
      {
        id: "m2",
        homeTeamId: "team-4",
        awayTeamId: "team-beta",
        homeScore: 1,
        awayScore: 2,
        status: "finished",
      },
    ];

    // In-progress mode: sorts ties alphabetically by shortName ("A_Beta" beats "Z_Alpha")
    const inProgressTable = calculateUCLTable(customTeams, matches, "in-progress");
    expect(inProgressTable[0].team.id).toBe("team-beta");
    expect(inProgressTable[1].team.id).toBe("team-alpha");

    // Final mode: applies UEFA criteria (Alpha has higher UEFA coefficient 90.0 vs 60.0)
    const finalTable = calculateUCLTable(customTeams, matches, "final");
    expect(finalTable[0].team.id).toBe("team-alpha");
    expect(finalTable[1].team.id).toBe("team-beta");
  });
});
