"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PasskeyBanner } from "./PasskeyBanner";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Normalize trailing slash (GitHub Pages trailingSlash:true adds it)
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isLoginPage = normalizedPath === "/login";

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace("/login");
    }
  }, [loading, user, isLoginPage, router]);

  // ⌘K → search, 1-6 keyboard shortcuts
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

  // Show nothing while auth resolves or redirect is in-flight
  if (loading || !user) {
    return null;
  }

  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        {user && <PasskeyBanner />}
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
