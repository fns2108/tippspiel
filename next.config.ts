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
};

export default nextConfig;
