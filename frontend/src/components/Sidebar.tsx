"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { href: "/",           label: "Dashboard",  section: "today", kbd: "1" },
  { href: "/capture",    label: "Capture",    section: "today", kbd: "2" },
  { href: "/timeline",   label: "Timeline",   section: "log",   kbd: "3" },
  { href: "/people",     label: "People",     section: "log",   kbd: "4" },
  { href: "/tasks",      label: "Tasks",      section: "plan",  kbd: "5" },
  { href: "/dimensions", label: "Dimensions", section: "plan",  kbd: "6" },
  { href: "/search",     label: "Search",     section: "meta",  kbd: "K" },
  { href: "/settings",   label: "Settings",   section: "meta",  kbd: "," },
];

const SECTIONS = [
  { id: "today", label: "Today" },
  { id: "log",   label: "Log" },
  { id: "plan",  label: "Plan" },
  { id: "meta",  label: "Meta" },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">C</div>
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
