"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Summary } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  }).toUpperCase();
}

export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    api.summary().then(setSummary).catch(() => setUnreachable(true));
  }, []);

  const firstName = user?.username?.split(" ")[0] ?? user?.username ?? "there";

  if (unreachable) {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="kicker" style={{ marginBottom: 10 }}>{dayLabel()} · {greeting()}</div>
            <h1 className="page-title">Hello, <em>{firstName}.</em></h1>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 560 }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 12 }}>Backend not reachable. Start it with:</p>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-faint)", background: "var(--bg)", border: "0.5px solid var(--line)", borderRadius: "var(--r-3)", padding: "12px 14px", overflowX: "auto" }}>
            {`cd backend\npip install -r requirements.txt\nuvicorn app.main:app --reload --port 8000`}
          </pre>
        </div>
      </>
    );
  }

  if (!summary) {
    return (
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>{dayLabel()} · {greeting()}</div>
          <h1 className="page-title">Hello, <em>{firstName}.</em></h1>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>{dayLabel()} · {greeting()}</div>
          <h1 className="page-title">Hello, <em>{firstName}.</em></h1>
          <p className="page-sub" style={{ marginTop: 10 }}>
            {summary.total_interactions === 0
              ? "Nothing captured yet — start with a quick interaction."
              : `You've logged ${summary.total_interactions} interaction${summary.total_interactions === 1 ? "" : "s"} across ${summary.total_people} people.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Link href="/timeline" className="btn">View timeline</Link>
          <Link href="/capture" className="btn primary">+ Capture</Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid-4" style={{ marginBottom: "var(--pad-6)" }}>
        <StatCard label="Interactions" value={summary.total_interactions} />
        <StatCard label="People" value={summary.total_people} />
        <StatCard label="Tags" value={summary.total_tags} />
        <StatCard label="Recent (7d)" value={summary.recent_interactions.length} />
      </div>

      {/* Top tags */}
      {summary.top_tags.length > 0 && (
        <div style={{ marginBottom: "var(--pad-6)" }}>
          <div className="kicker" style={{ marginBottom: 10 }}>Top tags</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {summary.top_tags.map((tag) => (
              <span key={tag.id} className="tag">{tag.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent interactions */}
      {summary.recent_interactions.length > 0 && (
        <div>
          <div className="kicker" style={{ marginBottom: 14 }}>Recent capture</div>
          <div className="tl-feed">
            {summary.recent_interactions.slice(0, 5).map((ix) => {
              const d = new Date(ix.occurred_at);
              const timeStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <div key={ix.id} className="tl-item">
                  <div className="tl-time">{timeStr}</div>
                  <div className="tl-body">
                    {ix.participants.length > 0 && (
                      <div className="who">
                        {ix.participants.map((p) => (
                          <b key={p.id}>{p.name}</b>
                        ))}
                      </div>
                    )}
                    <div className="note">{ix.observation}</div>
                    {ix.tags.length > 0 && (
                      <div className="tags">
                        {ix.tags.map((t) => (
                          <span key={t.id} className="tag">{t.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.recent_interactions.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>Nothing captured yet.</p>
          <Link href="/capture" className="btn primary">Log your first interaction</Link>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat">
      <div className="stat-lbl">{label}</div>
      <div className="stat-num">{value}</div>
    </div>
  );
}
