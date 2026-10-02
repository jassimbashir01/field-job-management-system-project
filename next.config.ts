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
  experimental: {
    serverActions: {
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;

if (
  process.env.NODE_ENV === "development" &&
  process.env.DEPLOY_TARGET === "cloudflare"
) {
  void initOpenNextCloudflareForDev();
}
