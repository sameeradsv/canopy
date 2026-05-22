"use client";

import { useEffect } from "react";

// Increment this key to force another cache-bust pass on all devices.
const SW_CLEAN_KEY = "canopy.sw-clean.v1";

export function ThemeInit() {
  useEffect(() => {
    const theme = localStorage.getItem("canopy.theme") ?? "paper";
    const fontMode = localStorage.getItem("canopy.fontMode") ?? "editorial";
    const density = localStorage.getItem("canopy.density") ?? "regular";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-fontmode", fontMode);
    document.documentElement.setAttribute("data-density", density);

    // One-time cleanup: unregister stale service workers and clear their
    // caches so any previously cached icon set gets replaced on next load.
    if ("serviceWorker" in navigator && !localStorage.getItem(SW_CLEAN_KEY)) {
      navigator.serviceWorker.getRegistrations().then(async (regs) => {
        if (regs.length === 0) {
          localStorage.setItem(SW_CLEAN_KEY, "1");
          return;
        }
        await Promise.all(regs.map((r) => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        localStorage.setItem(SW_CLEAN_KEY, "1");
        window.location.reload();
      });
    }
  }, []);
  return null;
}
