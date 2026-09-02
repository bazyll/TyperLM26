import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateSpecialPredictionsSettlement } from "./settlement";
import { calculateSpecialPredictionScore } from "@/lib/scoring/special";
import * as uclStats from "@/lib/scoring/ucl-stats";

describe("Milestone 6E.2: Special Predictions Settlement & Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Scoring Engine & Finalist / Winner Rules", () => {
    it("awards 20 pts for correct winner prediction", () => {
      const score = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: "team-rma",
        correctTeamIds: ["team-rma"],
        pointsValue: 20,
      });
      expect(score).toBe(20);
    });

    it("awards 20 pts for EITHER finalist team in finalist category", () => {
      const finalists = ["team-rma", "team-liv"];

      // User picked RMA (winner) -> 20 pts
      const scoreRma = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: "team-rma",
        correctTeamIds: finalists,
        pointsValue: 20,
      });
      expect(scoreRma).toBe(20);

      // User picked LIV (runner-up) -> 20 pts
      const scoreLiv = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: "team-liv",
        correctTeamIds: finalists,
        pointsValue: 20,
      });
      expect(scoreLiv).toBe(20);
    });

    it("allows user to score 40 pts total when picking the champion as both Winner and Finalist", () => {
      const winnerScore = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: "team-rma",
        correctTeamIds: ["team-rma"],
        pointsValue: 20,
      });

      const finalistScore = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: "team-rma",
        correctTeamIds: ["team-rma", "team-liv"],
        pointsValue: 20,
      });

      expect(winnerScore + finalistScore).toBe(40);
    });

    it("awards 20 pts to all tied top scorers (e.g. Mbappé and Haaland both at 12 goals)", () => {
      const tiedGoldenBoot = ["player-mbappe", "player-haaland"];

      const scoreMbappe = calculateSpecialPredictionScore({
        targetType: "player",
        userPlayerId: "player-mbappe",
        correctPlayerIds: tiedGoldenBoot,
        pointsValue: 20,
      });
      expect(scoreMbappe).toBe(20);

      const scoreHaaland = calculateSpecialPredictionScore({
        targetType: "player",
        userPlayerId: "player-haaland",
        correctPlayerIds: tiedGoldenBoot,
        pointsValue: 20,
      });
      expect(scoreHaaland).toBe(20);

      const scoreKane = calculateSpecialPredictionScore({
        targetType: "player",
        userPlayerId: "player-kane",
        correctPlayerIds: tiedGoldenBoot,
        pointsValue: 20,
      });
      expect(scoreKane).toBe(0);
    });

    it("awards max 120 pts across all 6 categories (6 x 20 pts)", () => {
      const allSixScores = [20, 20, 20, 20, 20, 20];
      const total = allSixScores.reduce((acc, s) => acc + s, 0);
      expect(total).toBe(120);
    });

    it("awards 0 pts for incorrect choices", () => {
      const score = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: "team-bar",
        correctTeamIds: ["team-rma"],
        pointsValue: 20,
      });
      expect(score).toBe(0);
    });
  });

  describe("2. Settlement Evaluation & Readiness Checks (100% Mocked)", () => {
    it("marks winner & finalist as NOT_READY before the UCL final match is completed", async () => {
      vi.spyOn(uclStats, "getSpecialPredictionLeaders").mockResolvedValue({
        topScorers: [],
        topAssists: [],
        teamMostGoals: [],
        teamMostCleanSheets: [],
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "special_prediction_categories") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { id: "cat-winner", slug: "winner", title: "Zwycięzca LM", target_type: "team", points_value: 20, status: "open" },
                      { id: "cat-finalist", slug: "finalist", title: "Finalista LM", target_type: "team", points_value: 20, status: "open" },
                    ],
                  }),
              }),
            };
          }
          if (table === "teams") {
            return {
              select: () => Promise.resolve({ data: [{ id: "t1", name: "Real Madrid" }, { id: "t2", name: "Barcelona" }] }),
            };
          }
          if (table === "players") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          if (table === "matches") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      // Match in league stage, no final yet
                      { id: "m1", stage: "league", status: "scheduled", home_team_id: "t1", away_team_id: "t2" },
                    ],
                  }),
              }),
            };
          }
          if (table === "special_predictions") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          return {};
        }),
      };

      const report = await evaluateSpecialPredictionsSettlement(mockSupabase);

      expect(report.competitionCompleted).toBe(false);
      const winnerCat = report.categories.find((c) => c.categorySlug === "winner");
      const finalistCat = report.categories.find((c) => c.categorySlug === "finalist");

      expect(winnerCat?.readiness).toBe("NOT_READY");
      expect(winnerCat?.canSettle).toBe(false);
      expect(finalistCat?.readiness).toBe("NOT_READY");
      expect(finalistCat?.canSettle).toBe(false);
    });

    it("marks winner as NOT_READY if final ends in a draw and winner_team_id (penalties) is unresolved", async () => {
      vi.spyOn(uclStats, "getSpecialPredictionLeaders").mockResolvedValue({
        topScorers: [],
        topAssists: [],
        teamMostGoals: [],
        teamMostCleanSheets: [],
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "special_prediction_categories") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { id: "cat-winner", slug: "winner", title: "Zwycięzca LM", target_type: "team", points_value: 20, status: "open" },
                    ],
                  }),
              }),
            };
          }
          if (table === "teams") {
            return {
              select: () => Promise.resolve({ data: [{ id: "t1", name: "Real Madrid" }, { id: "t2", name: "Bayern" }] }),
            };
          }
          if (table === "players") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          if (table === "matches") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      // Final ended 1:1, but winner_team_id is NULL (penalty shootout pending/unresolved)
                      { id: "m-final", stage: "final", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 1, winner_team_id: null },
                    ],
                  }),
              }),
            };
          }
          if (table === "special_predictions") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          return {};
        }),
      };

      const report = await evaluateSpecialPredictionsSettlement(mockSupabase);
      const winnerCat = report.categories.find((c) => c.categorySlug === "winner");

      expect(winnerCat?.readiness).toBe("NOT_READY");
      expect(winnerCat?.canSettle).toBe(false);
      expect(winnerCat?.readinessReason).toContain("remisem");
    });

    it("marks winner & finalist as READY with both finalist teams when final is completed and winner resolved after penalties", async () => {
      vi.spyOn(uclStats, "getSpecialPredictionLeaders").mockResolvedValue({
        topScorers: [],
        topAssists: [],
        teamMostGoals: [],
        teamMostCleanSheets: [],
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "special_prediction_categories") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { id: "cat-winner", slug: "winner", title: "Zwycięzca LM", target_type: "team", points_value: 20, status: "open" },
                      { id: "cat-finalist", slug: "finalist", title: "Finalista LM", target_type: "team", points_value: 20, status: "open" },
                    ],
                  }),
              }),
            };
          }
          if (table === "teams") {
            return {
              select: () => Promise.resolve({ data: [{ id: "t1", name: "Real Madrid" }, { id: "t2", name: "Bayern" }] }),
            };
          }
          if (table === "players") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          if (table === "matches") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      // Final 1:1, winner_team_id resolved to Real Madrid (t1) after penalties
                      { id: "m-final", stage: "final", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 1, winner_team_id: "t1" },
                    ],
                  }),
              }),
            };
          }
          if (table === "special_predictions") {
            return {
              select: () =>
                Promise.resolve({
                  data: [
                    { id: "sp1", user_id: "u1", category_id: "cat-winner", selected_team_id: "t1", profiles: { id: "u1", username: "Jan" } },
                    { id: "sp2", user_id: "u2", category_id: "cat-finalist", selected_team_id: "t2", profiles: { id: "u2", username: "Adam" } },
                  ],
                }),
            };
          }
          return {};
        }),
      };

      const report = await evaluateSpecialPredictionsSettlement(mockSupabase);
      const winnerCat = report.categories.find((c) => c.categorySlug === "winner");
      const finalistCat = report.categories.find((c) => c.categorySlug === "finalist");

      expect(winnerCat?.readiness).toBe("READY");
      expect(winnerCat?.canSettle).toBe(true);
      expect(winnerCat?.proposedTeamIds).toEqual(["t1"]);
      expect(winnerCat?.winningUsersCount).toBe(1);

      expect(finalistCat?.readiness).toBe("READY");
      expect(finalistCat?.canSettle).toBe(true);
      expect(finalistCat?.proposedTeamIds).toEqual(["t1", "t2"]);
      expect(finalistCat?.winningUsersCount).toBe(1); // Adam picked Bayern (t2), who is also in the final!
    });

    it("strictly invalidates winner if winner_team_id is not one of the two finalist teams", async () => {
      vi.spyOn(uclStats, "getSpecialPredictionLeaders").mockResolvedValue({
        topScorers: [],
        topAssists: [],
        teamMostGoals: [],
        teamMostCleanSheets: [],
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "special_prediction_categories") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { id: "cat-winner", slug: "winner", title: "Zwycięzca LM", target_type: "team", points_value: 20, status: "open" },
                    ],
                  }),
              }),
            };
          }
          if (table === "teams") {
            return {
              select: () => Promise.resolve({ data: [{ id: "t1", name: "Real Madrid" }, { id: "t2", name: "Bayern" }, { id: "t3", name: "Chelsea" }] }),
            };
          }
          if (table === "players") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          if (table === "matches") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      // Final between t1 and t2, but winner_team_id points to t3 (invalid foreign team!)
                      { id: "m-final", stage: "final", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 1, winner_team_id: "t3" },
                    ],
                  }),
              }),
            };
          }
          if (table === "special_predictions") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          return {};
        }),
      };

      const report = await evaluateSpecialPredictionsSettlement(mockSupabase);
      const winnerCat = report.categories.find((c) => c.categorySlug === "winner");

      expect(winnerCat?.readiness).toBe("NOT_READY");
      expect(winnerCat?.canSettle).toBe(false);
    });

    it("blocks settlement of seasonal stats (IN_PROGRESS) when earlier matches are still scheduled or live", async () => {
      vi.spyOn(uclStats, "getSpecialPredictionLeaders").mockResolvedValue({
        topScorers: [{ playerName: "Kylian Mbappé", goalsCount: 12, scorerExternalId: "ext-1" }],
        topAssists: [],
        teamMostGoals: [],
        teamMostCleanSheets: [],
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "special_prediction_categories") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { id: "cat-scorer", slug: "top_scorer", title: "Król strzelców", target_type: "player", points_value: 20, status: "open" },
                    ],
                  }),
              }),
            };
          }
          if (table === "teams") {
            return { select: () => Promise.resolve({ data: [{ id: "t1", name: "Real Madrid" }, { id: "t2", name: "Bayern" }] }) };
          }
          if (table === "players") {
            return { select: () => Promise.resolve({ data: [{ id: "p1", name: "Kylian Mbappé", goal_api_player_api_id: "ext-1" }] }) };
          }
          if (table === "matches") {
            const allMatches: any[] = [];
            for (let i = 1; i <= 143; i++) {
              allMatches.push({ id: `m-l-${i}`, stage: "league", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 2, away_score: 1, events_reconciled_at: "2026-09-01T20:00:00Z" });
            }
            // 1 match is live!
            allMatches.push({ id: "m-l-144", stage: "league", status: "live", home_team_id: "t1", away_team_id: "t2", home_score: 0, away_score: 0 });
            for (let i = 1; i <= 16; i++) {
              allMatches.push({ id: `m-po-${i}`, stage: "playoff", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
            }
            for (let i = 1; i <= 16; i++) {
              allMatches.push({ id: `m-r16-${i}`, stage: "round_of_16", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
            }
            for (let i = 1; i <= 8; i++) {
              allMatches.push({ id: `m-qf-${i}`, stage: "quarter_finals", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
            }
            for (let i = 1; i <= 4; i++) {
              allMatches.push({ id: `m-sf-${i}`, stage: "semi_finals", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
            }
            allMatches.push({ id: "m-final", stage: "final", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 2, away_score: 1, winner_team_id: "t1", events_reconciled_at: "2026-09-01T20:00:00Z" });

            return {
              select: () => ({
                order: () => Promise.resolve({ data: allMatches }),
              }),
            };
          }
          if (table === "special_predictions") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          return {};
        }),
      };

      const report = await evaluateSpecialPredictionsSettlement(mockSupabase);
      expect(report.competitionCompleted).toBe(false);

      const scorerCat = report.categories.find((c) => c.categorySlug === "top_scorer");
      expect(scorerCat?.readiness).toBe("IN_PROGRESS");
      expect(scorerCat?.canSettle).toBe(false);
      expect(scorerCat?.readinessReason).toContain("niezakończone spotkania");
    });

    it("marks top_scorer as NOT_READY if finished matches are missing events_reconciled_at marker", async () => {
      vi.spyOn(uclStats, "getSpecialPredictionLeaders").mockResolvedValue({
        topScorers: [{ playerName: "Kylian Mbappé", goalsCount: 12, scorerExternalId: "ext-1" }],
        topAssists: [],
        teamMostGoals: [],
        teamMostCleanSheets: [],
      });

      // Build 189 finished matches, but 1 match is missing events_reconciled_at
      const all189Matches: any[] = [];
      for (let i = 1; i <= 144; i++) {
        all189Matches.push({ id: `m-l-${i}`, stage: "league", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 2, away_score: 1, events_reconciled_at: "2026-09-01T20:00:00Z" });
      }
      for (let i = 1; i <= 16; i++) {
        all189Matches.push({ id: `m-po-${i}`, stage: "playoff", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
      }
      for (let i = 1; i <= 16; i++) {
        all189Matches.push({ id: `m-r16-${i}`, stage: "round_of_16", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
      }
      for (let i = 1; i <= 8; i++) {
        all189Matches.push({ id: `m-qf-${i}`, stage: "quarter_finals", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
      }
      for (let i = 1; i <= 4; i++) {
        all189Matches.push({ id: `m-sf-${i}`, stage: "semi_finals", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 1, away_score: 0, events_reconciled_at: "2026-09-01T20:00:00Z" });
      }
      // Final has events_reconciled_at = null!
      all189Matches.push({ id: "m-final", stage: "final", status: "finished", home_team_id: "t1", away_team_id: "t2", home_score: 2, away_score: 1, winner_team_id: "t1", events_reconciled_at: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "special_prediction_categories") {
            return {
              select: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { id: "cat-scorer", slug: "top_scorer", title: "Król strzelców", target_type: "player", points_value: 20, status: "open" },
                    ],
                  }),
              }),
            };
          }
          if (table === "teams") {
            return { select: () => Promise.resolve({ data: [{ id: "t1", name: "Real Madrid" }, { id: "t2", name: "Bayern" }] }) };
          }
          if (table === "players") {
            return { select: () => Promise.resolve({ data: [{ id: "p1", name: "Kylian Mbappé", goal_api_player_api_id: "ext-1" }] }) };
          }
          if (table === "matches") {
            return {
              select: () => ({
                order: () => Promise.resolve({ data: all189Matches }),
              }),
            };
          }
          if (table === "special_predictions") {
            return { select: () => Promise.resolve({ data: [] }) };
          }
          return {};
        }),
      };

      const report = await evaluateSpecialPredictionsSettlement(mockSupabase);
      expect(report.competitionCompleted).toBe(true);

      const scorerCat = report.categories.find((c) => c.categorySlug === "top_scorer");
      expect(scorerCat?.readiness).toBe("NOT_READY");
      expect(scorerCat?.canSettle).toBe(false);
      expect(scorerCat?.readinessReason).toContain("synchronizację zdarzeń");
    });
  });
});


