import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoalApiPlayersSyncService } from "./players-sync";
import { GoalApiClient } from "./client";

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

describe("GoalApiPlayersSyncService (100% Mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails early when rate limit quota is <= 50", async () => {
    const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;
    __mockFrom.mockImplementation((table: string) => {
      if (table === "external_api_sync_state") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { quota_remaining: 45, quota_limit: 1000 } }),
            }),
          }),
        };
      }
      return {};
    });

    const service = new GoalApiPlayersSyncService({} as any);
    const result = await service.executeSquadsSync();

    expect(result.success).toBe(false);
    expect(result.error).toContain("Zbyt niski stan limitu zapytań");
  });

  it("inserts new players and updates existing players with both external IDs", async () => {
    const mockClient = {
      getTeamPlayers: vi.fn().mockImplementation((teamId: string) => {
        if (teamId === "ext_t1") {
          return Promise.resolve([
            {
              id: "cuid_p1",
              apiId: "num_p1",
              name: "Kylian Mbappe",
              number: "9",
              type: "Forwards",
              image: "https://media.goal-api.com/mbappe.jpg",
              isActive: true,
            },
            {
              id: "cuid_p2",
              apiId: "num_p2",
              name: "Jude Bellingham",
              number: "5",
              type: "Midfielders",
              image: "https://media.goal-api.com/jude.jpg",
              isActive: false, // inactive in provider
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as GoalApiClient;

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;
    __mockFrom.mockImplementation((table: string) => {
      if (table === "external_api_sync_state") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { quota_remaining: 500, quota_limit: 1000 } }),
            }),
          }),
        };
      }
      if (table === "teams") {
        return {
          select: () => ({
            not: () =>
              Promise.resolve({
                data: [{ id: "loc_t1", name: "Real Madrid", code: "RMA", goal_api_id: "ext_t1" }],
                error: null,
              }),
          }),
        };
      }
      if (table === "players") {
        return {
          select: (_cols?: string) => ({
            or: (cond: string) => {
              if (cond.includes("cuid_p1")) {
                // Existing player 1
                return Promise.resolve({
                  data: [{ id: "loc_uuid_p1", goal_api_player_id: "cuid_p1", goal_api_player_api_id: "num_p1", name: "Mbappe" }],
                });
              }
              // New player 2
              return Promise.resolve({ data: [] });
            },
            in: () => ({
              eq: () => ({
                not: () => Promise.resolve({ data: [] }),
              }),
            }),
          }),
          insert: mockInsert,
          update: mockUpdate,
        };
      }
      return {};
    });

    const service = new GoalApiPlayersSyncService(mockClient);
    const result = await service.executeSquadsSync();

    expect(result.success).toBe(true);
    expect(result.successfulTeamsCount).toBe(1);
    expect(result.updatedCount).toBe(1); // cuid_p1 updated
    expect(result.insertedCount).toBe(1); // cuid_p2 inserted

    // Check insert respected isActive = false from provider for player 2
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        goal_api_player_id: "cuid_p2",
        goal_api_player_api_id: "num_p2",
        is_active: false,
      })
    );
  });

  it("detects conflict when goal_api_player_id and goal_api_player_api_id point to different UUIDs", async () => {
    const mockClient = {
      getTeamPlayers: vi.fn().mockResolvedValue([
        {
          id: "cuid_conflict",
          apiId: "num_conflict",
          name: "Conflicted Player",
          isActive: true,
        },
      ]),
    } as unknown as GoalApiClient;

    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();

    const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;
    __mockFrom.mockImplementation((table: string) => {
      if (table === "external_api_sync_state") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { quota_remaining: 500, quota_limit: 1000 } }),
            }),
          }),
        };
      }
      if (table === "teams") {
        return {
          select: () => ({
            not: () => Promise.resolve({ data: [{ id: "t1", goal_api_id: "ext1" }] }),
          }),
        };
      }
      if (table === "players") {
        return {
          select: () => ({
            or: () =>
              Promise.resolve({
                data: [
                  { id: "uuid_A", goal_api_player_id: "cuid_conflict" },
                  { id: "uuid_B", goal_api_player_api_id: "num_conflict" },
                ],
              }),
            in: () => ({ eq: () => ({ not: () => Promise.resolve({ data: [] }) }) }),
          }),
          insert: mockInsert,
          update: mockUpdate,
        };
      }
      return {};
    });

    const service = new GoalApiPlayersSyncService(mockClient);
    const result = await service.executeSquadsSync();

    expect(result.conflictsCount).toBe(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips global deactivation when a team fetch fails (partial sync safety)", async () => {
    const mockClient = {
      getTeamPlayers: vi.fn().mockImplementation((teamId: string) => {
        if (teamId === "ext1") return Promise.resolve([{ id: "p1", apiId: "1", name: "P1", isActive: true }]);
        throw new Error("HTTP 500 Network error on team 2");
      }),
    } as unknown as GoalApiClient;

    const mockDeactivateUpdate = vi.fn();

    const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;
    __mockFrom.mockImplementation((table: string) => {
      if (table === "external_api_sync_state") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { quota_remaining: 500, quota_limit: 1000 } }),
            }),
          }),
        };
      }
      if (table === "teams") {
        return {
          select: () => ({
            not: () =>
              Promise.resolve({
                data: [
                  { id: "t1", goal_api_id: "ext1" },
                  { id: "t2", goal_api_id: "ext2" },
                ],
              }),
          }),
        };
      }
      if (table === "players") {
        return {
          select: () => ({
            or: () => Promise.resolve({ data: [] }),
            in: () => ({
              eq: () => ({
                not: () => Promise.resolve({ data: [{ id: "loc_old_p", goal_api_player_id: "disappeared" }] }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
          update: mockDeactivateUpdate,
        };
      }
      return {};
    });

    const service = new GoalApiPlayersSyncService(mockClient);
    const result = await service.executeSquadsSync();

    expect(result.success).toBe(false);
    expect(result.failedTeamsCount).toBe(1);
    expect(result.successfulTeamsCount).toBe(1);
    expect(result.deactivatedCount).toBe(0); // Deactivation skipped on partial failure!
  });
});
