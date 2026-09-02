import { createAdminClient } from "@/lib/supabase/admin";
import {
  goalApiFixturesResponseSchema,
  goalApiSingleFixtureResponseSchema,
  goalApiEventsResponseSchema,
} from "./schemas";
import { GoalApiFixtureItem, GoalApiRawEvent, GoalApiRateLimitState } from "./types";

export const UCL_LEAGUE_ID = "cmr77dw3900f5rx06j05wgzv4";
export const UCL_SEASON_NAME = "2026/2027";

export class GoalApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    const rawKey = apiKey || process.env.GOAL_API_KEY || "";
    this.apiKey = rawKey.trim().replace(/^["'=]+|["']+$/g, "");
    this.baseUrl = (baseUrl || process.env.GOAL_API_BASE_URL || "https://api.goal-api.com/v1").trim().replace(/\/+$/, "");
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  private async fetchWithTimeout(endpoint: string, timeoutMs = 12000): Promise<{ response: Response; json: any; rateLimit: GoalApiRateLimitState }> {
    if (!this.isConfigured()) {
      throw new Error("Brak skonfigurowanego klucza GOAL_API_KEY na serwerze.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const rateLimit: GoalApiRateLimitState = {
        quotaLimit: response.headers.get("x-ratelimit-limit") ? Number(response.headers.get("x-ratelimit-limit")) : null,
        quotaRemaining: response.headers.get("x-ratelimit-remaining") ? Number(response.headers.get("x-ratelimit-remaining")) : null,
        quotaResetAt: response.headers.get("x-ratelimit-reset") ? new Date(Number(response.headers.get("x-ratelimit-reset")) * 1000).toISOString() : null,
        quotaType: response.headers.get("x-ratelimit-type"),
      };

      // Persist rate limit state asynchronously
      this.persistRateLimitState(rateLimit, response.ok, response.statusText).catch(() => {});

      if (response.status === 401) {
        throw new Error("GOAL API zwróciło 401 Unauthorized: Nieprawidłowy klucz API.");
      }

      if (response.status === 429) {
        throw new Error("GOAL API zwróciło 429 Too Many Requests: Wykorzystano limit zapytań.");
      }

      if (!response.ok) {
        throw new Error(`Błąd GOAL API (HTTP ${response.status}): ${response.statusText}`);
      }

      const json = await response.json();
      return { response, json, rateLimit };
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Przekroczono limit czasu oczekiwania na odpowiedź GOAL API (${timeoutMs}ms).`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async persistRateLimitState(rateLimit: GoalApiRateLimitState, isSuccess: boolean, errorText?: string) {
    try {
      const adminSupabase = createAdminClient();
      await adminSupabase.from("external_api_sync_state").upsert({
        provider: "goal_api",
        quota_limit: rateLimit.quotaLimit,
        quota_remaining: rateLimit.quotaRemaining,
        quota_reset_at: rateLimit.quotaResetAt,
        last_request_at: new Date().toISOString(),
        last_success_at: isSuccess ? new Date().toISOString() : undefined,
        last_error: isSuccess ? null : (errorText || "API Error"),
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Ignore DB logging failure in standalone tests
    }
  }

  /**
   * Health check / connection test
   */
  public async checkConnection(): Promise<{ success: boolean; rateLimit: GoalApiRateLimitState; message: string }> {
    const { json, rateLimit } = await this.fetchWithTimeout("/leagues");
    const count = Array.isArray(json?.data) ? json.data.length : 0;
    return {
      success: true,
      rateLimit,
      message: `Połączenie z GOAL API aktywne. Zwrócono ${count} lig. Pozostały limit: ${rateLimit.quotaRemaining ?? "?"}/${rateLimit.quotaLimit ?? "?"}`,
    };
  }

  /**
   * Fetches UEFA Champions League fixtures
   */
  public async getUclFixtures(): Promise<GoalApiFixtureItem[]> {
    const { json } = await this.fetchWithTimeout(`/leagues/${UCL_LEAGUE_ID}/fixtures`);
    const parsed = goalApiFixturesResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Błąd walidacji terminarza GOAL API: ${parsed.error.message}`);
    }
    return parsed.data.data;
  }

  /**
   * Fetches currently active live matches
   */
  public async getLiveFixtures(): Promise<GoalApiFixtureItem[]> {
    const { json } = await this.fetchWithTimeout("/fixtures/live");
    const parsed = goalApiFixturesResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Błąd walidacji meczów LIVE: ${parsed.error.message}`);
    }
    return parsed.data.data;
  }

  /**
   * Fetches details of a single fixture by provider ID
   */
  public async getFixtureById(fixtureId: string): Promise<GoalApiFixtureItem | null> {
    const { json } = await this.fetchWithTimeout(`/fixtures/${fixtureId}`);
    const parsed = goalApiSingleFixtureResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Błąd walidacji pojedynczego meczu: ${parsed.error.message}`);
    }
    return parsed.data.data || null;
  }

  /**
   * Fetches full event timeline for a fixture
   */
  public async getFixtureEvents(fixtureId: string): Promise<GoalApiRawEvent[]> {
    const { json } = await this.fetchWithTimeout(`/fixtures/${fixtureId}/events`);
    const parsed = goalApiEventsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Błąd walidacji zdarzeń meczowych: ${parsed.error.message}`);
    }

    if (Array.isArray(parsed.data.data)) {
      return parsed.data.data;
    }

    if (parsed.data.data && typeof parsed.data.data === "object" && "goals" in parsed.data.data) {
      return (parsed.data.data as any).goals || [];
    }

    return [];
  }

  /**
   * Fetches squad players for a team by provider team ID
   */
  public async getTeamPlayers(teamGoalApiId: string): Promise<import("./types").GoalApiPlayerItem[]> {
    const { json } = await this.fetchWithTimeout(`/teams/${teamGoalApiId}/players`);
    const { goalApiTeamPlayersResponseSchema } = await import("./schemas");
    const parsed = goalApiTeamPlayersResponseSchema.safeParse(json);
    if (!parsed.success) {
      return [];
    }
    return parsed.data.data;
  }

  /**
   * Searches players in GOAL API by name query
   */
  public async searchPlayers(query: string): Promise<import("./types").GoalApiPlayerItem[]> {
    const { json } = await this.fetchWithTimeout(`/players/search?q=${encodeURIComponent(query)}`);
    const { goalApiTeamPlayersResponseSchema } = await import("./schemas");
    const parsed = goalApiTeamPlayersResponseSchema.safeParse(json);
    if (!parsed.success) {
      return [];
    }
    return parsed.data.data;
  }
}

export const goalApiClient = new GoalApiClient();




