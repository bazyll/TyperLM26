import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRealtimeMatches } from "./use-realtime-matches";

// Mock Supabase client
const mockSubscribe = vi.fn();
const mockOn = vi.fn();
const mockRemoveChannel = vi.fn().mockResolvedValue("ok");

let changeHandler: ((payload: any) => void) | null = null;

mockOn.mockImplementation((_event, _filter, callback) => {
  changeHandler = callback;
  return { subscribe: mockSubscribe };
});

const mockChannel = vi.fn().mockReturnValue({
  on: mockOn,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  }),
}));

// Mock React useEffect
let effectCleanup: (() => void) | undefined;
vi.mock("react", () => ({
  useEffect: (cb: () => void) => {
    effectCleanup = cb() as any;
  },
}));

describe("useRealtimeMatches hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changeHandler = null;
    effectCleanup = undefined;
  });

  it("subscribes to Supabase Realtime UPDATE events on 'matches' table", () => {
    const onMatchUpdate = vi.fn();
    useRealtimeMatches({ onMatchUpdate });

    expect(mockChannel).toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matches",
      },
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("dispatches onMatchUpdate when a postgres_changes event is received", () => {
    const onMatchUpdate = vi.fn();
    useRealtimeMatches({ onMatchUpdate });

    expect(changeHandler).toBeDefined();

    // Simulate Supabase Realtime payload
    changeHandler!({
      new: {
        id: "match_123",
        home_score: 2,
        away_score: 1,
        status: "live",
        last_synced_at: "2026-09-02T19:00:00Z",
        is_manual_override: false,
        is_betting_locked: true,
      },
    });

    expect(onMatchUpdate).toHaveBeenCalledWith({
      id: "match_123",
      home_score: 2,
      away_score: 1,
      status: "live",
      last_synced_at: "2026-09-02T19:00:00Z",
      is_manual_override: false,
      is_betting_locked: true,
    });
  });

  it("cleans up subscription when unmounted", () => {
    const onMatchUpdate = vi.fn();
    useRealtimeMatches({ onMatchUpdate });

    expect(typeof effectCleanup).toBe("function");
    effectCleanup!();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
