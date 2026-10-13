import { NextRequest, NextResponse } from "next/server";
import { processPushNotificationsForWindow, WindowType } from "@/lib/push/reminder-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const expectedSecret = process.env.PUSH_REMINDERS_CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: PUSH_REMINDERS_CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  // Accept secret EXCLUSIVELY via: Authorization: Bearer <PUSH_REMINDERS_CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid Bearer authorization header." },
      { status: 401 }
    );
  }

  const providedSecret = authHeader.substring(7).trim();
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized: Invalid secret." }, { status: 401 });
  }

  const requestedWindow = request.nextUrl.searchParams.get("window") as WindowType | null;
  const windowsToRun: WindowType[] = requestedWindow
    ? [requestedWindow]
    : ["24h", "3h", "30m"];

  const results: Record<string, any> = {};

  for (const win of windowsToRun) {
    try {
      const summary = await processPushNotificationsForWindow(win);
      results[win] = summary;
    } catch (err: any) {
      console.error(`Error processing push notifications for window ${win}:`, err);
      results[win] = { error: err?.message || "Execution error" };
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
