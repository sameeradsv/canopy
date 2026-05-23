"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { href: "/",         label: "Dashboard", section: "today", kbd: "1" },
  { href: "/capture",  label: "Capture",   section: "today", kbd: "2" },
  { href: "/timeline", label: "Timeline",  section: "log",   kbd: "3" },
  { href: "/people",   label: "People",    section: "log",   kbd: "4" },
  { href: "/search",   label: "Search",    section: "meta",  kbd: "K" },
  { href: "/settings", label: "Settings",  section: "meta",  kbd: "," },
];

const SECTIONS = [
  { id: "today", label: "Today" },
  { id: "log",   label: "Log" },
  { id: "meta",  label: "Meta" },
];

const THEMES = [
  { id: "paper", color: "#c26a40", title: "Paper" },
  { id: "slate", color: "#4a6fa5", title: "Slate" },
  { id: "ink",   color: "#2a2f3d", title: "Ink" },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function TreeMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ display: "block" }}
    >
      <path d="M 44 56 C 42 66 38 76 34 88 L 66 88 C 62 76 58 66 56 56 Z" fill="#7a4015" />
      <path d="M 6 36 C 6 24 12 12 22 10 C 27 6 34 10 37 18 C 39 9 43 5 50 5 C 57 5 61 9 63 18 C 66 10 73 6 78 10 C 88 12 94 24 94 36 C 94 50 82 60 68 65 C 62 68 56 65 54 60 L 50 59 L 46 60 C 44 65 38 68 32 65 C 18 60 6 50 6 36 Z" fill="#2d7040" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<string>("paper");

  useEffect(() => {
    const stored = localStorage.getItem("canopy.theme") ?? "paper";
    setTheme(stored);
  }, []);

  function applyTheme(id: string) {
    setTheme(id);
    localStorage.setItem("canopy.theme", id);
    document.documentElement.setAttribute("data-theme", id);
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" style={{ background: "transparent", border: "none", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TreeMark size={28} />
        </div>
        <div className="brand-name">Canop<em>y</em></div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id}>
          <div className="nav-section">{section.label}</div>
          {NAV.filter((n) => n.section === section.id).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item ${pathname === n.href ? "active" : ""}`}
            >
              <span className="dot" />
              <span>{n.label}</span>
              <span className="kbd">{n.kbd}</span>
            </Link>
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {/* Theme switcher */}
      <div style={{ display: "flex", gap: 6, padding: "8px 16px 4px" }}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => applyTheme(t.id)}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: t.color,
              border: theme === t.id ? "2px solid var(--fg)" : "2px solid transparent",
              cursor: "pointer",
              padding: 0,
              outline: "none",
              boxShadow: theme === t.id ? "0 0 0 1px var(--bg)" : undefined,
            }}
          />
        ))}
      </div>

      <div className="sidebar-foot">
        {user ? (
          <>
            <div className="avatar" title={user.username}>{initials(user.username)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">{user.username}</div>
              <Link href="/settings" className="user-mail" style={{ textDecoration: "none" }}>
                settings
              </Link>
            </div>
            <button
              onClick={logout}
              className="btn ghost"
              style={{ height: 26, padding: "0 8px", fontSize: 11 }}
            >
              out
            </button>
          </>
        ) : (
          <Link href="/login" className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11 }}>
            sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
