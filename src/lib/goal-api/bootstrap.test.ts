import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateUclScheduleDataset, bootstrapFullUclSchedule } from "./bootstrap";
import rawDataset from "@/data/ucl-2026-27-league-phase.json";

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

describe("UCL 144 Schedule Bootstrap & Invariant Validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Dataset Static Invariant Validation", () => {
    it("validates that the 144-match UEFA dataset satisfies all mathematical invariants", () => {
      const result = validateUclScheduleDataset(rawDataset as any);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.totalMatches).toBe(144);
      expect(result.uniqueTeamsCount).toBe(36);
      expect(result.teamsWith4H4A).toBe(true);

      // Check each matchday has exactly 18 matches
      for (let md = 1; md <= 8; md++) {
        expect(result.matchdaysCount[md]).toBe(18);
      }
    });

    it("fails validation if a match has home === away or unknown team", () => {
      const invalidDataset = [
        {
          id: "fix-1",
          matchday: 1,
          homeTeam: "Real Madrid",
          awayTeam: "Real Madrid",
          kickoffUtc: "2026-09-08T19:00:00.000Z",
          goalApiFixtureId: null,
          source: "UEFA",
        },
      ];

      const res = validateUclScheduleDataset(invalidDataset as any);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Gospodarz i gość są tą samą drużyną"))).toBe(true);
    });
  });

  describe("bootstrapFullUclSchedule", () => {
    it("re-uses existing 18 MD1 matches and inserts remaining 126 matches idempotently", async () => {
      const { __mockFrom } = (await import("@/lib/supabase/admin")) as any;

      // Mock 36 teams in DB
      const mock36Teams = Array.from(new Set(rawDataset.flatMap((m: any) => [m.homeTeam, m.awayTeam]))).map(
        (name, idx) => ({
          id: `team_uuid_${idx + 1}`,
          name,
          short_name: name,
          code: `T${idx + 1 < 10 ? "0" + (idx + 1) : idx + 1}`,
          goal_api_id: `goal_team_${idx + 1}`,
        })
      );

      // Mock 18 existing MD1 matches in DB
      const existing18Matches = rawDataset.slice(0, 18).map((m: any, idx) => {
        const hTeam = mock36Teams.find((t) => t.name === m.homeTeam)!;
        const aTeam = mock36Teams.find((t) => t.name === m.awayTeam)!;
        return {
          id: `match_uuid_${idx + 1}`,
          matchday: 1,
          home_team_id: hTeam.id,
          away_team_id: aTeam.id,
          kickoff_at: m.kickoffUtc,
          goal_api_fixture_id: m.goalApiFixtureId,
          is_manual_override: false,
          status: "scheduled",
        };
      });

      let matchesDb: any[] = [...existing18Matches];

      __mockFrom.mockImplementation((tableName: string) => {
        if (tableName === "teams") {
          return {
            select: () => ({
              not: () => Promise.resolve({ data: mock36Teams, error: null }),
            }),
          };
        }

        if (tableName === "matches") {
          return {
            select: () => Promise.resolve({ data: matchesDb, error: null }),
            insert: (row: any) => {
              const inserted = { id: `new_match_uuid_${matchesDb.length + 1}`, ...row };
              matchesDb.push(inserted);
              return Promise.resolve({ error: null });
            },
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }

        return {};
      });

      const res = await bootstrapFullUclSchedule();

      expect(res.success).toBe(true);
      expect(res.totalDatasetMatches).toBe(144);
      expect(res.existingReusedCount).toBe(18); // Exact 18 MD1 reused
      expect(res.newMatchesInsertedCount).toBe(126); // Exact 126 new matches inserted
      expect(matchesDb).toHaveLength(144);

      // Second run (Idempotency test)
      const res2 = await bootstrapFullUclSchedule();
      expect(res2.success).toBe(true);
      expect(res2.existingReusedCount).toBe(144); // All 144 now exist & reused
      expect(res2.newMatchesInsertedCount).toBe(0); // 0 duplicates
      expect(matchesDb).toHaveLength(144);
    });
  });
});
