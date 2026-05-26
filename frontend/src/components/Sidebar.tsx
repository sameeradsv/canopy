"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { href: "/",             label: "Dashboard", section: "today" },
  { href: "/capture",      label: "Capture",   section: "today" },
  { href: "/timeline",     label: "Timeline",  section: "log"   },
  { href: "/people",       label: "People",    section: "log"   },
  { href: "/people/graph", label: "Graph",     section: "log"   },
  { href: "/search",       label: "Search",    section: "meta"  },
  { href: "/chat",         label: "Chat",      section: "meta"  },
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

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        stroke="currentColor" strokeWidth="1.2" fill="none"
      />
      <path
        d="M12.1 9.2l.8.5a.6.6 0 0 1 .2.8l-1 1.7a.6.6 0 0 1-.8.2l-.8-.5a5 5 0 0 1-.9.5l-.1.9a.6.6 0 0 1-.6.5H7.1a.6.6 0 0 1-.6-.5l-.1-.9a5 5 0 0 1-.9-.5l-.8.5a.6.6 0 0 1-.8-.2l-1-1.7a.6.6 0 0 1 .2-.8l.8-.5A5 5 0 0 1 3.8 8V7a5 5 0 0 1-.1-1.2l-.8-.5a.6.6 0 0 1-.2-.8l1-1.7a.6.6 0 0 1 .8-.2l.8.5a5 5 0 0 1 .9-.5l.1-.9A.6.6 0 0 1 7 1h2a.6.6 0 0 1 .6.5l.1.9a5 5 0 0 1 .9.5l.8-.5a.6.6 0 0 1 .8.2l1 1.7a.6.6 0 0 1-.2.8l-.8.5A5 5 0 0 1 12.2 7v1a5 5 0 0 1-.1 1.2Z"
        stroke="currentColor" strokeWidth="1.2" fill="none"
      />
    </svg>
  );
}

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      <div
        className={`sidebar-backdrop${isOpen ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar${isOpen ? " open" : ""}`}>
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
              <div className="sidebar-foot-user">
                <Link href="/account" className="sidebar-foot-account">
                  <div className="avatar" title={user.username}>{initials(user.username)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="user-name">{user.username}</div>
                  </div>
                </Link>
                <Link href="/settings" className="settings-icon-btn" title="Settings">
                  <GearIcon />
                </Link>
              </div>
              <button
                onClick={logout}
                className="btn ghost signout-btn"
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
    </>
  );
}
