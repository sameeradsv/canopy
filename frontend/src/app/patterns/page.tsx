"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type PatternsData = Awaited<ReturnType<typeof api.getPatterns>>;
type SynthData = Awaited<ReturnType<typeof api.synthesize>>;

const RANGE_OPTIONS = [7, 14, 30] as const;

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<PatternsData | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(true);
  const [days, setDays] = useState<number>(7);
  const [synth, setSynth] = useState<SynthData | null>(null);
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthRequested, setSynthRequested] = useState(false);

  useEffect(() => {
    setPatternsLoading(true);
    api.getPatterns()
      .then(setPatterns)
      .catch(() => setPatterns(null))
      .finally(() => setPatternsLoading(false));
  }, []);

  const runSynthesis = useCallback(async (d = days) => {
    setSynthLoading(true);
    setSynthRequested(true);
    try {
      const res = await api.synthesize(d);
      setSynth(res);
    } catch {
      setSynth({ summary: "", days: d, error: "Request failed" });
    } finally {
      setSynthLoading(false);
    }
  }, [days]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Reflection</div>
          <h1 className="page-title">Patterns</h1>
          <p className="page-sub" style={{ marginTop: 8 }}>
            Deterministic signals from the last 60 days. Groq synthesis runs only when you ask.
          </p>
        </div>
        <Link href="/capture" className="btn primary">+ Capture</Link>
      </div>

      <section style={{ marginBottom: "var(--pad-6)" }}>
        <div className="kicker" style={{ marginBottom: 12 }}>Signals</div>
        {patternsLoading && (
          <div className="card" style={{ minHeight: 100, opacity: 0.4 }} />
        )}
        {!patternsLoading && patterns && (
          <div className="grid-2" style={{ gap: "var(--pad-6)" }}>
            <div className="card" style={{ padding: "16px 18px" }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Insights</div>
              {(patterns.insights?.length ?? 0) > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--fg-mute)", lineHeight: 1.55 }}>
                  {patterns.insights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, color: "var(--fg-faint)", margin: 0 }}>
                  Not enough data yet — log a few more interactions.
                </p>
              )}
            </div>

            <div className="card" style={{ padding: "16px 18px" }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Busiest weekday</div>
              {patterns.busiest_weekday ? (
                <p style={{ fontSize: 15, margin: 0 }}>
                  {patterns.busiest_weekday.weekday}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-faint)", marginLeft: 8 }}>
                    {patterns.busiest_weekday.count} interactions
                  </span>
                </p>
              ) : (
                <p style={{ fontSize: 13, color: "var(--fg-faint)", margin: 0 }}>—</p>
              )}
            </div>

            {(patterns.recurring_tags?.length ?? 0) > 0 && (
              <div className="card" style={{ padding: "16px 18px" }}>
                <div className="kicker" style={{ marginBottom: 10 }}>Recurring tags</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {patterns.recurring_tags.map((t) => (
                    <span key={t.tag} className="tag accent">
                      {t.tag} <span style={{ opacity: 0.6 }}>×{t.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(patterns.stale_contacts?.length ?? 0) > 0 && (
              <div className="card" style={{ padding: "16px 18px" }}>
                <div className="kicker" style={{ marginBottom: 10 }}>Stale contacts</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13 }}>
                  {patterns.stale_contacts.map((c) => (
                    <li key={c.name} style={{ padding: "6px 0", borderBottom: "0.5px solid var(--line)" }}>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", marginLeft: 8 }}>
                        {c.days_since}d since last log
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="between" style={{ marginBottom: 12, alignItems: "center" }}>
          <div className="kicker">Weekly synthesis (Groq)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RANGE_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`btn${days === d ? " primary" : ""}`}
                style={{ fontSize: 11, padding: "6px 10px" }}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
            <button
              type="button"
              className="btn primary"
              style={{ fontSize: 11, padding: "6px 12px" }}
              disabled={synthLoading}
              onClick={() => void runSynthesis(days)}
            >
              {synthLoading ? "Generating…" : synthRequested ? "Refresh" : "Generate"}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", minHeight: 80 }}>
          {!synthRequested && (
            <p style={{ fontSize: 13, color: "var(--fg-faint)", margin: 0 }}>
              Synthesis is on-demand — avoids Groq latency on dashboard load.
            </p>
          )}
          {synthRequested && synth?.error && (
            <p style={{ fontSize: 13, color: "var(--fg-faint)", margin: 0 }}>
              Synthesis unavailable ({synth.error}).
            </p>
          )}
          {synthRequested && synth?.summary && !synth.error && (
            <>
              <p style={{ fontSize: 13, color: "var(--fg-mute)", lineHeight: 1.55, whiteSpace: "pre-wrap", margin: 0 }}>
                {synth.summary}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginTop: 12, marginBottom: 0 }}>
                Based on {synth.interaction_count ?? "—"} interactions · last {synth.days} days
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
