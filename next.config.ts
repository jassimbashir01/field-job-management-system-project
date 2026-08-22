import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  reactCompiler: true,
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;

// Cloudflare bindings initialise only when explicitly opted into locally —
// `pnpm dev` must work on a machine with no Wrangler configuration at all.
if (
  process.env.NODE_ENV === "development" &&
  process.env.DEPLOY_TARGET === "cloudflare"
) {
  void initOpenNextCloudflareForDev();
}
