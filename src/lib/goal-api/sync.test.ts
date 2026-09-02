import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoalApiSyncService } from "./sync";
import { GoalApiClient, UCL_LEAGUE_ID } from "./client";

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

describe("GoalApiSyncService (100% Mocked)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reconciles events by inserting new, updating existing, and deleting removed events (e.g. VAR)", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const deleteSpy = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const selectSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: "db_ev_1", goal_api_event_id: "ext_ev_1" },
          { id: "db_ev_2", goal_api_event_id: "ext_ev_var_cancelled" }, // Disappeared in new response
        ],
      }),
    });

    const mockAdmin = {
      from: (table: string) => {
        if (table === "match_events") {
          return {
            upsert: upsertSpy,
            select: selectSpy,
            delete: deleteSpy,
          };
        }
        return {};
      },
    };

    const syncService = new GoalApiSyncService({} as any);

    const incomingEvents = [
      {
        id: "ext_ev_1",
        type: "GOAL",
        homeScorer: "B. Varga",
        homeScorerId: "574135623",
        time: "12",
      },
      {
        id: "ext_ev_3", // New event
        type: "GOAL",
        homeScorer: "L. Jovic",
        homeScorerId: "3945085378",
        time: "55",
      },
    ];

    const count = await syncService.reconcileMatchEvents(
      mockAdmin,
      "match_uuid_123",
      "home_team_uuid",
      "away_team_uuid",
      incomingEvents as any
    );

    expect(count).toBe(2);
    expect(upsertSpy).toHaveBeenCalledTimes(2);
    // Deleted event ext_ev_var_cancelled
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("skips updating matches when is_manual_override is true", async () => {
    const mockClient = {
      getLiveFixtures: vi.fn().mockResolvedValue([
        {
          id: "ext_fixture_1",
          leagueId: UCL_LEAGUE_ID,
          homeTeamScore: "2",
          awayTeamScore: "1",
          matchStatus: "LIVE",
        },
      ]),
    } as unknown as GoalApiClient;

    const mockRpc = vi.fn().mockImplementation((name) => {
      if (name === "acquire_sync_lease") return Promise.resolve({ data: true, error: null });
      if (name === "release_sync_lease") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const mockMatchesUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const { __mockFrom, __mockRpc } = await import("@/lib/supabase/admin") as any;
    __mockRpc.mockImplementation(mockRpc);
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
      if (table === "matches") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  id: "loc_match_1",
                  goal_api_fixture_id: "ext_fixture_1",
                  is_manual_override: true, // Manual override active!
                  status: "scheduled",
                  home_score: 0,
                  away_score: 0,
                  home_team_id: "h1",
                  away_team_id: "a1",
                },
              ],
            }),
          update: mockMatchesUpdate,
        };
      }
      return {};
    });

    const syncService = new GoalApiSyncService(mockClient);
    const res = await syncService.executeSync();

    expect(res.success).toBe(true);
    expect(res.skippedManualOverridesCount).toBe(1);
    expect(res.syncedMatchesCount).toBe(0);
    expect(mockMatchesUpdate).not.toHaveBeenCalled();
  });

  it("handles disappeared LIVE match by querying single fixture and triggering finalization if FINISHED", async () => {
    const mockClient = {
      getLiveFixtures: vi.fn().mockResolvedValue([]), // Empty live list (match finished)
      getFixtureById: vi.fn().mockResolvedValue({
        id: "ext_fixture_finished",
        leagueId: UCL_LEAGUE_ID,
        matchStatus: "FINISHED",
        homeTeamFtScore: "3",
        awayTeamFtScore: "1",
      }),
      getFixtureEvents: vi.fn().mockResolvedValue([]),
    } as unknown as GoalApiClient;

    const mockRpc = vi.fn().mockImplementation((name, args) => {
      if (name === "acquire_sync_lease") return Promise.resolve({ data: true, error: null });
      if (name === "release_sync_lease") return Promise.resolve({ data: null, error: null });
      if (name === "finalize_and_score_match") {
        expect(args.p_home_score).toBe(3);
        expect(args.p_away_score).toBe(1);
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { __mockFrom, __mockRpc } = await import("@/lib/supabase/admin") as any;
    __mockRpc.mockImplementation(mockRpc);
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
      if (table === "matches") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  id: "loc_match_live",
                  goal_api_fixture_id: "ext_fixture_finished",
                  is_manual_override: false,
                  status: "live", // Previously marked live
                  home_score: 1,
                  away_score: 0,
                  home_team_id: "h1",
                  away_team_id: "a1",
                },
              ],
            }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return {};
    });

    const syncService = new GoalApiSyncService(mockClient);
    const res = await syncService.executeSync();

    expect(res.success).toBe(true);
    expect(res.finalizedMatchesCount).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith("finalize_and_score_match", {
      p_match_id: "loc_match_live",
      p_home_score: 3,
      p_away_score: 1,
    });
  });

  it("blocks sync when DB lease is already held by another runner", async () => {
    const mockRpc = vi.fn().mockImplementation((name) => {
      if (name === "acquire_sync_lease") return Promise.resolve({ data: false, error: null }); // Lock busy!
      return Promise.resolve({ data: null, error: null });
    });

    const { __mockRpc } = await import("@/lib/supabase/admin") as any;
    __mockRpc.mockImplementation(mockRpc);

    const syncService = new GoalApiSyncService({} as any);
    const res = await syncService.executeSync();

    expect(res.success).toBe(false);
    expect(res.error).toContain("DB lease");
  });

  it("blocks sync when quota remaining is 15 or less", async () => {
    const mockRpc = vi.fn().mockImplementation((name) => {
      if (name === "acquire_sync_lease") return Promise.resolve({ data: true, error: null });
      if (name === "release_sync_lease") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { __mockFrom, __mockRpc } = await import("@/lib/supabase/admin") as any;
    __mockRpc.mockImplementation(mockRpc);
    __mockFrom.mockImplementation((table: string) => {
      if (table === "external_api_sync_state") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { quota_remaining: 10, quota_limit: 1000 } }), // Low quota!
            }),
          }),
        };
      }
      return {};
    });

    const syncService = new GoalApiSyncService({} as any);
    const res = await syncService.executeSync();

    expect(res.success).toBe(false);
    expect(res.error).toContain("Zbyt niski stan limitu zapytań");
  });

  it("handles POSTPONED status for disappeared live matches", async () => {
    const mockClient = {
      getLiveFixtures: vi.fn().mockResolvedValue([]),
      getFixtureById: vi.fn().mockResolvedValue({
        id: "ext_fixture_postponed",
        leagueId: UCL_LEAGUE_ID,
        matchStatus: "POSTPONED",
      }),
    } as unknown as GoalApiClient;

    const mockRpc = vi.fn().mockImplementation((name) => {
      if (name === "acquire_sync_lease") return Promise.resolve({ data: true, error: null });
      if (name === "release_sync_lease") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const { __mockFrom, __mockRpc } = await import("@/lib/supabase/admin") as any;
    __mockRpc.mockImplementation(mockRpc);
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
      if (table === "matches") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  id: "loc_match_live",
                  goal_api_fixture_id: "ext_fixture_postponed",
                  is_manual_override: false,
                  status: "live",
                  home_score: 0,
                  away_score: 0,
                  home_team_id: "h1",
                  away_team_id: "a1",
                },
              ],
            }),
          update: mockUpdate,
        };
      }
      return {};
    });

    const syncService = new GoalApiSyncService(mockClient);
    const res = await syncService.executeSync();

    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "postponed",
        is_betting_locked: true,
      })
    );
  });

  it("safely ignores unhandled/unknown status for disappeared live matches without risky finalization", async () => {
    const mockClient = {
      getLiveFixtures: vi.fn().mockResolvedValue([]),
      getFixtureById: vi.fn().mockResolvedValue({
        id: "ext_fixture_unknown",
        leagueId: UCL_LEAGUE_ID,
        matchStatus: "SOME_FUTURE_UNKNOWN_STATUS",
      }),
    } as unknown as GoalApiClient;

    const mockRpc = vi.fn().mockImplementation((name) => {
      if (name === "acquire_sync_lease") return Promise.resolve({ data: true, error: null });
      if (name === "release_sync_lease") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { __mockFrom, __mockRpc } = await import("@/lib/supabase/admin") as any;
    __mockRpc.mockImplementation(mockRpc);
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
      if (table === "matches") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  id: "loc_match_live",
                  goal_api_fixture_id: "ext_fixture_unknown",
                  is_manual_override: false,
                  status: "live",
                  home_score: 0,
                  away_score: 0,
                  home_team_id: "h1",
                  away_team_id: "a1",
                },
              ],
            }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return {};
    });

    const syncService = new GoalApiSyncService(mockClient);
    const res = await syncService.executeSync();

    expect(res.success).toBe(true);
    expect(res.finalizedMatchesCount).toBe(0);
    expect(mockRpc).not.toHaveBeenCalledWith("finalize_and_score_match", expect.anything());
  });

  it("isMatchWindowActive returns true when a match is live or near kickoff", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          or: () => ({
            limit: () => Promise.resolve({ data: [{ id: "m1" }], error: null }),
          }),
        }),
      }),
    };

    const syncService = new GoalApiSyncService({} as any);
    const active = await syncService.isMatchWindowActive(mockSupabase as any);
    expect(active).toBe(true);
  });
});
