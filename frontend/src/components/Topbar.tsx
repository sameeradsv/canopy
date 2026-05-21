"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  "/":           "dashboard",
  "/capture":    "capture",
  "/timeline":   "timeline",
  "/people":     "people",
  "/tasks":      "tasks",
  "/dimensions": "dimensions",
  "/search":     "search",
  "/account":    "account",
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const label = LABELS[pathname] ?? pathname.replace("/", "");

  return (
    <div className="topbar">
      <span className="crumb">canopy · {label} · {pathname}</span>
      <div className="grow" />
      <button
        className="topbar-search"
        onClick={() => router.push("/search")}
        style={{ cursor: "default" }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>⌕</span>
        <span className="faint small">search</span>
        <span className="shot" style={{ marginLeft: 8 }}>⌘K</span>
      </button>
      <Link href="/capture" className="topbar-btn primary">
        + Capture
      </Link>
    </div>
  );
}
