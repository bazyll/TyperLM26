import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTeamUclStats, getSpecialPredictionLeaders } from "./ucl-stats";
import { getUclScorersRanking, getUclAssistsRanking } from "@/lib/goal-api/scorers";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Milestone 6D: Scorers, Assists, and UCL Team Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Team Goals & Clean Sheets Aggregation (Strictly FINISHED matches)", () => {
    it("aggregates team goals and clean sheets only from finished matches", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "teams") {
            return {
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: "team_rma", name: "Real Madrid", code: "RMA", logo_url: "https://media.goal-api.com/rma.png" },
                  { id: "team_mci", name: "Manchester City", code: "MCI", logo_url: "https://media.goal-api.com/mci.png" },
                  { id: "team_bvb", name: "Dortmund", code: "BVB", logo_url: "https://media.goal-api.com/bvb.png" },
                ],
              }),
            };
          }
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockReturnValue({
                    not: vi.fn().mockResolvedValue({
                      data: [
                        // Match 1: RMA 3 : 0 MCI (Finished) -> RMA +3 goals, +1 clean sheet; MCI 0 goals, 0 clean sheet
                        { id: "m1", home_team_id: "team_rma", away_team_id: "team_mci", home_score: 3, away_score: 0, status: "finished" },
                        // Match 2: BVB 1 : 1 RMA (Finished) -> BVB +1 goal, RMA +1 goal, 0 clean sheets
                        { id: "m2", home_team_id: "team_bvb", away_team_id: "team_rma", home_score: 1, away_score: 1, status: "finished" },
                      ],
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const stats = await getTeamUclStats(mockSupabase);

      expect(stats.length).toBe(3);

      const rma = stats.find((t) => t.teamId === "team_rma")!;
      expect(rma.matchesPlayed).toBe(2);
      expect(rma.goalsScored).toBe(4); // 3 + 1
      expect(rma.goalsConceded).toBe(1); // 0 + 1
      expect(rma.cleanSheetsCount).toBe(1);

      const mci = stats.find((t) => t.teamId === "team_mci")!;
      expect(mci.matchesPlayed).toBe(1);
      expect(mci.goalsScored).toBe(0);
      expect(mci.goalsConceded).toBe(3);
      expect(mci.cleanSheetsCount).toBe(0);

      const bvb = stats.find((t) => t.teamId === "team_bvb")!;
      expect(bvb.matchesPlayed).toBe(1);
      expect(bvb.goalsScored).toBe(1);
      expect(bvb.cleanSheetsCount).toBe(0);
    });

    it("handles empty season with zero finished matches", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "teams") {
            return {
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: "team_rma", name: "Real Madrid", code: "RMA", logo_url: null },
                ],
              }),
            };
          }
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockReturnValue({
                    not: vi.fn().mockResolvedValue({ data: [] }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const stats = await getTeamUclStats(mockSupabase);
      expect(stats.length).toBe(1);
      expect(stats[0].goalsScored).toBe(0);
      expect(stats[0].cleanSheetsCount).toBe(0);
      expect(stats[0].matchesPlayed).toBe(0);
    });
  });

  describe("Special Prediction Leaders Determination (With Ties)", () => {
    it("determines tied top scorers, assists, most goals, and clean sheets leaders", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      // Mock get_ucl_scorers_and_assists RPC
      (createClient as any).mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [
            // Tied top scorers (both 5 goals)
            { player_name: "K. Mbappe", scorer_external_id: "ext_p1", team_id: "team_rma", team_name: "Real Madrid", team_code: "RMA", team_logo_url: null, goals_count: 5, assists_count: 2 },
            { player_name: "E. Haaland", scorer_external_id: "ext_p2", team_id: "team_mci", team_name: "Manchester City", team_code: "MCI", team_logo_url: null, goals_count: 5, assists_count: 1 },
            // Single top assist (4 assists)
            { player_name: "K. De Bruyne", scorer_external_id: "ext_p3", team_id: "team_mci", team_name: "Manchester City", team_code: "MCI", team_logo_url: null, goals_count: 1, assists_count: 4 },
          ],
          error: null,
        }),
      });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "teams") {
            return {
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: "team_rma", name: "Real Madrid", code: "RMA", logo_url: null },
                  { id: "team_mci", name: "Manchester City", code: "MCI", logo_url: null },
                ],
              }),
            };
          }
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockReturnValue({
                    not: vi.fn().mockResolvedValue({
                      data: [
                        { id: "m1", home_team_id: "team_rma", away_team_id: "team_mci", home_score: 3, away_score: 0, status: "finished" },
                      ],
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const leaders = await getSpecialPredictionLeaders(mockSupabase);

      // Tied top scorers
      expect(leaders.topScorers.length).toBe(2);
      expect(leaders.topScorers.map((p) => p.playerName)).toContain("K. Mbappe");
      expect(leaders.topScorers.map((p) => p.playerName)).toContain("E. Haaland");
      expect(leaders.topScorers[0].goalsCount).toBe(5);

      // Single top assist
      expect(leaders.topAssists.length).toBe(1);
      expect(leaders.topAssists[0].playerName).toBe("K. De Bruyne");
      expect(leaders.topAssists[0].assistsCount).toBe(4);

      // Team Most Goals
      expect(leaders.teamMostGoals.length).toBe(1);
      expect(leaders.teamMostGoals[0].teamName).toBe("Real Madrid");
      expect(leaders.teamMostGoals[0].goalsScored).toBe(3);

      // Team Most Clean Sheets
      expect(leaders.teamMostCleanSheets.length).toBe(1);
      expect(leaders.teamMostCleanSheets[0].teamName).toBe("Real Madrid");
      expect(leaders.teamMostCleanSheets[0].cleanSheetsCount).toBe(1);
    });

    it("returns empty leaders arrays when no goals or clean sheets exist", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      (createClient as any).mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "teams") {
            return {
              select: vi.fn().mockResolvedValue({ data: [] }),
            };
          }
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockReturnValue({
                    not: vi.fn().mockResolvedValue({ data: [] }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const leaders = await getSpecialPredictionLeaders(mockSupabase);

      expect(leaders.topScorers).toEqual([]);
      expect(leaders.topAssists).toEqual([]);
      expect(leaders.teamMostGoals).toEqual([]);
      expect(leaders.teamMostCleanSheets).toEqual([]);
    });
  });

  describe("getUclScorersRanking & getUclAssistsRanking Sort Ordering", () => {
    it("sorts scorers by goals DESC, assists DESC, player_name ASC", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      (createClient as any).mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [
            { player_name: "B. Player", scorer_external_id: "p2", team_id: "t1", team_name: "Team A", team_code: "TMA", team_logo_url: null, goals_count: 3, assists_count: 2 },
            { player_name: "A. Player", scorer_external_id: "p1", team_id: "t1", team_name: "Team A", team_code: "TMA", team_logo_url: null, goals_count: 3, assists_count: 2 },
            { player_name: "C. Player", scorer_external_id: "p3", team_id: "t1", team_name: "Team A", team_code: "TMA", team_logo_url: null, goals_count: 4, assists_count: 0 },
            { player_name: "D. Zero", scorer_external_id: "p4", team_id: "t1", team_name: "Team A", team_code: "TMA", team_logo_url: null, goals_count: 0, assists_count: 3 },
          ],
          error: null,
        }),
      });

      const scorers = await getUclScorersRanking();

      // D. Zero (0 goals) should be filtered out
      expect(scorers.length).toBe(3);
      expect(scorers[0].playerName).toBe("C. Player"); // 4 goals
      expect(scorers[1].playerName).toBe("A. Player"); // 3 goals, 2 assists, name 'A'
      expect(scorers[2].playerName).toBe("B. Player"); // 3 goals, 2 assists, name 'B'
    });

    it("sorts assists by assists DESC, goals DESC, player_name ASC", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      (createClient as any).mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [
            { player_name: "Y. Player", scorer_external_id: "p2", team_id: "t1", team_name: "Team A", team_code: "TMA", team_logo_url: null, goals_count: 1, assists_count: 3 },
            { player_name: "X. Player", scorer_external_id: "p1", team_id: "t1", team_name: "Team A", team_code: "TMA", team_logo_url: null, goals_count: 2, assists_count: 3 },
            { player_name: "Z. GoalOnly", scorer_external_id: "p3", team_id: "t1", team_name: "Team A", team_code: "TMA", team_logo_url: null, goals_count: 5, assists_count: 0 },
          ],
          error: null,
        }),
      });

      const assists = await getUclAssistsRanking();

      // Z. GoalOnly (0 assists) should be filtered out
      expect(assists.length).toBe(2);
      expect(assists[0].playerName).toBe("X. Player"); // 3 assists, 2 goals
      expect(assists[1].playerName).toBe("Y. Player"); // 3 assists, 1 goal
    });
  });
});
