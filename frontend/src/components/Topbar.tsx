"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  "/":           "dashboard",
  "/capture":    "capture",
  "/timeline":   "timeline",
  "/patterns":   "patterns",
  "/energy":     "energy",
  "/people":     "people",
  "/search":     "search",
  "/account":    "account",
  "/settings":   "settings",
};

export function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  // Strip trailing slash (Next.js trailingSlash:true adds it on GitHub Pages)
  const clean = pathname.replace(/\/$/, "") || "/";
  const label = LABELS[clean] ?? clean.replace(/^\//, "");

  return (
    <div className="topbar">
      <button className="menu-btn" onClick={onMenuToggle} aria-label="Open menu">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect y="2.5" width="16" height="1.5" rx="0.75" fill="currentColor"/>
          <rect y="7.25" width="16" height="1.5" rx="0.75" fill="currentColor"/>
          <rect y="12" width="16" height="1.5" rx="0.75" fill="currentColor"/>
        </svg>
      </button>
      <span className="crumb">{label}</span>
      <div className="grow" />
      <button
        className="topbar-search"
        onClick={() => router.push("/search")}
        style={{ cursor: "default" }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>⌕</span>
        <span className="faint small">search</span>
      </button>
      <Link href="/capture" className="topbar-btn primary">
        + Capture
      </Link>
    </div>
  );
}
