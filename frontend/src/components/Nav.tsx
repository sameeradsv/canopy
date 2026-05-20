"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const links = [
  { href: "/", label: "Home" },
  { href: "/capture", label: "Capture" },
  { href: "/timeline", label: "Timeline" },
  { href: "/people", label: "People" },
  { href: "/tasks", label: "Tasks" },
  { href: "/dimensions", label: "Dimensions" },
  { href: "/search", label: "Search" },
];

export function Nav() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  return (
    <nav className="border-b border-canopy-border/80 bg-canopy-surface/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1 px-4 py-3">
        <span className="mr-4 font-medium text-canopy-accent">Canopy</span>
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-canopy-accentDim/40 text-canopy-text"
                  : "text-canopy-muted hover:text-canopy-text"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {!loading && user ? (
            <>
              <Link
                href="/account"
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  pathname === "/account"
                    ? "bg-canopy-accentDim/40 text-canopy-text"
                    : "text-canopy-accent hover:text-canopy-text"
                }`}
              >
                {user.username.length > 14
                  ? user.username.slice(0, 13) + "…"
                  : user.username}
              </Link>
              <button
                onClick={logout}
                className="rounded px-3 py-1.5 text-sm text-canopy-muted hover:text-canopy-text"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                pathname === "/login"
                  ? "bg-canopy-accentDim/40 text-canopy-text"
                  : "text-canopy-muted hover:text-canopy-text"
              }`}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
