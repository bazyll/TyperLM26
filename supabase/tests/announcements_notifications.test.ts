import { describe, it, expect } from "vitest";
import { createAnnouncementSchema, updateAnnouncementSchema } from "../../src/lib/announcements/schemas";

describe("Announcements & Unread Notifications Logic", () => {
  interface MockAnnouncement {
    id: string;
    authorId: string;
    title: string;
    content: string;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
  }

  interface MockProfile {
    id: string;
    username: string;
    role: "user" | "admin";
    isActive: boolean;
    announcementsLastSeenAt: string | null;
  }

  describe("Announcements Validation Schemas & Admin Permissions", () => {
    it("validates valid announcement payload", () => {
      const validPayload = {
        title: "Ważna aktualizacja reguł",
        content: "Przypominamy o konieczności obstawienia typów przed pierwszym gwizdkiem.",
        isPinned: true,
      };
      const result = createAnnouncementSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(validPayload.title);
        expect(result.data.isPinned).toBe(true);
      }
    });

    it("rejects too short title or content", () => {
      const invalidTitle = { title: "Ab", content: "Treść ogłoszenia", isPinned: false };
      expect(createAnnouncementSchema.safeParse(invalidTitle).success).toBe(false);

      const invalidContent = { title: "Długi poprawny tytuł", content: "Kró", isPinned: false };
      expect(createAnnouncementSchema.safeParse(invalidContent).success).toBe(false);
    });

    it("requires UUID on updateAnnouncementSchema", () => {
      const invalidUpdate = {
        id: "not-a-uuid",
        title: "Aktualizacja",
        content: "Poprawna treść ogłoszenia",
        isPinned: false,
      };
      expect(updateAnnouncementSchema.safeParse(invalidUpdate).success).toBe(false);

      const validUpdate = {
        id: "11111111-1111-1111-1111-111111111111",
        title: "Aktualizacja",
        content: "Poprawna treść ogłoszenia",
        isPinned: false,
      };
      expect(updateAnnouncementSchema.safeParse(validUpdate).success).toBe(true);
    });

    it("enforces admin-only permission rule for creating announcements", () => {
      const adminUser: MockProfile = {
        id: "admin-1",
        username: "admin",
        role: "admin",
        isActive: true,
        announcementsLastSeenAt: null,
      };

      const regularUser: MockProfile = {
        id: "user-1",
        username: "player1",
        role: "user",
        isActive: true,
        announcementsLastSeenAt: null,
      };

      const inactiveAdmin: MockProfile = {
        id: "admin-2",
        username: "banned_admin",
        role: "admin",
        isActive: false,
        announcementsLastSeenAt: null,
      };

      const checkCanManageAnnouncements = (p: MockProfile) => p.isActive && p.role === "admin";

      expect(checkCanManageAnnouncements(adminUser)).toBe(true);
      expect(checkCanManageAnnouncements(regularUser)).toBe(false);
      expect(checkCanManageAnnouncements(inactiveAdmin)).toBe(false);
    });
  });

  describe("Homepage Feed Slice (Max 3 Announcements)", () => {
    const sampleAnnouncements: MockAnnouncement[] = [
      {
        id: "ann-pin-old",
        authorId: "admin-1",
        title: "Przypięte 1 (Starsze)",
        content: "Treść 1",
        isPinned: true,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-01T10:00:00Z",
      },
      {
        id: "ann-pin-new",
        authorId: "admin-1",
        title: "Przypięte 2 (Najnowsze)",
        content: "Treść 2",
        isPinned: true,
        createdAt: "2026-09-01T12:00:00Z",
        updatedAt: "2026-09-01T12:00:00Z",
      },
      {
        id: "ann-norm-new",
        authorId: "admin-1",
        title: "Zwykłe (Najnowsze)",
        content: "Treść 3",
        isPinned: false,
        createdAt: "2026-09-01T14:00:00Z",
        updatedAt: "2026-09-01T14:00:00Z",
      },
      {
        id: "ann-norm-old",
        authorId: "admin-1",
        title: "Zwykłe (Starsze)",
        content: "Treść 4",
        isPinned: false,
        createdAt: "2026-09-01T08:00:00Z",
        updatedAt: "2026-09-01T08:00:00Z",
      },
    ];

    const sortAndSliceFeed = (items: MockAnnouncement[], max = 3) => {
      return [...items]
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, max);
    };

    it("selects exactly 3 announcements prioritizing pinned then newest", () => {
      const feed = sortAndSliceFeed(sampleAnnouncements, 3);
      expect(feed.length).toBe(3);
      // Pinned newest first
      expect(feed[0].id).toBe("ann-pin-new");
      // Pinned older second
      expect(feed[1].id).toBe("ann-pin-old");
      // Normal newest third
      expect(feed[2].id).toBe("ann-norm-new");
      // Oldest normal not in top 3
      expect(feed.some((a) => a.id === "ann-norm-old")).toBe(false);
    });

    it("handles 4 pinned announcements by slicing only top 3 newest pinned", () => {
      const allPinned = sampleAnnouncements.map((a, i) => ({
        ...a,
        isPinned: true,
        createdAt: `2026-09-01T1${i}:00:00Z`,
      }));
      const feed = sortAndSliceFeed(allPinned, 3);
      expect(feed.length).toBe(3);
      expect(feed.every((a) => a.isPinned)).toBe(true);
    });

    it("handles 0 pinned announcements by showing 3 newest regular announcements", () => {
      const noPinned = sampleAnnouncements.map((a) => ({ ...a, isPinned: false }));
      const feed = sortAndSliceFeed(noPinned, 3);
      expect(feed.length).toBe(3);
      expect(feed[0].id).toBe("ann-norm-new");
    });
  });

  describe("Unread Count & Notifications Logic", () => {
    const mockFeed: MockAnnouncement[] = [
      {
        id: "ann-1",
        authorId: "admin-1",
        title: "Ogłoszenie 1",
        content: "Treść 1",
        isPinned: false,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-01T10:00:00Z",
      },
      {
        id: "ann-2",
        authorId: "admin-1",
        title: "Ogłoszenie 2",
        content: "Treść 2",
        isPinned: true,
        createdAt: "2026-09-01T14:00:00Z",
        updatedAt: "2026-09-01T14:00:00Z",
      },
    ];

    const calculateUnreadCount = (announcements: MockAnnouncement[], lastSeenAt: string | null) => {
      if (!lastSeenAt) return announcements.length;
      const seenTime = new Date(lastSeenAt).getTime();
      return announcements.filter((a) => new Date(a.createdAt).getTime() > seenTime).length;
    };

    it("returns all announcements as unread when user has lastSeenAt = null", () => {
      const count = calculateUnreadCount(mockFeed, null);
      expect(count).toBe(2);
    });

    it("returns 0 unread when user viewed after all existing announcements were created", () => {
      const lastSeen = "2026-09-01T15:00:00Z";
      const count = calculateUnreadCount(mockFeed, lastSeen);
      expect(count).toBe(0);
    });

    it("increments unread count by 1 when a new announcement is added after lastSeenAt", () => {
      const lastSeen = "2026-09-01T12:00:00Z"; // Between ann-1 (10:00) and ann-2 (14:00)
      const count = calculateUnreadCount(mockFeed, lastSeen);
      expect(count).toBe(1); // Only ann-2 is unread
    });

    it("does NOT increase unread count when an existing announcement is edited (updated_at changes, created_at remains)", () => {
      const lastSeen = "2026-09-01T15:00:00Z";
      const editedFeed = mockFeed.map((a) =>
        a.id === "ann-1"
          ? { ...a, content: "Zmieniona treść", updatedAt: "2026-09-01T16:00:00Z" }
          : a
      );
      const count = calculateUnreadCount(editedFeed, lastSeen);
      expect(count).toBe(0);
    });

    it("does NOT increase unread count when an existing announcement is pinned/unpinned", () => {
      const lastSeen = "2026-09-01T15:00:00Z";
      const pinnedFeed = mockFeed.map((a) =>
        a.id === "ann-1" ? { ...a, isPinned: true, updatedAt: "2026-09-01T16:30:00Z" } : a
      );
      const count = calculateUnreadCount(pinnedFeed, lastSeen);
      expect(count).toBe(0);
    });

    it("handles race condition: user opens feed with A and B, seen marker sets to MAX(B.created_at), later C is created -> C is unread", () => {
      const feedAtOpen: MockAnnouncement[] = [
        {
          id: "ann-A",
          authorId: "admin-1",
          title: "Ogłoszenie A",
          content: "Treść A",
          isPinned: false,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
        {
          id: "ann-B",
          authorId: "admin-1",
          title: "Ogłoszenie B",
          content: "Treść B",
          isPinned: true,
          createdAt: "2026-09-01T12:00:00Z",
          updatedAt: "2026-09-01T12:00:00Z",
        },
      ];

      // Client calculates MAX(created_at) from the received feed items (B is latest: 12:00:00Z)
      const maxFeedCreatedAt = feedAtOpen.reduce((max, ann) => {
        return new Date(ann.createdAt).getTime() > new Date(max).getTime() ? ann.createdAt : max;
      }, feedAtOpen[0].createdAt);

      expect(maxFeedCreatedAt).toBe("2026-09-01T12:00:00Z");

      // Server sets user.announcements_last_seen_at = maxFeedCreatedAt
      let userLastSeenAt: string | null = maxFeedCreatedAt;

      // Currently in feedAtOpen, unread is 0
      expect(calculateUnreadCount(feedAtOpen, userLastSeenAt)).toBe(0);

      // Now admin publishes announcement C at 12:05:00Z
      const feedWithC: MockAnnouncement[] = [
        ...feedAtOpen,
        {
          id: "ann-C",
          authorId: "admin-1",
          title: "Ogłoszenie C",
          content: "Treść C",
          isPinned: false,
          createdAt: "2026-09-01T12:05:00Z",
          updatedAt: "2026-09-01T12:05:00Z",
        },
      ];

      // Even if user's browser is still open, C is unread because C.created_at (12:05) > lastSeenAt (12:00)
      const unreadCount = calculateUnreadCount(feedWithC, userLastSeenAt);
      expect(unreadCount).toBe(1);
    });

    it("server-side safely caps client-supplied timestamp so it cannot exceed DB max created_at", () => {
      const dbAnnouncements: MockAnnouncement[] = [
        {
          id: "ann-A",
          authorId: "admin-1",
          title: "Ogłoszenie A",
          content: "Treść A",
          isPinned: false,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
        {
          id: "ann-B",
          authorId: "admin-1",
          title: "Ogłoszenie B",
          content: "Treść B",
          isPinned: true,
          createdAt: "2026-09-01T12:00:00Z",
          updatedAt: "2026-09-01T12:00:00Z",
        },
      ];

      const resolveSafeSeenTimestamp = (
        dbLatestCreatedAt: string | null,
        clientSuppliedTime?: string
      ) => {
        if (!dbLatestCreatedAt) return null;
        const maxDbTime = new Date(dbLatestCreatedAt).getTime();
        let target = dbLatestCreatedAt;
        if (clientSuppliedTime) {
          const clientTime = new Date(clientSuppliedTime).getTime();
          if (!isNaN(clientTime) && clientTime <= maxDbTime) {
            target = clientSuppliedTime;
          }
        }
        return target;
      };

      const dbMaxCreatedAt = "2026-09-01T12:00:00Z";

      // Case 1: Client sends a malicious future date (e.g. year 2099)
      const maliciousFutureTime = "2099-01-01T00:00:00Z";
      const resolvedMalicious = resolveSafeSeenTimestamp(dbMaxCreatedAt, maliciousFutureTime);
      expect(resolvedMalicious).toBe("2026-09-01T12:00:00Z"); // Capped to DB max!

      // Case 2: Client sends an older timestamp from an older cached page (e.g. 10:00:00Z)
      const olderTime = "2026-09-01T10:00:00Z";
      const resolvedOlder = resolveSafeSeenTimestamp(dbMaxCreatedAt, olderTime);
      expect(resolvedOlder).toBe("2026-09-01T10:00:00Z"); // Allowed since <= maxDbTime
    });
  });
});

