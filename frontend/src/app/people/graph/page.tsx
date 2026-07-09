"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Person, type PersonScore } from "@/lib/api";

const ALL_DIMENSIONS = [
  "energy", "reciprocity", "intent", "effort", "fairness",
  "reliability", "collaboration", "growth", "boundaries",
  "authenticity", "support", "connection", "tension",
];

// Subset that make meaningful spatial axes; all dims still shown in detail panel
const AXIS_DIMENSIONS = [
  "energy", "reciprocity", "connection", "reliability",
  "growth", "support", "effort", "collaboration",
];

const DIM_LABEL: Record<string, string> = {
  energy: "Energy", reciprocity: "Reciprocity", intent: "Intent",
  effort: "Effort", fairness: "Fairness", reliability: "Reliability",
  collaboration: "Collaboration", growth: "Growth", boundaries: "Boundaries",
  authenticity: "Authenticity", support: "Support", connection: "Connection",
  tension: "Tension",
};

function energyColor(v: number | undefined): string {
  if (v == null) return "var(--fg-faint)";
  if (v < 0.35) return "var(--danger)";
  if (v > 0.65) return "var(--good)";
  return "var(--warn)";
}

function RadarChart({ scores, dims }: { scores: Record<string, number>; dims: string[] }) {
  const cx = 100, cy = 100, r = 62;
  const n = dims.length;
  if (n < 3) return null;

  const pts = (scale: number) =>
    dims.map((_, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      return [cx + scale * r * Math.cos(a), cy + scale * r * Math.sin(a)] as [number, number];
    });

  const webs = [0.25, 0.5, 0.75, 1].map((s) =>
    pts(s).map(([x, y]) => `${x},${y}`).join(" ")
  );

  const scorePts = dims.map((_, i) => {
    const v = scores[dims[i]] ?? 0;
    return [cx + v * r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), cy + v * r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)];
  });

  const labelPts = pts(1.18);

  return (
    <svg viewBox="0 0 200 200" className="radar-svg" width={200} height={200}>
      {webs.map((pts, i) => <polygon key={i} points={pts} className="radar-web" />)}
      {pts(1).map(([x, y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-spoke" />
      ))}
      <polygon
        points={scorePts.map(([x, y]) => `${x},${y}`).join(" ")}
        className="radar-shape"
      />
      {labelPts.map(([x, y], i) => (
        <text key={i} x={x} y={y} className="radar-label" dominantBaseline="middle">
          {DIM_LABEL[dims[i]] ?? dims[i]}
        </text>
      ))}
    </svg>
  );
}

type PersonWithScore = Person & { score: PersonScore | null };

