import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge overlaps the bottom-left of the UI. It never
  // ships to production anyway.
  devIndicators: false,
  // Team logos are downloaded into /public/teams at seed time, so there is no
  // third-party image host to allowlist. See scripts/seed-teams.ts.

  // These load native assets by filesystem path and must not be bundled.
  serverExternalPackages: ["postgres", "web-push"],

  // The share image renders with the brand faces, which means reading the TTFs
  // off disk. Nothing imports them, so the build's file tracing cannot find
  // them on its own and the route would 500 in production with the files
  // missing. See app/api/share/[season]/[ordinal]/route.tsx.
  outputFileTracingIncludes: {
    "/api/share/[season]/[ordinal]": ["./assets/fonts/**"],
  },

  experimental: {
    /**
     * How long a prefetched page stays usable in the client router cache.
     *
     * Every page here is `force-dynamic`, and Next's default for dynamic
     * entries is 0 — meaning a prefetch is thrown away before the click that
     * would have used it, so navigation always pays a full server round trip.
     * Thirty seconds is long enough to cover the walk between tabs and short
     * enough that nobody sits on a dead scoreboard: a pick writes
     * `revalidatePath`, and LiveRefresh calls `router.refresh()`, and both
     * clear this cache immediately.
     */
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
