import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPages ? "/canopy" : "";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development" || isGithubPages,
  register: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  transpilePackages: ["@shared/cortex"],
  ...(isGithubPages
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : { output: "standalone" }),
  basePath,
  assetPrefix: isGithubPages ? "/canopy/" : undefined,
  ...(isGithubPages
    ? {}
    : {
        async rewrites() {
          const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
          if (!base) return [];
          return [
            {
              source: "/api/:path*",
              destination: `${base}/api/:path*`,
            },
          ];
        },
      }),
};

export default isGithubPages ? nextConfig : withPWA(nextConfig);
