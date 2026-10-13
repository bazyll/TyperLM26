import { describe, it, expect } from "vitest";
import {
  evaluateUserMatchesForWindow,
  getWindowTimeBounds,
  computeWindowBucket,
  InMemoryPushClaimStore,
  MatchForPush,
} from "./reminder-engine";

describe("Web Push Reminder Engine Logic", () => {
  const baseTime = new Date("2026-09-16T18:00:00.000Z").getTime();

  const mockMatches: MatchForPush[] = [
    {
      id: "match-1",
      kickoff_at: new Date(baseTime + 30 * 60 * 1000).toISOString(), // +30m
      home_team_name: "PSG",
      away_team_name: "Real Madrid",
    },
    {
      id: "match-2",
      kickoff_at: new Date(baseTime + 45 * 60 * 1000).toISOString(), // +45m
      home_team_name: "Bayern",
      away_team_name: "Arsenal",
    },
    {
      id: "match-3",
      kickoff_at: new Date(baseTime + 60 * 60 * 1000).toISOString(), // +60m
      home_team_name: "Inter",
      away_team_name: "Barcelona",
    },
  ];

  it("sends 0 notifications if user has already predicted all matches in the window", () => {
    const predictedMatchIds = new Set(["match-1", "match-2", "match-3"]);

    const result = evaluateUserMatchesForWindow(mockMatches, predictedMatchIds, baseTime);

    expect(result.shouldNotify).toBe(false);
    expect(result.unpredictedCount).toBe(0);
    expect(result.unpredictedMatchIds).toEqual([]);
    expect(result.title).toBe("");
  });

  it("sends notification if user has not predicted any matches in the window", () => {
    const predictedMatchIds = new Set<string>();

    const result = evaluateUserMatchesForWindow(mockMatches, predictedMatchIds, baseTime);

    expect(result.shouldNotify).toBe(true);
    expect(result.unpredictedCount).toBe(3);
    expect(result.unpredictedMatchIds).toEqual(["match-1", "match-2", "match-3"]);
    expect(result.title).toContain("3 nieobstawione mecze");
    expect(result.body).toContain("za 30 min");
  });

  it("sends notification with only the remaining unpredicted matches if user partially predicted", () => {
    const predictedMatchIds = new Set(["match-1"]);

    const result = evaluateUserMatchesForWindow(mockMatches, predictedMatchIds, baseTime);

    expect(result.shouldNotify).toBe(true);
    expect(result.unpredictedCount).toBe(2);
    expect(result.unpredictedMatchIds).toEqual(["match-2", "match-3"]);
    expect(result.body).toContain("za 45 min");
  });

  it("correctly handles singular declension for 1 unpredicted match", () => {
    const singleMatchList: MatchForPush[] = [
      {
        id: "match-single",
        kickoff_at: new Date(baseTime + 25 * 60 * 1000).toISOString(),
      },
    ];

    const result = evaluateUserMatchesForWindow(singleMatchList, new Set(), baseTime);

    expect(result.shouldNotify).toBe(true);
    expect(result.unpredictedCount).toBe(1);
    expect(result.title).toContain("1 nieobstawione mecz");
  });

  it("computes proper time bounds for 24h, 3h, and 30m windows", () => {
    const bounds24h = getWindowTimeBounds("24h", baseTime);
    expect(bounds24h.start.getTime() - baseTime).toBe(23 * 3600 * 1000);
    expect(bounds24h.end.getTime() - baseTime).toBe(24.5 * 3600 * 1000);

    const bounds3h = getWindowTimeBounds("3h", baseTime);
    expect(bounds3h.start.getTime() - baseTime).toBe(2.5 * 3600 * 1000);
    expect(bounds3h.end.getTime() - baseTime).toBe(3.5 * 3600 * 1000);

    const bounds30m = getWindowTimeBounds("30m", baseTime);
    expect(bounds30m.start.getTime() - baseTime).toBe(20 * 60 * 1000);
    expect(bounds30m.end.getTime() - baseTime).toBe(35 * 60 * 1000);
  });

  it("two concurrent cron executions -> exactly one logical notification", async () => {
    const claimStore = new InMemoryPushClaimStore();
    const userId = "user-1234-abcd";
    const windowType = "30m";
    const windowBucket = computeWindowBucket(windowType, mockMatches);
    const unpredictedMatchIds = ["match-1", "match-2"];

    let worker1PushesSent = 0;
    let worker2PushesSent = 0;

    // Simulate worker 1 and worker 2 running simultaneously
    const worker1 = async () => {
      const claim = await claimStore.claim(userId, windowType, windowBucket, unpredictedMatchIds, 300);
      if (!claim.claimed) {
        return; // Skipped due to conflict/active claim
      }
      // Simulate network push delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      worker1PushesSent++;
      await claimStore.complete(claim.logId!, "delivered");
    };

    const worker2 = async () => {
      const claim = await claimStore.claim(userId, windowType, windowBucket, unpredictedMatchIds, 300);
      if (!claim.claimed) {
        return; // Skipped due to conflict/active claim
      }
      // Simulate network push delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      worker2PushesSent++;
      await claimStore.complete(claim.logId!, "delivered");
    };

    // Run both workers concurrently
    await Promise.all([worker1(), worker2()]);

    const totalPushesSent = worker1PushesSent + worker2PushesSent;
    expect(totalPushesSent).toBe(1);

    // Verify stored log status is 'delivered'
    const records = claimStore.getAllRecords();
    expect(records.length).toBe(1);
    expect(records[0].status).toBe("delivered");

    // Any subsequent third execution also skips
    const thirdAttempt = await claimStore.claim(userId, windowType, windowBucket, unpredictedMatchIds, 300);
    expect(thirdAttempt.claimed).toBe(false);
    expect(thirdAttempt.reason).toBe("already_delivered");
  });

  it("recovers from stale-claim timeout when previous worker crashed in processing", async () => {
    const claimStore = new InMemoryPushClaimStore();
    const userId = "user-stale-test";
    const windowType = "3h";
    const windowBucket = "3h_bucket_1";
    const matchIds = ["m1"];

    // Worker 1 claims with a short stale timeout of 1 second and then crashes (never completes)
    const worker1Claim = await claimStore.claim(userId, windowType, windowBucket, matchIds, 1);
    expect(worker1Claim.claimed).toBe(true);
    expect(worker1Claim.reason).toBe("new_claim");

    // Immediate attempt while worker 1 is active (before timeout) is blocked
    const activeAttempt = await claimStore.claim(userId, windowType, windowBucket, matchIds, 1);
    expect(activeAttempt.claimed).toBe(false);
    expect(activeAttempt.reason).toBe("active_claim");

    // Wait for the 1 second stale timeout to elapse
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Later worker arrives after timeout: stale claim is reclaimed!
    const recoveredClaim = await claimStore.claim(userId, windowType, windowBucket, matchIds, 1);
    expect(recoveredClaim.claimed).toBe(true);
    expect(recoveredClaim.reason).toBe("reclaimed_stale");

    // Completes delivery
    await claimStore.complete(recoveredClaim.logId!, "delivered");
    const record = claimStore.getRecord(`${userId}:${windowType}:${windowBucket}`);
    expect(record?.status).toBe("delivered");
  });
});
