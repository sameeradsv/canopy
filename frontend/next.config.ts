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
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
            },
          ];
        },
      }),
};

export default isGithubPages ? nextConfig : withPWA(nextConfig);
