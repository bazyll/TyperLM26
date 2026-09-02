import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupSafeOrphanTeams, APPROVED_SAFE_ORPHAN_TEAM_IDS } from "./cleanup";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => {
  const mockFrom = vi.fn();
  return {
    createAdminClient: () => ({
      from: mockFrom,
    }),
    __mockFrom: mockFrom,
  };
});

describe("Safe Orphan Teams Cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes only orphan teams with goal_api_id=null and 0 FK references", async () => {
    const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;

    let teamsDb: any[] = APPROVED_SAFE_ORPHAN_TEAM_IDS.map((id, idx) => ({
      id,
      name: `Orphan Team ${idx + 1}`,
      code: `D${idx + 1 < 10 ? "0" + (idx + 1) : idx + 1}`,
      goal_api_id: null,
    }));

    // Add a protected team with goal_api_id and an extra FK
    teamsDb[0].goal_api_id = "already_synced_id"; // Should be skipped!

    const deletedIds: string[] = [];

    __mockFrom.mockImplementation((tableName: string) => {
      if (tableName === "teams") {
        return {
          select: () => ({
            eq: (_field: string, val: any) => ({
              single: () => {
                const team = teamsDb.find((t) => t.id === val);
                return Promise.resolve({ data: team || null, error: null });
              },
            }),
          }),
          delete: () => ({
            eq: (_field: string, val: any) => {
              deletedIds.push(val);
              teamsDb = teamsDb.filter((t) => t.id !== val);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      // FK tables return 0 references
      return {
        select: () => ({
          eq: () => Promise.resolve({ count: 0, error: null }),
        }),
      };
    });

    const res = await cleanupSafeOrphanTeams();

    expect(res.success).toBe(true);
    expect(res.deletedCount).toBe(15); // 15 deleted, 1 skipped because goal_api_id was not null
    expect(res.skippedCount).toBe(1);
    expect(deletedIds).toHaveLength(15);
  });
});