export default function GraphPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [scores, setScores] = useState<Record<number, PersonScore>>({});
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [xDim, setXDim] = useState("energy");
  const [yDim, setYDim] = useState("reciprocity");
  const [selected, setSelected] = useState<PersonWithScore | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    Promise.all([api.people(), api.getAllScores()])
      .then(([p, s]) => {
        setPeople(p);
        setScores(s);
        // Auto-select first two axis dims that have data
        const scored = new Set<string>();
        Object.values(s).forEach((ps) => Object.keys(ps.scores).forEach((d) => scored.add(d)));
        const available = AXIS_DIMENSIONS.filter((d) => scored.has(d));
        if (available[0]) setXDim(available[0]);
        if (available[1]) setYDim(available[1]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleScoreAll() {
    setScoring(true);
    try {
      await api.scoreAll();
      const s = await api.getAllScores();
      setScores(s);
    } catch { /* ignore */ }
    finally { setScoring(false); }
  }

  async function handleScorePerson(person: Person) {
    try {
      const s = await api.scorePersonById(person.id);
      setScores((prev) => ({ ...prev, [person.id]: s }));
      setSelected({ ...person, score: s });
    } catch { /* ignore */ }
  }

  const data: PersonWithScore[] = useMemo(
    () => people.map((p) => ({ ...p, score: scores[p.id] ?? null })),
    [people, scores]
  );

  // Determine which dimensions have at least one score
  const availableDims = useMemo(() => {
    const set = new Set<string>();
    Object.values(scores).forEach((s) => Object.keys(s.scores).forEach((d) => set.add(d)));
    return ALL_DIMENSIONS.filter((d) => set.has(d));
  }, [scores]);

  const scoredPeople = data.filter((p) => p.score && p.score.scores[xDim] != null && p.score.scores[yDim] != null);

  // SVG plot dimensions
  const W = 500, H = 400, pad = { top: 20, right: 20, bottom: 50, left: 50 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Graph</div>
          <h1 className="page-title">People <em>map.</em></h1>
          <p className="page-sub">
            Each dot is a person — size reflects interaction count, colour reflects energy.
            Scores are AI-generated from your interaction notes.
          </p>
        </div>
        <button
          onClick={handleScoreAll}
          disabled={scoring}
          className="btn primary"
        >
          {scoring ? "Scoring…" : "✦ Score all"}
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Loading…</p>
      ) : (
        <div className={`graph-wrap${selected ? " has-detail" : ""}`}>
          <div className="graph-panel">
            <div className="graph-controls">
              <div className="graph-axis-select">
                <span>X</span>
                <select value={xDim} onChange={(e) => setXDim(e.target.value)}>
                  {AXIS_DIMENSIONS.map((d) => (
                    <option key={d} value={d} disabled={!availableDims.includes(d)}>
                      {DIM_LABEL[d]}{!availableDims.includes(d) ? " (no data)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="graph-axis-select">
                <span>Y</span>
                <select value={yDim} onChange={(e) => setYDim(e.target.value)}>
                  {AXIS_DIMENSIONS.map((d) => (
                    <option key={d} value={d} disabled={!availableDims.includes(d)}>
                      {DIM_LABEL[d]}{!availableDims.includes(d) ? " (no data)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {availableDims.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--fg-faint)", fontStyle: "italic" }}>
                  No scores yet — click &quot;Score all&quot; to generate them.
                </span>
              )}
            </div>

            <div className="graph-svg-wrap">
            <svg
              ref={svgRef}
              className="graph-svg"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g transform={`translate(${pad.left},${pad.top})`}>
                {/* Grid lines + ticks */}
                {ticks.map((t) => {
                  const x = t * plotW;
                  const y = plotH - t * plotH;
                  return (
                    <g key={t}>
                      <line x1={x} y1={0} x2={x} y2={plotH} stroke="var(--line-soft)" strokeWidth={0.5} />
                      <line x1={0} y1={y} x2={plotW} y2={y} stroke="var(--line-soft)" strokeWidth={0.5} />
                      <text x={x} y={plotH + 16} className="graph-tick" textAnchor="middle">{t.toFixed(2)}</text>
                      <text x={-10} y={y} className="graph-tick" textAnchor="end" dominantBaseline="middle">{t.toFixed(2)}</text>
                    </g>
                  );
                })}

                {/* Axes */}
                <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--line)" strokeWidth={1} />
                <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--line)" strokeWidth={1} />

                {/* Axis labels */}
                <text x={plotW / 2} y={plotH + 38} className="graph-axis-label" textAnchor="middle">
                  {DIM_LABEL[xDim]}
                </text>
                <text
                  x={-plotH / 2} y={-36}
                  className="graph-axis-label"
                  textAnchor="middle"
                  transform="rotate(-90)"
                >
                  {DIM_LABEL[yDim]}
                </text>

                {/* Dots */}
                {scoredPeople.map((p) => {
                  const sx = (p.score!.scores[xDim] ?? 0.5) * plotW;
                  const sy = plotH - (p.score!.scores[yDim] ?? 0.5) * plotH;
                  const r = Math.max(6, Math.min(20, 4 + Math.sqrt(p.interaction_count) * 3));
                  const isSelected = selected?.id === p.id;
                  return (
                    <g key={p.id} onClick={() => setSelected(isSelected ? null : { ...p, score: p.score })}>
                      <circle
                        cx={sx} cy={sy} r={r}
                        fill={energyColor(p.score?.scores["energy"])}
                        fillOpacity={isSelected ? 1 : 0.72}
                        stroke={isSelected ? "var(--fg)" : "var(--bg)"}
                        strokeWidth={isSelected ? 2 : 1}
                        className="graph-dot"
                      />
                      {r > 10 && (
                        <text x={sx} y={sy + r + 11} className="graph-name" textAnchor="middle">
                          {p.name.split(" ")[0]}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Unscored people as ghost dots */}
                {data.filter((p) => !p.score).map((p) => (
                  <g key={p.id} onClick={() => handleScorePerson(p)} style={{ cursor: "default" }}>
                    <circle
                      cx={plotW * 0.5} cy={plotH * 0.5} r={7}
                      fill="none"
                      stroke="var(--line)"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                    <text x={plotW * 0.5} y={plotH * 0.5 + 18} className="graph-name" textAnchor="middle" style={{ fill: "var(--fg-faint)", fontSize: 10 }}>
                      {p.name.split(" ")[0]}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
            </div>

            {people.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--fg-faint)", fontSize: 13, marginTop: 40 }}>
                No people yet — add people and interactions first.
              </p>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="graph-detail">
              <div>
                <div className="graph-detail-name">{selected.name}</div>
                {selected.relationship && (
                  <div className="graph-detail-rel">{selected.relationship}</div>
                )}
              </div>

              {selected.score ? (
                <>
                  {selected.score.summary && (
                    <p className="graph-detail-summary">&ldquo;{selected.score.summary}&rdquo;</p>
                  )}

                  <RadarChart
                    scores={selected.score.scores}
                    dims={Object.keys(selected.score.scores)}
                  />

                  <div className="graph-detail-dims">
                    {Object.entries(selected.score.scores).map(([dim, val]) => (
                      <div key={dim} className="dim-score-row">
                        <span className="dim-score-label">{DIM_LABEL[dim] ?? dim}</span>
                        <div className="dim-score-bar">
                          <i style={{ width: `${val * 100}%` }} />
                        </div>
                        <span className="dim-score-val">{(val * 10).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                      confidence {Math.round(selected.score.confidence * 100)}% · {selected.score.interaction_count} interactions
                    </span>
                    <button
                      onClick={() => handleScorePerson(selected)}
                      className="btn ghost"
                      style={{ fontSize: 11, padding: "2px 8px", height: "auto" }}
                    >
                      ✦ rescore
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <p style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: 16 }}>
                    No scores yet for {selected.name}.
                  </p>
                  <button
                    onClick={() => handleScorePerson(selected)}
                    className="btn primary"
                    style={{ fontSize: 13 }}
                  >
                    ✦ score now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
