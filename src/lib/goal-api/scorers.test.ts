import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNativeUclScorersAndAssists } from "./scorers";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  return {
    createClient: () => Promise.resolve({
      rpc: mockRpc,
      from: mockFrom,
    }),
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
});

describe("Native UCL Scorers and Assists Aggregator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns native ranking from RPC get_ucl_scorers_and_assists if available", async () => {
    const { __mockRpc } = (await import("@/lib/supabase/server")) as any;
    __mockRpc.mockResolvedValue({
      data: [
        {
          player_name: "K. Mbappe",
          scorer_external_id: "ext_1",
          team_id: "t_real",
          team_name: "Real Madrid",
          team_code: "RMA",
          team_logo_url: "https://.../rma.png",
          goals_count: 5,
          assists_count: 2,
        },
        {
          player_name: "E. Haaland",
          scorer_external_id: "ext_2",
          team_id: "t_city",
          team_name: "Manchester City",
          team_code: "MCI",
          team_logo_url: "https://.../mci.png",
          goals_count: 4,
          assists_count: 1,
        },
      ],
      error: null,
    });

    const ranking = await getNativeUclScorersAndAssists();

    expect(ranking).toHaveLength(2);
    expect(ranking[0].playerName).toBe("K. Mbappe");
    expect(ranking[0].goalsCount).toBe(5);
    expect(ranking[0].assistsCount).toBe(2);
    expect(ranking[1].playerName).toBe("E. Haaland");
    expect(ranking[1].goalsCount).toBe(4);
  });

  it("returns empty array on RPC error gracefully", async () => {
    const { __mockRpc } = (await import("@/lib/supabase/server")) as any;
    __mockRpc.mockResolvedValue({ data: null, error: new Error("RPC error") });

    const ranking = await getNativeUclScorersAndAssists();
    expect(ranking).toEqual([]);
  });
});
