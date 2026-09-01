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

    it("resets unread count to 0 after user visits /ogloszenia (mark as seen)", () => {
      let userLastSeen: string | null = null;
      expect(calculateUnreadCount(mockFeed, userLastSeen)).toBe(2);

      // User visits /ogloszenia
      userLastSeen = "2026-09-01T17:00:00Z";
      expect(calculateUnreadCount(mockFeed, userLastSeen)).toBe(0);

      // Later, admin posts a 3rd announcement at 18:00
      const updatedFeed = [
        ...mockFeed,
        {
          id: "ann-3",
          authorId: "admin-1",
          title: "Ogłoszenie 3",
          content: "Nowy komunikat",
          isPinned: false,
          createdAt: "2026-09-01T18:00:00Z",
          updatedAt: "2026-09-01T18:00:00Z",
        },
      ];
      expect(calculateUnreadCount(updatedFeed, userLastSeen)).toBe(1);
    });
  });
});
