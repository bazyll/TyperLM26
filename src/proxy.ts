import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Next.js 16 Proxy Entrypoint
 *
 * Intercepts requests to refresh Supabase session and perform initial route gating.
 * Note: Sensitive Server Actions & Route Handlers must always re-verify user identity & role.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with common extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
