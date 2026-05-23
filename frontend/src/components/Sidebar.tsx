"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { href: "/",         label: "Dashboard", section: "today" },
  { href: "/capture",  label: "Capture",   section: "today" },
  { href: "/timeline", label: "Timeline",  section: "log"   },
  { href: "/people",   label: "People",    section: "log"   },
  { href: "/search",   label: "Search",    section: "meta"  },
  { href: "/settings", label: "Settings",  section: "meta"  },
];

const SECTIONS = [
  { id: "today", label: "Today" },
  { id: "log",   label: "Log" },
  { id: "meta",  label: "Meta" },
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
      <rect x="44" y="64" width="12" height="22" rx="4" fill="#8a4a08" />
      <polygon points="50,16 80,64 20,64" fill="#d4831a" />
      <polygon points="50,28 72,64 50,64" fill="#8a4a08" opacity="0.55" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

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
            </Link>
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      <div className="sidebar-foot">
        {user ? (
          <>
            <Link href="/account" style={{ display: "contents", textDecoration: "none" }}>
              <div className="avatar" title={user.username}>{initials(user.username)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name">{user.username}</div>
              </div>
            </Link>
            <button
              onClick={logout}
              className="btn ghost"
              style={{ height: 26, padding: "0 8px", fontSize: 11 }}
            >
              Sign out
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
