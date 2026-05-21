"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Interaction } from "@/lib/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TimelinePage() {
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    api.interactions({ limit: 200 }).then(setInteractions).catch(() => setUnreachable(true));
  }, []);

  if (unreachable) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">The <em>timeline.</em></h1>
        </div>
        <p style={{ color: "var(--fg-mute)" }}>Cannot reach the API.</p>
      </>
    );
  }

  if (!interactions) {
    return (
      <div className="page-header">
        <h1 className="page-title">The <em>timeline.</em></h1>
      </div>
    );
  }

  const sorted = [...interactions].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Timeline · /timeline</div>
          <h1 className="page-title">The <em>timeline.</em></h1>
          <p className="page-sub">{sorted.length} interaction{sorted.length === 1 ? "" : "s"} logged.</p>
        </div>
        <Link href="/capture" className="btn primary">+ Capture</Link>
      </div>

      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>Nothing captured yet.</p>
          <Link href="/capture" className="btn primary">Log your first interaction</Link>
        </div>
      ) : (
        <div className="tl-feed">
          {sorted.map((ix) => (
            <div key={ix.id} className="tl-item">
              <div className="tl-time">
                <div>{formatDate(ix.occurred_at)}</div>
                <div style={{ marginTop: 2, opacity: 0.7 }}>{formatTime(ix.occurred_at)}</div>
              </div>
              <div className="tl-body">
                {ix.participants.length > 0 && (
                  <div className="who">
                    {ix.participants.map((p) => (
                      <b key={p.id}>{p.name}</b>
                    ))}
                    <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                      · {Math.round(ix.confidence * 100)}% confidence
                    </span>
                  </div>
                )}
                <div className="note">{ix.observation}</div>
                {ix.context && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--fg-mute)" }}>
                    {ix.context}
                  </div>
                )}
                {ix.tags.length > 0 && (
                  <div className="tags">
                    {ix.tags.map((t) => (
                      <span key={t.id} className="tag">{t.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
