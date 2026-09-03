import { notFound } from "next/navigation";
import { Metadata } from "next";
import { requireAdminRole } from "@/lib/auth/actions";
import { isLiveSandboxAllowed } from "@/lib/sandbox/guards";
import { LiveSandboxClient } from "@/components/admin/live-sandbox-client";

export const metadata: Metadata = {
  title: "Live Fixture Sandbox | Panel Administratora",
  description: "Bezpieczny poligon E2E do testowania potoku LIVE na środowisku Staging",
};

export const dynamic = "force-dynamic";

export default async function LiveSandboxPage() {
  // 1. Strict Environment Guard: Sandbox can ONLY exist on Staging
  if (!isLiveSandboxAllowed()) {
    notFound();
  }

  // 2. Strict Role Guard: Only administrators can access sandbox
  await requireAdminRole();

  return (
    <div className="py-6">
      <LiveSandboxClient />
    </div>
  );
}
