"use client";

import type { ReactNode } from "react";
import type { Interaction } from "@/lib/api";
import { fmtDateIST, fmtTimeIST } from "@/lib/tz";

const KIND_GLYPH: Record<string, string> = {
  meeting: "◧",
  call: "◌",
  message: "✉",
  meal: "◇",
  walk: "⌒",
  "one-on-one": "◉",
};

function energyLabel(e: number | null | undefined) {
  if (e == null) return "";
  if (e < 0.35) return "draining";
  if (e > 0.65) return "energising";
  return "neutral";
}

function energyColor(e: number | null | undefined): string {
  if (e == null) return "var(--accent)";
  if (e < 0.35) return "var(--danger)";
  if (e > 0.65) return "var(--good)";
  return "var(--fg-mute)";
}

function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function InteractionCard({
  ix,
  showDate = false,
  showTime = true,
  actions,
  body,
}: {
  ix: Interaction;
  showDate?: boolean;
  showTime?: boolean;
  actions?: ReactNode;
  /** Replace default body (e.g. inline edit form). */
  body?: ReactNode;
}) {
  const time = fmtTimeIST(ix.occurred_at);
  const date = fmtDateIST(ix.occurred_at, { month: "short", day: "numeric" });
  const duration = formatDuration(ix.duration_minutes);

  return (
    <div className="tl-item">
      {(showDate || showTime) && (
        <div className="tl-time">
          {showDate && <div>{date}</div>}
          {showTime && (
            <div style={{ marginTop: showDate ? 2 : 0, opacity: showDate ? 0.7 : 1 }}>{time}</div>
          )}
          {ix.kind && (
            <div style={{ fontSize: 13, marginTop: 4, color: "var(--accent)", opacity: 0.8 }} title={ix.kind}>
              {KIND_GLYPH[ix.kind] ?? ix.kind}
            </div>
          )}
          {ix.energy != null && (
            <div
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                color: energyColor(ix.energy),
                marginTop: 3,
                letterSpacing: "0.03em",
              }}
            >
              {energyLabel(ix.energy)}
            </div>
          )}
        </div>
      )}
      <div className="tl-body" style={body && !showDate && !showTime ? { gridColumn: "1 / -1" } : undefined}>
        {body ?? (
          <>
            {ix.participants.length > 0 && (
              <div className="who">
                {ix.participants.map((p) => (
                  <b key={p.id}>{p.name}</b>
                ))}
                <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                  · {Math.round(ix.confidence * 100)}% confidence{duration ? ` · ${duration}` : ""}
                </span>
              </div>
            )}
            {ix.participants.length === 0 && duration && (
              <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                {duration}
              </div>
            )}
            <div className="note">{ix.observation}</div>
            {ix.context && (
              <div style={{ marginTop: 6, fontSize: 13, color: "var(--fg-mute)" }}>{ix.context}</div>
            )}
            {ix.tags.length > 0 && (
              <div className="tags">
                {ix.tags.map((t) => (
                  <span key={t.id} className="tag">
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {actions && <div className="tl-actions">{actions}</div>}
    </div>
  );
}
