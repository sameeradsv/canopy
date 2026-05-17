"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/capture", label: "Capture" },
  { href: "/timeline", label: "Timeline" },
  { href: "/people", label: "People" },
  { href: "/dimensions", label: "Dimensions" },
  { href: "/search", label: "Search" },
];

export function Nav() {
  const pathname = usePathname();

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
        <Link
          href="/login"
          className="ml-auto rounded px-3 py-1.5 text-sm text-canopy-muted hover:text-canopy-text"
        >
          Account
        </Link>
      </div>
    </nav>
  );
}
