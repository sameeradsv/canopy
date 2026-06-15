"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Summary } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { fmtDateIST } from "@/lib/tz";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) api.summary().then(setSummary).catch(() => null);
  }, [user]);

  if (loading || !user) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Account</div>
          <h1 className="page-title">Your <em>account.</em></h1>
        </div>
        <button onClick={logout} className="btn" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
          Sign out
        </button>
      </div>

      <div className="card">
        <div className="kicker" style={{ marginBottom: 12 }}>Identity</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar big" style={{ width: 44, height: 44, fontSize: 18 }}>
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{user.username}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
              {fmtDateIST(user.created_at, { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
        {summary && (
          <div className="grid-3" style={{ marginTop: 20, paddingTop: 16, borderTop: "0.5px solid var(--line-soft)" }}>
            <StatCard label="Interactions" value={summary.total_interactions} />
            <StatCard label="People" value={summary.total_people} />
            <StatCard label="Tags" value={summary.total_tags} />
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-lbl">{label}</div>
      <div className="stat-num">{value}</div>
    </div>
  );
}
