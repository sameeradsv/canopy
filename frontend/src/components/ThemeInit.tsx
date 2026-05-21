"use client";

import { useEffect } from "react";

export function ThemeInit() {
  useEffect(() => {
    const theme = localStorage.getItem("canopy.theme") ?? "paper";
    const fontMode = localStorage.getItem("canopy.fontMode") ?? "editorial";
    const density = localStorage.getItem("canopy.density") ?? "regular";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-fontmode", fontMode);
    document.documentElement.setAttribute("data-density", density);
  }, []);
  return null;
}
