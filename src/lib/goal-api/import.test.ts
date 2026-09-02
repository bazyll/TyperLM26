import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncUclSchedule, generateTeamCode, preflightTeamDecisions } from "./import";
import { GoalApiClient } from "./client";
import { GoalApiFixtureItem } from "./types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase admin client
vi.mock("@/lib/supabase/admin", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  return {
    createAdminClient: () => ({
      from: mockFrom,
      rpc: mockRpc,
    }),
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
  };
});

describe("UCL Schedule Sync (Milestone 6B.2 - 100% Mocked)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateTeamCode", () => {
    it("assigns canonical codes to known top teams", () => {
      const used = new Set<string>();
      expect(generateTeamCode("Real Madrid", used)).toBe("RMA");
      expect(generateTeamCode("Manchester City", used)).toBe("MCI");
      expect(generateTeamCode("Bayern Munich", used)).toBe("BAY");
      expect(generateTeamCode("PSG", used)).toBe("PSG");
      expect(generateTeamCode("Barcelona", used)).toBe("BAR");
      expect(generateTeamCode("Arsenal", used)).toBe("ARS");
      expect(generateTeamCode("Liverpool", used)).toBe("LIV");
      expect(generateTeamCode("Inter", used)).toBe("INT");
    });

    it("resolves code collision deterministically without merging or failing", () => {
      const used = new Set<string>(["RMA"]);
      const code2 = generateTeamCode("Real Madrid", used);
      expect(code2).toBeDefined();
      expect(code2).not.toBe("RMA");
      expect(code2.length).toBe(3);
    });
  });

  describe("preflightTeamDecisions", () => {
    it("correctly classifies teams into matched_by_id, legacy_matched_by_name, and new_insert", () => {
      const existingDbTeams = [
        { id: "uuid_1", name: "RB Leipzig", goal_api_id: null, code: "D08" },
        { id: "uuid_2", name: "Manchester Utd", goal_api_id: "ext_mun", code: "MUN" },
      ];

      const providerTeams = [
        { goalApiId: "ext_mun", name: "Manchester Utd", badgeUrl: null },
        { goalApiId: "ext_rbl", name: "RB Leipzig", badgeUrl: null },
        { goalApiId: "ext_new", name: "Como", badgeUrl: null },
      ];

      const { decisions, errors } = preflightTeamDecisions(providerTeams, existingDbTeams);

      expect(errors).toHaveLength(0);
      expect(decisions).toHaveLength(3);

      expect(decisions[0].type).toBe("matched_by_id");
      expect(decisions[0].providerTeam.name).toBe("Manchester Utd");

      expect(decisions[1].type).toBe("legacy_matched_by_name");
      expect(decisions[1].providerTeam.name).toBe("RB Leipzig");
      expect(decisions[1].existingDbTeam.id).toBe("uuid_1");

      expect(decisions[2].type).toBe("new_insert");
      expect(decisions[2].providerTeam.name).toBe("Como");
    });

    it("detects identity conflict if a legacy team already has a different goal_api_id", () => {
      const existingDbTeams = [
        { id: "uuid_1", name: "RB Leipzig", goal_api_id: "different_id", code: "D08" },
      ];

      const providerTeams = [
        { goalApiId: "ext_rbl", name: "RB Leipzig", badgeUrl: null },
      ];

      const { errors } = preflightTeamDecisions(providerTeams, existingDbTeams);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Konflikt tożsamości drużyny");
    });
  });

  describe("syncUclSchedule", () => {
    const mockFixtures: GoalApiFixtureItem[] = [
      // 2 Qualifying matches (should be ignored)
      {
        id: "qual_1",
        leagueId: "cmr77dw3900f5rx06j05wgzv4",
        leagueName: "UEFA Champions League",
        matchDate: "2026-08-20",
        matchTime: "19:00",
        kickoffUtc: "2026-08-20T19:00:00.000Z",
        matchStatus: "FINISHED",
        homeTeamId: "team_q1",
        homeTeamName: "Qualifying Team 1",
        awayTeamId: "team_q2",
        awayTeamName: "Qualifying Team 2",
        stageName: "Qualifying",
        matchRound: "Play-offs",
      },
      {
        id: "qual_2",
        leagueId: "cmr77dw3900f5rx06j05wgzv4",
        leagueName: "UEFA Champions League",
        matchDate: "2026-08-20",
        matchTime: "19:00",
        kickoffUtc: "2026-08-20T19:00:00.000Z",
        matchStatus: "FINISHED",
        homeTeamId: "team_q3",
        homeTeamName: "Qualifying Team 3",
        awayTeamId: "team_q4",
        awayTeamName: "Qualifying Team 4",
        stageName: "Qualifying",
        matchRound: "Play-offs",
      },
      // 2 League Phase matches (4 unique teams)
      {
        id: "lp_fix_1",
        leagueId: "cmr77dw3900f5rx06j05wgzv4",
        leagueName: "UEFA Champions League",
        matchDate: "2026-09-08",
        matchTime: "19:00",
        kickoffUtc: "2026-09-08T19:00:00.000Z",
        matchStatus: "SCHEDULED",
        homeTeamId: "team_rma",
        homeTeamName: "Real Madrid",
        awayTeamId: "team_int",
        awayTeamName: "Inter",
        stageName: "League Phase",
        matchRound: "1",
        teamHomeBadge: "https://media.goal-api.com/badges/76_real-madrid.jpg",
        teamAwayBadge: "https://media.goal-api.com/badges/79_internazionale.jpg",
      } as any,
      {
        id: "lp_fix_2",
        leagueId: "cmr77dw3900f5rx06j05wgzv4",
        leagueName: "UEFA Champions League",
        matchDate: "2026-09-09",
        matchTime: "19:00",
        kickoffUtc: "2026-09-09T19:00:00.000Z",
        matchStatus: "SCHEDULED",
        homeTeamId: "team_rbl",
        homeTeamName: "RB Leipzig",
        awayTeamId: "team_psg",
        awayTeamName: "PSG",
        stageName: "League Phase",
        matchRound: "1",
        teamHomeBadge: "https://media.goal-api.com/badges/101_rb-leipzig.jpg",
        teamAwayBadge: "https://media.goal-api.com/badges/100_psg.jpg",
      } as any,
    ];

    it("reconciles legacy RB Leipzig team (goal_api_id=null) without duplicate key violation", async () => {
      const mockClient = {
        getUclFixtures: vi.fn().mockResolvedValue([mockFixtures[3]]), // RB Leipzig vs PSG
      } as unknown as GoalApiClient;

      const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;

      // Existing DB has RB Leipzig with goal_api_id = null
      let teamsDb: any[] = [
        {
          id: "uuid_rbl_existing",
          name: "RB Leipzig",
          short_name: "Leipzig",
          code: "D08",
          goal_api_id: null,
          logo_url: "",
        },
      ];
      let matchesDb: any[] = [];

      __mockFrom.mockImplementation((tableName: string) => {
        if (tableName === "teams") {
          return {
            select: () => Promise.resolve({ data: teamsDb, error: null }),
            insert: (row: any) => {
              // Simulate unique constraint on name
              if (teamsDb.some((t) => t.name.toLowerCase() === row.name.toLowerCase())) {
                return Promise.resolve({
                  error: new Error(`duplicate key value violates unique constraint "teams_name_key"`),
                });
              }
              const inserted = { id: `uuid_${row.goal_api_id}`, ...row };
              teamsDb.push(inserted);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: inserted, error: null }),
                }),
              };
            },
            update: (row: any) => ({
              eq: (field: string, val: any) => {
                const idx = teamsDb.findIndex((t) => t[field] === val);
                if (idx >= 0) teamsDb[idx] = { ...teamsDb[idx], ...row };
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (tableName === "matches") {
          return {
            select: () => Promise.resolve({ data: matchesDb, error: null }),
            insert: (row: any) => {
              const inserted = { id: `match_uuid_${row.goal_api_fixture_id}`, ...row };
              matchesDb.push(inserted);
              return Promise.resolve({ error: null });
            },
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }

        return {};
      });

      const res = await syncUclSchedule(mockClient);

      expect(res.success).toBe(true);
      expect(res.updatedTeamsCount).toBe(1); // RB Leipzig updated (legacy reconciled)
      expect(res.newTeamsCount).toBe(1); // PSG inserted
      expect(res.matchesSyncedCount).toBe(1);

      // Verify RB Leipzig existing UUID is preserved and goal_api_id is assigned
      const rbl = teamsDb.find((t) => t.id === "uuid_rbl_existing");
      expect(rbl).toBeDefined();
      expect(rbl.goal_api_id).toBe("team_rbl");
      expect(rbl.code).toBe("D08"); // Existing code preserved
    });

    it("recovers from a partially executed previous sync without creating duplicate records", async () => {
      const mockClient = {
        getUclFixtures: vi.fn().mockResolvedValue(mockFixtures),
      } as unknown as GoalApiClient;

      const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;

      // Simulate state where 2 teams were already created with goal_api_id in a previous failed run,
      // and 1 team exists as legacy with goal_api_id = null
      let teamsDb: any[] = [
        { id: "uuid_rma", name: "Real Madrid", goal_api_id: "team_rma", code: "RMA", logo_url: "" },
        { id: "uuid_int", name: "Inter", goal_api_id: "team_int", code: "INT", logo_url: "" },
        { id: "uuid_rbl", name: "RB Leipzig", goal_api_id: null, code: "D08", logo_url: "" },
      ];
      let matchesDb: any[] = [];

      __mockFrom.mockImplementation((tableName: string) => {
        if (tableName === "teams") {
          return {
            select: () => Promise.resolve({ data: teamsDb, error: null }),
            insert: (row: any) => {
              if (teamsDb.some((t) => t.name.toLowerCase() === row.name.toLowerCase())) {
                return Promise.resolve({
                  error: new Error(`duplicate key value violates unique constraint "teams_name_key"`),
                });
              }
              const inserted = { id: `uuid_${row.goal_api_id}`, ...row };
              teamsDb.push(inserted);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: inserted, error: null }),
                }),
              };
            },
            update: (row: any) => ({
              eq: (field: string, val: any) => {
                const idx = teamsDb.findIndex((t) => t[field] === val);
                if (idx >= 0) teamsDb[idx] = { ...teamsDb[idx], ...row };
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (tableName === "matches") {
          return {
            select: () => Promise.resolve({ data: matchesDb, error: null }),
            insert: (row: any) => {
              const inserted = { id: `match_uuid_${row.goal_api_fixture_id}`, ...row };
              matchesDb.push(inserted);
              return Promise.resolve({ error: null });
            },
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }

        return {};
      });

      const res = await syncUclSchedule(mockClient);

      expect(res.success).toBe(true);
      expect(res.teamsSyncedCount).toBe(4);
      expect(res.updatedTeamsCount).toBe(3); // 2 by ID + 1 legacy by name
      expect(res.newTeamsCount).toBe(1); // 1 new (PSG)
      expect(res.matchesSyncedCount).toBe(2);
      expect(res.newMatchesCount).toBe(2);
      expect(teamsDb).toHaveLength(4);
      expect(matchesDb).toHaveLength(2);
    });

    it("respects is_manual_override = true and preserves existing predictions", async () => {
      const mockClient = {
        getUclFixtures: vi.fn().mockResolvedValue([mockFixtures[2]]), // Only Real vs Inter
      } as unknown as GoalApiClient;

      const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;

      const existingTeams = [
        { id: "uuid_team_rma", goal_api_id: "team_rma", name: "Real Madrid", code: "RMA", logo_url: "" },
        { id: "uuid_team_int", goal_api_id: "team_int", name: "Inter", code: "INT", logo_url: "" },
      ];

      const existingMatches = [
        {
          id: "match_1",
          goal_api_fixture_id: "lp_fix_1",
          is_manual_override: true, // Manual override active!
          status: "scheduled",
          kickoff_at: "2026-09-08T18:00:00.000Z", // Admin modified time
        },
      ];

      const updateMatchMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      __mockFrom.mockImplementation((tableName: string) => {
        if (tableName === "teams") {
          return {
            select: () => Promise.resolve({ data: existingTeams, error: null }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        if (tableName === "matches") {
          return {
            select: () => Promise.resolve({ data: existingMatches, error: null }),
            update: updateMatchMock,
          };
        }
        return {};
      });

      const res = await syncUclSchedule(mockClient);

      expect(res.success).toBe(true);
      expect(res.manualOverridesSkippedCount).toBe(1);
      expect(res.updatedMatchesCount).toBe(0);
      expect(updateMatchMock).not.toHaveBeenCalled();
    });
  });
});
