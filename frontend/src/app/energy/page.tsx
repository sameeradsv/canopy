"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, type EnergyEvent, type EnergyTimeline } from "@/lib/api";
import { todayIST, TZ } from "@/lib/tz";

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
// Scale factor: SVG renders at 1.5× its viewBox width so 7am–11pm fills a typical screen
const SCROLL_SCALE = 1.5;
const SVG_RENDER_W = Math.round(VW * SCROLL_SCALE); // ~1170px
// Scroll position that places 7am at the left edge of the chart area
const DEFAULT_SCROLL_LEFT = Math.round((7 / 24) * CW * SCROLL_SCALE); // ~315px

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const yAxisRef = useRef<SVGGElement>(null);

  // Scroll to 7am on mount and on each date change (new events array)
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = DEFAULT_SCROLL_LEFT;
    if (yAxisRef.current) {
      yAxisRef.current.setAttribute("transform", `translate(${DEFAULT_SCROLL_LEFT / SCROLL_SCALE}, 0)`);
    }
  }, [events]);

  // Keep Y-axis labels pinned to left edge while chart scrolls
  const handleScroll = () => {
    if (!scrollRef.current || !yAxisRef.current) return;
    yAxisRef.current.setAttribute(
      "transform",
      `translate(${scrollRef.current.scrollLeft / SCROLL_SCALE}, 0)`,
    );
  };

  const bySource = (["canopy", "circuit", "chef"] as Source[]).reduce(
    (acc, src) => ({
      ...acc,
      [src]: events
        .filter((e) => e.source === src)
        .sort((a, b) => tm(a.time) - tm(b.time)),
    }),
    {} as Record<Source, EnergyEvent[]>,
  );

  let cumSum = 0;
  const combinedLine = [...events]
    .sort((a, b) => tm(a.time) - tm(b.time))
    .map((e, i) => {
      cumSum += e.energy;
      return { x: mx(tm(e.time)), y: ey(cumSum / (i + 1)) };
    });

  return (
    <div style={{ position: "relative" }}>
      <div ref={scrollRef} onScroll={handleScroll} style={{ overflowX: "auto" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          width={SVG_RENDER_W}
          style={{ display: "block" }}
          onMouseLeave={() => setTip(null)}
        >
          {/* Threshold bands */}
          <rect x={PL} y={ey(1)}    width={CW} height={ey(0.65) - ey(1)}    fill="var(--good)"   opacity={0.05} />
          <rect x={PL} y={ey(0.35)} width={CW} height={ey(0)    - ey(0.35)} fill="var(--danger)" opacity={0.05} />

          {/* Y grid lines (span full chart width, stay with content) */}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <line key={v} x1={PL} y1={ey(v)} x2={PL + CW} y2={ey(v)}
              stroke="var(--line-soft)" strokeWidth={0.5} />
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

          {/* Combined running average */}
          {combinedLine.length >= 2 && (
            <path
              d={combinedLine.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none" stroke="var(--fg)" strokeWidth={1.5} strokeLinejoin="round" opacity={0.4} strokeDasharray="5 3"
            />
          )}
          {combinedLine.length === 1 && (
            <circle cx={combinedLine[0].x} cy={combinedLine[0].y} r={3} fill="var(--fg)" opacity={0.4} />
          )}

          {/* Bottom axis border */}
          <line x1={PL} y1={PT + CH} x2={PL + CW} y2={PT + CH} stroke="var(--line)" strokeWidth={0.5} />

          {/* Sticky Y-axis — rendered last so it paints above scrolled chart content */}
          <g ref={yAxisRef}>
            <rect x={0} y={0} width={PL - 1} height={VH} fill="var(--panel)" />
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <text key={v} x={PL - 5} y={ey(v)} textAnchor="end" dominantBaseline="middle"
                fontSize={8} fill="var(--fg-faint)" fontFamily="var(--font-mono)">
                {Math.round(v * 100)}
              </text>
            ))}
            <line x1={PL} y1={PT} x2={PL} y2={PT + CH} stroke="var(--line)" strokeWidth={0.5} />
          </g>
        </svg>
      </div>

      {/* Tooltip — position accounts for horizontal scroll offset */}
      {tip && (() => {
        const svgH = Math.round(VH * SCROLL_SCALE);
        const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
        const visibleW = scrollRef.current?.clientWidth ?? SVG_RENDER_W;
        const px = (tip.svgX / VW) * SVG_RENDER_W - scrollLeft;
        const py = (tip.svgY / VH) * svgH;
        const flipX = px > visibleW * 0.65;
        return (
          <div style={{
            position: "absolute",
            left:  flipX ? undefined : px + 10,
            right: flipX ? (visibleW - px) + 10 : undefined,
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
  unavailable?: UnavailableReason;
}) {
  const color = SRC_COLOR[source];
  const avg = timeline?.avg_energy;
  const count = timeline?.events.length ?? 0;

  const statusText =
    unavailable === "no_url"   ? "not configured" :
    unavailable === "no_token" ? "not signed in" :
    unavailable === "error"    ? "unavailable" :
    avg !== null && avg !== undefined
      ? `${Math.round(avg * 100)}% avg · ${count} event${count !== 1 ? "s" : ""}`
      : `${count} event${count !== 1 ? "s" : ""}`;

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
          {statusText}
        </div>
      </div>
    </div>
  );
}

// ── Date helpers ───────────────────────────────────────────────────────────

function offsetDate(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function formatDateDisplay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(new Date(iso + "T12:00:00Z"));
}

// ── Page ──────────────────────────────────────────────────────────────────

type LoadState = "loading" | "done" | "error";

type UnavailableReason = "no_url" | "no_token" | "error";

interface SourceState {
  timeline: EnergyTimeline | null;
  state: LoadState;
  unavailable?: UnavailableReason;
}

interface DateCache { canopy: SourceState; circuit: SourceState; chef: SourceState; }

export default function EnergyPage() {
  const [date, setDate] = useState(todayIST);
  const [canopy,  setCanopy]  = useState<SourceState>({ timeline: null, state: "loading" });
  const [circuit, setCircuit] = useState<SourceState>({ timeline: null, state: "loading" });
  const [chef,    setChef]    = useState<SourceState>({ timeline: null, state: "loading" });
  const cache = useRef<Record<string, DateCache>>({});

  useEffect(() => {
    // Show cached data immediately to avoid loading flicker (stale-while-revalidate).
    // Fetches always run in the background and overwrite both state and cache on arrival.
    const cached = cache.current[date];
    if (cached) {
      setCanopy(cached.canopy);
      setCircuit(cached.circuit);
      setChef(cached.chef);
    } else {
      setCanopy({ timeline: null, state: "loading" });
      setCircuit({ timeline: null, state: "loading" });
      setChef({ timeline: null, state: "loading" });
    }

    const pending = { canopy: null as SourceState | null, circuit: null as SourceState | null, chef: null as SourceState | null };
    const maybeCache = (key: keyof typeof pending, val: SourceState) => {
      pending[key] = val;
      if (pending.canopy && pending.circuit && pending.chef) {
        cache.current[date] = pending as DateCache;
      }
    };

    // Canopy — uses the shared api client (handles canopy auth token)
    api.energyTimeline(date)
      .then((t) => { const s = { timeline: t, state: "done" as const }; setCanopy(s); maybeCache("canopy", s); })
      .catch(() => { const s = { timeline: null, state: "error" as const }; setCanopy(s); maybeCache("canopy", s); });

    // Circuit — direct cross-app call using circuit_auth_token
    const circuitUrl = process.env.NEXT_PUBLIC_CIRCUIT_API_URL;
    if (!circuitUrl) {
      const s = { timeline: null, state: "done" as const, unavailable: "no_url" as const };
      setCircuit(s); maybeCache("circuit", s);
    } else if (!localStorage.getItem("circuit_auth_token")) {
      const s = { timeline: null, state: "done" as const, unavailable: "no_token" as const };
      setCircuit(s); maybeCache("circuit", s);
    } else {
      fetchExternal(circuitUrl, `/api/energy/timeline?date=${date}`, "circuit_auth_token")
        .then((t) => { const s = { timeline: t, state: "done" as const }; setCircuit(s); maybeCache("circuit", s); })
        .catch(() => { const s = { timeline: null, state: "done" as const }; setCircuit(s); maybeCache("circuit", s); });
    }

    // Chef — direct cross-app call using chef_auth_token
    const chefUrl = process.env.NEXT_PUBLIC_CHEF_API_URL;
    if (!chefUrl) {
      const s = { timeline: null, state: "done" as const, unavailable: "no_url" as const };
      setChef(s); maybeCache("chef", s);
    } else if (!localStorage.getItem("chef_auth_token")) {
      const s = { timeline: null, state: "done" as const, unavailable: "no_token" as const };
      setChef(s); maybeCache("chef", s);
    } else {
      fetchExternal(chefUrl, `/energy/timeline?date=${date}`, "chef_auth_token")
        .then((t) => { const s = { timeline: t, state: "done" as const }; setChef(s); maybeCache("chef", s); })
        .catch(() => { const s = { timeline: null, state: "done" as const }; setChef(s); maybeCache("chef", s); });
    }
  }, [date]);

  const allEvents: EnergyEvent[] = [
    ...(canopy.timeline?.events ?? []),
    ...(circuit.timeline?.events ?? []),
    ...(chef.timeline?.events ?? []),
  ].sort((a, b) => tm(a.time) - tm(b.time));

  const combinedAvg = allEvents.length > 0
    ? allEvents.reduce((s, e) => s + e.energy, 0) / allEvents.length
    : null;

  const isToday = date === todayIST();
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
          <button onClick={() => setDate(todayIST())} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>
            Today
          </button>
        )}
        <input
          type="date"
          value={date}
          max={todayIST()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="input"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, height: 30, width: 140 }}
        />
      </div>

      {/* Source status pills */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <SourcePill source="canopy"  timeline={canopy.timeline}  unavailable={canopy.state === "error" ? "error" : undefined} />
        <SourcePill source="circuit" timeline={circuit.timeline} unavailable={circuit.unavailable} />
        <SourcePill source="chef"    timeline={chef.timeline}    unavailable={chef.unavailable} />
      </div>

      {/* Combined total energy summary */}
      {combinedAvg !== null && (
        <div style={{
          display: "flex", alignItems: "baseline", gap: 14,
          padding: "10px 16px",
          borderRadius: "var(--r-4)",
          background: "var(--panel)",
          border: "0.5px solid var(--line)",
          marginBottom: 24,
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 70 }}>
            combined
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, lineHeight: 1,
            color: combinedAvg < 0.35 ? "var(--danger)" : combinedAvg > 0.65 ? "var(--good)" : "var(--fg-mute)",
          }}>
            {Math.round(combinedAvg * 100)}%
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-faint)" }}>
            {combinedAvg < 0.35 ? "draining" : combinedAvg > 0.65 ? "energising" : "neutral"} · {allEvents.length} event{allEvents.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

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
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={14} height={4} style={{ display: "block" }}>
              <line x1={0} y1={2} x2={14} y2={2} stroke="var(--fg)" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.4} />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>combined</span>
          </div>
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
