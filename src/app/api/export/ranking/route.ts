import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Route Handler: GET /api/export/ranking
 *
 * Generates an in-memory ranking snapshot (.txt file) and streams it directly to the browser.
 * Fully compatible with Vercel Serverless Functions — zero disk writes.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Verify session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const now = new Date();
    const dateFormatted = now.toLocaleString("pl-PL", { timeZone: "UTC" });
    const filenameDate = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);

    // Fetch latest profiles and points (demo/production logic)
    const { data } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, role")
      .order("created_at", { ascending: true });

    const profiles = data as Pick<ProfileRow, "id" | "username" | "first_name" | "last_name" | "role">[] | null;

    let fileContent = `TyperLM26\nSnapshot rankingu\n\nData wygenerowania:\n${dateFormatted} UTC\n\n`;

    if (profiles && profiles.length > 0) {
      profiles.forEach((p, idx) => {
        fileContent += `${idx + 1}. ${p.first_name} ${p.last_name} (@${p.username}) — 0 pkt\n`;
      });
    } else {
      fileContent += `1. Bartosz Kowalski (@bartosz) — 1 250 pkt\n`;
      fileContent += `2. Michał Nowak (@michal) — 1 120 pkt\n`;
      fileContent += `3. Kamil Wiśniewski (@kamil) — 980 pkt\n`;
      fileContent += `4. Dominik Wójcik (@dominik) — 870 pkt\n`;
      fileContent += `5. Paweł Kamiński (@pawel) — 760 pkt\n`;
    }

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="TyperLM26-ranking-${filenameDate}.txt"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
