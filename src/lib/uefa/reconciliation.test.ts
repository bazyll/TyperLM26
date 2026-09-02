import { describe, it, expect, vi, beforeEach } from "vitest";
import { UefaSquadReconciliationService } from "./reconciliation";
import { GoalApiClient } from "@/lib/goal-api/client";

// Mock Supabase admin client
vi.mock("@/lib/supabase/admin", () => {
  const mockFrom = vi.fn();
  return {
    createAdminClient: () => ({
      from: mockFrom,
    }),
    __mockFrom: mockFrom,
  };
});

describe("UefaSquadReconciliationService (100% Mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles existing local players without using GOAL search requests (Quota = 0)", async () => {
    const mockClient = {
      searchPlayers: vi.fn(),
    } as unknown as GoalApiClient;

    const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;

    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    __mockFrom.mockImplementation((table: string) => {
      if (table === "teams") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                { id: "team-bar", name: "Barcelona", code: "BAR", goal_api_id: "ext-bar" },
              ],
              error: null,
            }),
        };
      }
      if (table === "players") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  id: "uuid-pedri",
                  name: "Pedri",
                  team_id: "team-bar",
                  uefa_player_id: null,
                  goal_api_player_id: "cuid-pedri",
                  goal_api_player_api_id: "3145603117",
                  is_ucl_registered: false,
                },
              ],
            }),
          update: mockUpdate,
        };
      }
      return {};
    });

    const service = new UefaSquadReconciliationService(mockClient);
    const result = await service.reconcileSnapshot({
      competition: "UEFA Champions League",
      season: "2026/27",
      retrievedAt: new Date().toISOString(),
      source: "UEFA",
      version: "2026-09-02-v1",
      teams: [
        {
          teamCode: "BAR",
          teamName: "Barcelona",
          players: [
            {
              uefaPlayerId: "uefa-pedri-1",
              name: "Pedri",
              position: "Midfielder",
              jerseyNumber: "8",
              listType: "A",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.matchedExistingLocalCount).toBe(1);
    expect(result.quotaRequestsUsed).toBe(0); // Quota conserved!
    expect(mockClient.searchPlayers).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        uefa_player_id: "uefa-pedri-1",
        is_ucl_registered: true,
        uefa_list_type: "A",
      })
    );
  });

  it("finds missing star via GOAL /players/search, links external IDs, and sets canonical UEFA club team_id", async () => {
    const mockClient = {
      searchPlayers: vi.fn().mockResolvedValue([
        {
          id: "cuid-mbappe",
          apiId: "2354545782",
          name: "Kylian Mbappe",
          type: "Forwards",
          number: "10",
          image: "https://media.goal-api.com/mbappe.jpg",
          isActive: true,
          team: { name: "France" }, // GOAL API currently links him to France
        },
      ]),
    } as unknown as GoalApiClient;

    const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    __mockFrom.mockImplementation((table: string) => {
      if (table === "teams") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                { id: "team-rma", name: "Real Madrid", code: "RMA", goal_api_id: "ext-rma" },
              ],
              error: null,
            }),
        };
      }
      if (table === "players") {
        return {
          select: () => Promise.resolve({ data: [] }), // Mbappé is not in local DB yet
          insert: mockInsert,
        };
      }
      return {};
    });

    const service = new UefaSquadReconciliationService(mockClient);
    const result = await service.reconcileSnapshot({
      competition: "UEFA Champions League",
      season: "2026/27",
      retrievedAt: new Date().toISOString(),
      source: "UEFA",
      version: "2026-09-02-v1",
      teams: [
        {
          teamCode: "RMA",
          teamName: "Real Madrid",
          players: [
            {
              uefaPlayerId: "uefa-mbappe-9",
              name: "Kylian Mbappé",
              position: "Forward",
              jerseyNumber: "9",
              listType: "A",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.matchedGoalApiSearchCount).toBe(1);
    expect(result.quotaRequestsUsed).toBe(1);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Kylian Mbappé",
        team_id: "team-rma", // Assigned to Real Madrid from UEFA, NOT France from GOAL API!
        uefa_player_id: "uefa-mbappe-9",
        goal_api_player_id: "cuid-mbappe",
        goal_api_player_api_id: "2354545782",
        is_ucl_registered: true,
        uefa_list_type: "A",
      })
    );
  });
});
