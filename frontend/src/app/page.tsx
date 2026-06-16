"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Summary } from "@/lib/api";
import { istHour, fmtDateIST, TZ } from "@/lib/tz";
import { useAuth } from "@/lib/AuthContext";

function greeting() {
  const h = istHour();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, weekday: "long", month: "long", day: "numeric",
  }).format(new Date()).toUpperCase();
}

function PageHeader({
  firstName,
  summary,
}: {
  firstName: string;
  summary: Summary | null;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>{dayLabel()} · {greeting()}</div>
        <h1 className="page-title">Hello, <em>{firstName}.</em></h1>
        {summary && (
          <p className="page-sub" style={{ marginTop: 10 }}>
            {summary.total_interactions === 0
              ? "Nothing captured yet — start with a quick interaction."
              : `You've logged ${summary.total_interactions} interaction${summary.total_interactions === 1 ? "" : "s"} across ${summary.total_people} people.`}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Link href="/timeline" className="btn">View timeline</Link>
        <Link href="/capture" className="btn primary">+ Capture</Link>
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <>
      <div className="grid-4" style={{ marginBottom: "var(--pad-6)" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card stat" style={{ opacity: 0.45 }}>
            <div className="stat-lbl" style={{ height: 10, width: "60%", background: "var(--line)", borderRadius: 4 }} />
            <div className="stat-num" style={{ height: 28, width: "40%", background: "var(--line)", borderRadius: 4, marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ marginBottom: "var(--pad-6)", gap: "var(--pad-6)" }}>
        <div className="card" style={{ minHeight: 120, opacity: 0.35 }} />
        <div className="card" style={{ minHeight: 120, opacity: 0.35 }} />
      </div>
    </>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);

  const firstName = user?.username?.split(" ")[0] ?? user?.username ?? "there";

  useEffect(() => {
    setSummaryLoading(true);
    api.summary()
      .then(setSummary)
      .catch(() => setUnreachable(true))
      .finally(() => setSummaryLoading(false));
  }, []);

  if (unreachable) {
    return (
      <>
        <PageHeader firstName={firstName} summary={null} />
        <div className="card" style={{ maxWidth: 560 }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 12 }}>Backend not reachable. Start it with:</p>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-faint)", background: "var(--bg)", border: "0.5px solid var(--line)", borderRadius: "var(--r-3)", padding: "12px 14px", overflowX: "auto" }}>
            {`cd backend\npip install -r requirements.txt\nuvicorn app.main:app --reload --port 8000`}
          </pre>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader firstName={firstName} summary={summary} />

      {summaryLoading && !summary && <SummarySkeleton />}

      {summary && (
        <>
          <div className="grid-4" style={{ marginBottom: "var(--pad-6)" }}>
            <StatCard label="Interactions" value={summary.total_interactions} />
            <StatCard label="People" value={summary.total_people} />
            <StatCard label="Tags" value={summary.total_tags} />
            <StatCard label="Recent (7d)" value={summary.recent_interactions.length} />
          </div>

          <div className="grid-2" style={{ marginBottom: "var(--pad-6)", gap: "var(--pad-6)" }}>
            {summary.people_to_reach_out.length > 0 && (
              <div>
                <div className="kicker" style={{ marginBottom: 14 }}>Reach out</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {summary.people_to_reach_out.map((p) => {
                    const lastStr = p.last_interaction_at
                      ? (() => {
                          const days = Math.floor((Date.now() - new Date(p.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24));
                          if (days === 0) return "today";
                          if (days === 1) return "yesterday";
                          if (days < 7) return `${days}d ago`;
                          if (days < 30) return `${Math.floor(days / 7)}w ago`;
                          return `${Math.floor(days / 30)}mo ago`;
                        })()
                      : "never";
                    return (
                      <div key={p.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                        <div className="avatar big">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", marginTop: 2 }}>
                            {p.relationship ?? "—"} · last {lastStr}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {summary.recent_interactions.length > 0 && (
              <div>
                <div className="kicker" style={{ marginBottom: 14 }}>Recent capture</div>
                <div className="tl-feed">
                  {summary.recent_interactions.slice(0, 3).map((ix) => {
                    const timeStr = fmtDateIST(ix.occurred_at, { month: "short", day: "numeric" });
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
          </div>

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

          {summary.recent_interactions.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>Nothing captured yet.</p>
              <Link href="/capture" className="btn primary">Log your first interaction</Link>
            </div>
          )}
        </>
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
