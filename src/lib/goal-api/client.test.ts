import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoalApiClient } from "./client";
import { goalApiFixtureSchema, goalApiRawEventSchema } from "./schemas";

describe("GoalApiClient & Zod Schemas (100% Mocked)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates well-formed fixture schema", () => {
    const rawFixture = {
      id: "cmtje82y62vt1r8072j9utsfv",
      leagueId: "cmr77dw3900f5rx06j05wgzv4",
      leagueName: "UEFA Champions League",
      leagueYear: "2026/2027",
      matchDate: "2026-09-10",
      matchTime: "19:00",
      kickoffUtc: "2026-09-10T19:00:00.000Z",
      matchStatus: "SCHEDULED",
      homeTeamName: "Manchester Utd",
      awayTeamName: "Sabah Baku",
      homeTeamScore: null,
      awayTeamScore: null,
    };

    const parsed = goalApiFixtureSchema.safeParse(rawFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.homeTeamName).toBe("Manchester Utd");
      expect(parsed.data.matchStatus).toBe("SCHEDULED");
    }
  });

  it("validates GOAL event with assist", () => {
    const rawEvent = {
      id: "cmtezh4h61aeuo807rsz0nqnp",
      time: "12",
      type: "GOAL",
      homeScorer: "B. Varga",
      homeScorerId: "574135623",
      homeAssist: "F. Relvas",
      homeAssistId: "2973220993",
      score: "2 - 0",
      info: null,
      scoreInfoTime: "1st Half",
    };

    const parsed = goalApiRawEventSchema.safeParse(rawEvent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.homeScorer).toBe("B. Varga");
      expect(parsed.data.homeAssist).toBe("F. Relvas");
      expect(parsed.data.time).toBe("12");
    }
  });

  it("validates penalty event without assist", () => {
    const rawPenalty = {
      id: "cmtezh4hd1aeyo807avqesngc",
      time: "18",
      type: "GOAL",
      homeScorer: "Z. Tripic",
      homeScorerId: "2560433815",
      homeAssist: null,
      homeAssistId: null,
      score: "1 - 1",
      info: "Penalty",
      scoreInfoTime: "1st Half",
    };

    const parsed = goalApiRawEventSchema.safeParse(rawPenalty);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.homeScorer).toBe("Z. Tripic");
      expect(parsed.data.homeAssist).toBeNull();
      expect(parsed.data.info).toBe("Penalty");
    }
  });

  it("parses rate limit headers correctly from response", async () => {
    const mockHeaders = new Headers({
      "x-ratelimit-limit": "1000",
      "x-ratelimit-remaining": "980",
      "x-ratelimit-reset": "1788393600",
      "x-ratelimit-type": "DAILY",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => ({ success: true, data: [] }),
    } as any);

    const client = new GoalApiClient("dummy_test_api_key_valid_length_12345", "https://api.goal-api.com/v1");
    const res = await client.checkConnection();

    expect(res.success).toBe(true);
    expect(res.rateLimit.quotaLimit).toBe(1000);
    expect(res.rateLimit.quotaRemaining).toBe(980);
    expect(res.rateLimit.quotaType).toBe("DAILY");
  });

  it("throws clear error on HTTP 401 Unauthorized", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers(),
      json: async () => ({ success: false, code: "INVALID_API_KEY" }),
    } as any);

    const client = new GoalApiClient("dummy_invalid_key_12345678", "https://api.goal-api.com/v1");
    await expect(client.getUclFixtures()).rejects.toThrow("401 Unauthorized");
  });

  it("throws clear error on HTTP 429 Rate Limit Exceeded", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers(),
      json: async () => ({ success: false, code: "RATE_LIMIT_EXCEEDED" }),
    } as any);

    const client = new GoalApiClient("dummy_key_1234567890", "https://api.goal-api.com/v1");
    await expect(client.getUclFixtures()).rejects.toThrow("429 Too Many Requests");
  });

  it("preserves badge fields (teamHomeBadge, teamAwayBadge, homeTeam.badge, awayTeam.badge) when parsing fixture", () => {
    const fixtureWithBadges = {
      id: "cmtje82y62vt1r8072j9utsfv",
      leagueId: "cmr77dw3900f5rx06j05wgzv4",
      leagueName: "UEFA Champions League",
      matchDate: "2026-09-10",
      matchTime: "19:00",
      kickoffUtc: "2026-09-10T19:00:00.000Z",
      matchStatus: "SCHEDULED",
      homeTeamName: "Manchester Utd",
      awayTeamName: "Sabah Baku",
      teamHomeBadge: "https://media.goal-api.com/badges/102_manchester-united.jpg",
      teamAwayBadge: "https://media.goal-api.com/badges/1305_sabah.jpg",
      homeTeam: {
        id: "cmr7fp1wp2n8yrx061vxmb1a5",
        name: "Manchester United",
        badge: "https://media.goal-api.com/badges/102_manchester-united.jpg",
      },
      awayTeam: {
        id: "cmri0gkbgbr6mlb07s324klf3",
        name: "Sabah",
        badge: "https://media.goal-api.com/badges/1305_sabah.jpg",
      },
    };

    const parsed = goalApiFixtureSchema.parse(fixtureWithBadges);

    expect(parsed.teamHomeBadge).toBe("https://media.goal-api.com/badges/102_manchester-united.jpg");
    expect(parsed.teamAwayBadge).toBe("https://media.goal-api.com/badges/1305_sabah.jpg");
    expect(parsed.homeTeam?.badge).toBe("https://media.goal-api.com/badges/102_manchester-united.jpg");
    expect(parsed.awayTeam?.badge).toBe("https://media.goal-api.com/badges/1305_sabah.jpg");
  });
});
