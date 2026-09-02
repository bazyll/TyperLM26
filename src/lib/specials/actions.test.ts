import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveAllSpecialPredictionsAction } from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/actions", () => ({
  getCurrentUserProfile: () =>
    Promise.resolve({
      id: "user-123",
      username: "testuser",
      role: "user",
    }),
}));

vi.mock("@/lib/supabase/server", () => {
  const mockFrom = vi.fn();
  return {
    createClient: () =>
      Promise.resolve({
        from: mockFrom,
      }),
    __mockFrom: mockFrom,
  };
});

describe("Special Predictions Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows selecting the same team for both winner and finalist categories", async () => {
    const { __mockFrom } = (await import("@/lib/supabase/server")) as any;

    const winnerCatId = "11111111-1111-4111-8111-111111111111";
    const finalistCatId = "22222222-2222-4222-8222-222222222222";
    const teamId = "33333333-3333-4333-8333-333333333333";

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    __mockFrom.mockImplementation((table: string) => {
      if (table === "special_prediction_categories") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  id: winnerCatId,
                  slug: "winner",
                  title: "Zwycięzca",
                  target_type: "team",
                  deadline_at: new Date(Date.now() + 86400000).toISOString(),
                  status: "open",
                },
                {
                  id: finalistCatId,
                  slug: "finalist",
                  title: "Finalista",
                  target_type: "team",
                  deadline_at: new Date(Date.now() + 86400000).toISOString(),
                  status: "open",
                },
              ],
              error: null,
            }),
        };
      }
      if (table === "teams") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [{ id: teamId }], error: null }),
          }),
        };
      }
      if (table === "special_predictions") {
        return {
          upsert: mockUpsert,
        };
      }
      return {};
    });

    const result = await saveAllSpecialPredictionsAction({
      predictions: [
        { categoryId: winnerCatId, selectedTeamId: teamId },
        { categoryId: finalistCatId, selectedTeamId: teamId },
      ],
    });

    if (!result.success) {
      console.error("Test failure reason:", result.error);
    }

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-123", category_id: winnerCatId, selected_team_id: teamId }),
      { onConflict: "user_id,category_id" }
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-123", category_id: finalistCatId, selected_team_id: teamId }),
      { onConflict: "user_id,category_id" }
    );
  });
});
