"use client";

import { useEffect, useRef, useState } from "react";
import { api, type EnergyEvent, type EnergyTimeline } from "@/lib/api";

// ── Cross-app fetch ────────────────────────────────────────────────────────

async function fetchExternal(
  envUrl: string | undefined,
  path: string,
  tokenKey: string,
): Promise<EnergyTimeline | null> {
  if (typeof window === "undefined") return null;
  const baseUrl = envUrl?.trim();
  if (!baseUrl) return null;
  const token = localStorage.getItem(tokenKey);
  if (!token) return null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Chart ─────────────────────────────────────────────────────────────────

const CW = 720, CH = 160, PL = 44, PR = 16, PT = 16, PB = 32;
const VW = PL + CW + PR, VH = PT + CH + PB;

function mx(min: number) { return PL + (min / 1440) * CW; }
function ey(e: number)   { return PT + (1 - e) * CH; }
function tm(t: string)   { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

type Source = "canopy" | "circuit" | "chef";

const SRC_COLOR: Record<Source, string> = {
  canopy:  "var(--accent)",
  circuit: "var(--good)",
  chef:    "var(--warn)",
};

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function hourLabel(h: number) {
  if (h === 0 || h === 24) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

interface Tip { event: EnergyEvent; svgX: number; svgY: number; }

function EnergyChart({ events }: { events: EnergyEvent[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const bySource = (["canopy", "circuit", "chef"] as Source[]).reduce(
    (acc, src) => ({
      ...acc,
      [src]: events
        .filter((e) => e.source === src)
        .sort((a, b) => tm(a.time) - tm(b.time)),
    }),
    {} as Record<Source, EnergyEvent[]>,
  );

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setTip(null)}
      >
        {/* Threshold bands */}
        <rect x={PL} y={ey(1)}    width={CW} height={ey(0.65) - ey(1)}    fill="var(--good)"   opacity={0.05} />
        <rect x={PL} y={ey(0.35)} width={CW} height={ey(0)    - ey(0.35)} fill="var(--danger)" opacity={0.05} />

        {/* Y grid + labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={PL} y1={ey(v)} x2={PL + CW} y2={ey(v)}
              stroke="var(--line-soft)" strokeWidth={0.5} />
            <text x={PL - 5} y={ey(v)} textAnchor="end" dominantBaseline="middle"
              fontSize={8} fill="var(--fg-faint)" fontFamily="var(--font-mono)">
              {Math.round(v * 100)}
            </text>
          </g>
        ))}

        {/* Threshold dashes */}
        <line x1={PL} y1={ey(0.35)} x2={PL + CW} y2={ey(0.35)}
          stroke="var(--danger)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5} />
        <line x1={PL} y1={ey(0.65)} x2={PL + CW} y2={ey(0.65)}
          stroke="var(--good)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5} />

        {/* X grid + labels */}
        {HOURS.map((h) => {
          const x = mx(h * 60);
          return (
            <g key={h}>
              <line x1={x} y1={PT} x2={x} y2={PT + CH}
                stroke="var(--line-soft)" strokeWidth={0.5} />
              <text x={x} y={PT + CH + 11} textAnchor="middle"
                fontSize={8} fill="var(--fg-faint)" fontFamily="var(--font-mono)">
                {hourLabel(h)}
              </text>
            </g>
          );
        })}

        {/* Lines + dots per source */}
        {(["canopy", "circuit", "chef"] as Source[]).map((src) => {
          const pts = bySource[src].map((e) => ({
            x: mx(tm(e.time)),
            y: ey(e.energy),
            e,
          }));
          if (pts.length === 0) return null;
          const color = SRC_COLOR[src];
          return (
            <g key={src}>
              {pts.length > 1 && (
                <path
                  d={pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.85}
                />
              )}
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4}
                  fill={color} stroke="var(--panel)" strokeWidth={1.5}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setTip({ event: p.e, svgX: p.x, svgY: p.y })}
                />
              ))}
            </g>
          );
        })}

        {/* Axis borders */}
        <line x1={PL} y1={PT} x2={PL} y2={PT + CH} stroke="var(--line)" strokeWidth={0.5} />
        <line x1={PL} y1={PT + CH} x2={PL + CW} y2={PT + CH} stroke="var(--line)" strokeWidth={0.5} />
      </svg>

      {/* Tooltip */}
      {tip && (() => {
        const svgW = svgRef.current?.clientWidth ?? VW;
        const svgH = svgRef.current?.clientHeight ?? VH;
        const px = (tip.svgX / VW) * svgW;
        const py = (tip.svgY / VH) * svgH;
        const flipX = px > svgW * 0.65;
        return (
          <div style={{
            position: "absolute",
            left:  flipX ? undefined : px + 10,
            right: flipX ? (svgW - px) + 10 : undefined,
            top: Math.max(0, py - 20),
            background: "var(--panel)",
            border: "0.5px solid var(--line)",
            borderRadius: "var(--r-3)",
            padding: "6px 10px",
            fontSize: 11,
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            minWidth: 160,
            maxWidth: 240,
          }}>
            <div style={{ fontFamily: "var(--font-mono)", color: SRC_COLOR[tip.event.source], fontSize: 10, marginBottom: 2 }}>
              {tip.event.source} · {tip.event.time}
            </div>
            <div style={{ color: "var(--fg)", fontWeight: 500 }}>
              {Math.round(tip.event.energy * 100)}% — {tip.event.label}
            </div>
            <div style={{ color: "var(--fg-mute)", marginTop: 2, fontSize: 10, wordBreak: "break-word" }}>
              {tip.event.note}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Source status pill ─────────────────────────────────────────────────────

const SRC_FULL_LABEL: Record<Source, string> = {
  canopy:  "interactions",
  circuit: "tasks",
  chef:    "meals",
};

function SourcePill({
  source,
  timeline,
  unavailable,
}: {
  source: Source;
  timeline: EnergyTimeline | null;
  unavailable?: boolean;
}) {
  const color = SRC_COLOR[source];
  const avg = timeline?.avg_energy;
  const count = timeline?.events.length ?? 0;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 12px",
      border: "0.5px solid var(--line-soft)",
      borderRadius: "var(--r-4)",
      background: "var(--panel)",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {source} · {SRC_FULL_LABEL[source]}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: unavailable ? "var(--fg-faint)" : "var(--fg)", marginTop: 1 }}>
          {unavailable
            ? "not configured"
            : avg !== null && avg !== undefined
              ? `${Math.round(avg * 100)}% avg · ${count} event${count !== 1 ? "s" : ""}`
              : `${count} event${count !== 1 ? "s" : ""}`}
        </div>
      </div>
    </div>
  );
}

// ── Date helpers ───────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDate(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────

type LoadState = "loading" | "done" | "error";

interface SourceState {
  timeline: EnergyTimeline | null;
  state: LoadState;
  unavailable?: boolean;
}

export default function EnergyPage() {
  const [date, setDate] = useState(todayISO);
  const [canopy,  setCanopy]  = useState<SourceState>({ timeline: null, state: "loading" });
  const [circuit, setCircuit] = useState<SourceState>({ timeline: null, state: "loading" });
  const [chef,    setChef]    = useState<SourceState>({ timeline: null, state: "loading" });

  useEffect(() => {
    setCanopy({ timeline: null, state: "loading" });
    setCircuit({ timeline: null, state: "loading" });
    setChef({ timeline: null, state: "loading" });

    // Canopy — uses the shared api client (handles canopy auth token)
    api.energyTimeline(date)
      .then((t) => setCanopy({ timeline: t, state: "done" }))
      .catch(() => setCanopy({ timeline: null, state: "error" }));

    // Circuit — direct cross-app call using circuit_auth_token
    const circuitUrl = process.env.NEXT_PUBLIC_CIRCUIT_API_URL;
    if (!circuitUrl) {
      setCircuit({ timeline: null, state: "done", unavailable: true });
    } else {
      fetchExternal(circuitUrl, `/api/energy/timeline?date=${date}`, "circuit_auth_token")
        .then((t) => setCircuit({ timeline: t, state: "done", unavailable: !t && !localStorage.getItem("circuit_auth_token") }))
        .catch(() => setCircuit({ timeline: null, state: "done" }));
    }

    // Chef — direct cross-app call using chef_auth_token
    const chefUrl = process.env.NEXT_PUBLIC_CHEF_API_URL;
    if (!chefUrl) {
      setChef({ timeline: null, state: "done", unavailable: true });
    } else {
      fetchExternal(chefUrl, `/energy/timeline?date=${date}`, "chef_auth_token")
        .then((t) => setChef({ timeline: t, state: "done", unavailable: !t && !localStorage.getItem("chef_auth_token") }))
        .catch(() => setChef({ timeline: null, state: "done" }));
    }
  }, [date]);

  const allEvents: EnergyEvent[] = [
    ...(canopy.timeline?.events ?? []),
    ...(circuit.timeline?.events ?? []),
    ...(chef.timeline?.events ?? []),
  ].sort((a, b) => tm(a.time) - tm(b.time));

  const isToday = date === todayISO();
  const loading = canopy.state === "loading";

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Energy</div>
          <h1 className="page-title">Your <em>energy.</em></h1>
          <p className="page-sub">Activity energy across all apps for the selected day.</p>
        </div>
      </div>

      {/* Date nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={() => setDate((d) => offsetDate(d, -1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}>‹</button>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500, minWidth: 260, textAlign: "center" }}>
          {formatDateDisplay(date)}
        </span>
        <button onClick={() => setDate((d) => offsetDate(d, 1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}
          disabled={isToday}>›</button>
        {!isToday && (
          <button onClick={() => setDate(todayISO())} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>
            Today
          </button>
        )}
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="input"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, height: 30, width: 140 }}
        />
      </div>

      {/* Source status pills */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <SourcePill source="canopy"  timeline={canopy.timeline}  unavailable={canopy.state === "error"} />
        <SourcePill source="circuit" timeline={circuit.timeline} unavailable={circuit.unavailable} />
        <SourcePill source="chef"    timeline={chef.timeline}    unavailable={chef.unavailable} />
      </div>

      {/* Chart card */}
      <div className="card" style={{ padding: "20px 16px 12px", marginBottom: 24 }}>
        {loading ? (
          <div style={{ height: 208, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Loading…</span>
          </div>
        ) : allEvents.length === 0 ? (
          <div style={{ height: 208, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>No events logged on this day.</p>
          </div>
        ) : (
          <EnergyChart events={allEvents} />
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 10, paddingLeft: 44, flexWrap: "wrap" }}>
          {(["canopy", "circuit", "chef"] as Source[]).map((src) => (
            <div key={src} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: SRC_COLOR[src], display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", textTransform: "capitalize" }}>
                {src}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width={20} height={4} style={{ display: "block" }}>
                <line x1={0} y1={2} x2={20} y2={2} stroke="var(--good)" strokeWidth={0.5} strokeDasharray="3 3" />
              </svg>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-faint)" }}>energising</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width={20} height={4} style={{ display: "block" }}>
                <line x1={0} y1={2} x2={20} y2={2} stroke="var(--danger)" strokeWidth={0.5} strokeDasharray="3 3" />
              </svg>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-faint)" }}>draining</span>
            </span>
          </div>
        </div>
      </div>

      {/* Events list */}
      {allEvents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            {allEvents.length} event{allEvents.length !== 1 ? "s" : ""}
          </div>
          {allEvents.map((e, i) => {
            const energyColor =
              e.energy < 0.35 ? "var(--danger)" :
              e.energy > 0.65 ? "var(--good)" :
              "var(--fg-mute)";
            return (
              <div key={i} style={{
                display: "flex", alignItems: "baseline", gap: 12,
                padding: "8px 12px",
                borderRadius: "var(--r-3)",
                background: "var(--panel)",
                border: "0.5px solid var(--line-soft)",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", minWidth: 40, flexShrink: 0 }}>
                  {e.time}
                </span>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: SRC_COLOR[e.source as Source],
                  flexShrink: 0, marginTop: 2,
                }} />
                <span style={{ color: "var(--fg)", fontSize: 13, flex: 1, minWidth: 0 }}>
                  {e.note}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: energyColor, flexShrink: 0 }}>
                  {Math.round(e.energy * 100)}%
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", flexShrink: 0, minWidth: 60, textAlign: "right" }}>
                  {e.source}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
