import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.GITHUB_PAGES === "true" ? "/canopy" : "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Canopy",
    short_name: "Canopy",
    description: "A quiet planner for people & intent",
    start_url: base + "/",
    display: "standalone",
    background_color: "#f5efe2",
    theme_color: "#f5efe2",
    orientation: "portrait-primary",
    icons: [
      {
        src: base + "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: base + "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
        purpose: "any",
      },
      {
        src: base + "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: base + "/icons/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
