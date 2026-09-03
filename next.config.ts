import type { NextConfig } from "next";
import { config as loadDotenv } from "dotenv";
import * as path from "path";

// When launched via dev:staging, strictly override environment variables with .env.staging.local
if (process.env.APP_ENV === "staging") {
  // Clear any residual production keys before loading staging env
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const stagingPath = path.resolve(process.cwd(), ".env.staging.local");
  loadDotenv({ path: stagingPath, override: true });
}

const stagingKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.goal-api.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  env: {
    ...(process.env.APP_ENV === "staging"
      ? {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingKey,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stagingKey,
          ENABLE_LIVE_SANDBOX: process.env.ENABLE_LIVE_SANDBOX,
          STAGING_SUPABASE_PROJECT_REF: process.env.STAGING_SUPABASE_PROJECT_REF,
          APP_ENV: "staging",
        }
      : {}),
  },
};

export default nextConfig;
