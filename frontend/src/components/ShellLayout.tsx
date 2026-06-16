"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function AuthBootScreen() {
  return (
    <div
      className="app"
      style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="brand-name" style={{ fontSize: 22 }}>
          Canop<em>y</em>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                opacity: 0.55,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isLoginPage = normalizedPath === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace("/login");
    }
  }, [loading, user, isLoginPage, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (/input|textarea|select/i.test(tag)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        router.push("/search");
        return;
      }
      const map: Record<string, string> = {
        "1": "/", "2": "/capture", "3": "/timeline",
        "4": "/people", "5": "/chat",
        ",": "/settings",
      };
      if (map[e.key]) router.push(map[e.key]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return <AuthBootScreen />;
  }

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
