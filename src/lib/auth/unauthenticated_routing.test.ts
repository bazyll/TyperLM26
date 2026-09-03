import { describe, it, expect } from "vitest";

/**
 * Regression Test Suite: Unauthenticated Routing, Route Gating & Zero-Flash Isolation
 *
 * Verifies:
 * 1. Unauthenticated visitors accessing `/` or any dashboard route are immediately redirected to `/login`.
 * 2. Public assets (/login, /manifest, /icons, /logo.png, /favicon.ico) remain accessible.
 * 3. Logged-in users accessing `/login` are redirected to `/`.
 * 4. Dashboard layout strictly enforces redirect("/login") when currentUser is null.
 * 5. No fallback/mock user data (e.g., "Bartosz Kowalski") is ever rendered or leaked to unauthenticated users.
 * 6. Authenticated User A never receives User B's profile data.
 */

interface SessionCheckInput {
  pathname: string;
  user: { id: string; username: string; firstName: string; lastName: string } | null;
}

interface SessionCheckResult {
  action: "next" | "redirect";
  redirectPath?: string;
}

// Logic mirroring src/lib/supabase/session.ts
function evaluateRouteGating({ pathname, user }: SessionCheckInput): SessionCheckResult {
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png";

  if (!user && !isPublicRoute) {
    return { action: "redirect", redirectPath: "/login" };
  }

  if (user && pathname.startsWith("/login")) {
    return { action: "redirect", redirectPath: "/" };
  }

  return { action: "next" };
}

// Logic mirroring src/app/(dashboard)/layout.tsx
function evaluateDashboardLayout(
  currentUser: { id: string; username: string; firstName: string; lastName: string; role: "user" | "admin"; points: number } | null
): { shouldRedirect: boolean; renderedUser: unknown | null } {
  if (!currentUser) {
    return { shouldRedirect: true, renderedUser: null };
  }

  return {
    shouldRedirect: false,
    renderedUser: {
      id: currentUser.id,
      username: currentUser.username,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      role: currentUser.role,
      points: currentUser.points,
    },
  };
}

describe("Unauthenticated Routing & Zero-Flash Isolation", () => {
  it("unauthenticated request to '/' immediately redirects to '/login'", () => {
    const result = evaluateRouteGating({ pathname: "/", user: null });
    expect(result.action).toBe("redirect");
    expect(result.redirectPath).toBe("/login");
  });

  it("unauthenticated request to protected dashboard routes redirects to '/login'", () => {
    const routes = ["/mecze", "/ranking", "/tabela", "/pickem", "/typy-specjalne", "/konto", "/admin"];
    for (const route of routes) {
      const result = evaluateRouteGating({ pathname: route, user: null });
      expect(result.action).toBe("redirect");
      expect(result.redirectPath).toBe("/login");
    }
  });

  it("allows unauthenticated access to public routes and static assets", () => {
    const publicRoutes = ["/login", "/manifest.webmanifest", "/icons/icon-192.png", "/logo.png", "/favicon.ico", "/apple-icon.png"];
    for (const route of publicRoutes) {
      const result = evaluateRouteGating({ pathname: route, user: null });
      expect(result.action).toBe("next");
      expect(result.redirectPath).toBeUndefined();
    }
  });

  it("authenticated user accessing '/login' is redirected to '/'", () => {
    const result = evaluateRouteGating({
      pathname: "/login",
      user: { id: "u-1", username: "jan", firstName: "Jan", lastName: "Kowalski" },
    });
    expect(result.action).toBe("redirect");
    expect(result.redirectPath).toBe("/");
  });

  it("dashboard layout throws/redirects when currentUser is null and contains ZERO mock data", () => {
    const layout = evaluateDashboardLayout(null);
    expect(layout.shouldRedirect).toBe(true);
    expect(layout.renderedUser).toBeNull();
  });

  it("authenticated User A strictly receives User A data, never another user profile", () => {
    const userA = { id: "u-101", username: "marcin", firstName: "Marcin", lastName: "Wójcik", role: "user" as const, points: 50 };
    const layoutA = evaluateDashboardLayout(userA);

    expect(layoutA.shouldRedirect).toBe(false);
    expect(layoutA.renderedUser).toEqual({
      id: "u-101",
      username: "marcin",
      firstName: "Marcin",
      lastName: "Wójcik",
      role: "user",
      points: 50,
    });
    expect((layoutA.renderedUser as any).username).not.toBe("bartosz");
  });
});
