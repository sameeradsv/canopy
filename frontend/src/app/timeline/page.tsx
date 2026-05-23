"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Interaction, type InteractionUpdate } from "@/lib/api";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dateKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA");
}
function energyLabel(e: number | null) {
  if (e === null) return "";
  if (e < 0.35) return "draining";
  if (e > 0.65) return "energising";
  return "neutral";
}
function energyColor(e: number | null): string {
  if (e === null) return "var(--accent)";
  if (e < 0.35) return "var(--danger)";
  if (e > 0.65) return "var(--good)";
  return "var(--fg-mute)";
}
// Background tint for a day cell based on average energy
function dayBg(avg: number | null): string {
  if (avg === null) return "transparent";
  if (avg < 0.35) return "color-mix(in oklch, var(--danger) 10%, transparent)";
  if (avg > 0.65) return "color-mix(in oklch, var(--good) 10%, transparent)";
  return "transparent";
}

// ── Edit form ──────────────────────────────────────────────────────────────

function EditForm({ ix, onSave, onCancel }: {
  ix: Interaction;
  onSave: (data: InteractionUpdate) => Promise<void>;
  onCancel: () => void;
}) {
  const [observation, setObservation] = useState(ix.observation);
  const [context, setContext] = useState(ix.context ?? "");
  const [confidence, setConfidence] = useState(ix.confidence);
  const [energy, setEnergy] = useState(ix.energy !== null && ix.energy !== undefined ? Math.round(ix.energy * 100) : 50);
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal(ix.occurred_at));
  const [tagsInput, setTagsInput] = useState(ix.tags.map((t) => t.name).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyReason, setClassifyReason] = useState<string | null>(null);

  async function handleClassify() {
    if (!observation.trim()) return;
    setClassifying(true);
    setClassifyReason(null);
    try {
      const result = await api.classifyInteraction({
        observation: observation.trim(),
        context: context.trim() || null,
        participant_ids: ix.participants.map((p) => p.id),
      });
      setEnergy(Math.round(result.energy * 100));
      setClassifyReason(result.reasoning);
    } catch {
      setClassifyReason("Classification unavailable.");
    } finally {
      setClassifying(false);
    }
  }

  async function handleSave() {
    if (!observation.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        observation: observation.trim(),
        context: context.trim() || null,
        confidence,
        energy: energy / 100,
        occurred_at: new Date(occurredAt).toISOString(),
        tag_names: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const cpct = Math.round(confidence * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      <textarea value={observation} onChange={(e) => setObservation(e.target.value)} className="textarea" style={{ minHeight: 80 }} autoFocus />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="field">
          <div className="field-label">When</div>
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="input" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
        </div>
        <div className="field">
          <div className="field-label">Context</div>
          <input type="text" value={context} onChange={(e) => setContext(e.target.value)} className="input" placeholder="Where, setting…" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="field">
          <div className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Confidence</span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{cpct}%</span>
          </div>
          <input type="range" min={0} max={100} value={cpct} onChange={(e) => setConfidence(Number(e.target.value) / 100)} className="slider"
            style={{ backgroundImage: `linear-gradient(var(--accent), var(--accent))`, backgroundSize: `${cpct}% 100%`, backgroundRepeat: "no-repeat" }} />
        </div>
        <div className="field">
          <div className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Energy</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={handleClassify} disabled={classifying || !observation.trim()} className="btn ghost"
                style={{ fontSize: 10, padding: "1px 6px", height: "auto" }}>
                {classifying ? "…" : "✦"}
              </button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: energyColor(energy / 100) }}>{energyLabel(energy / 100)}</span>
            </div>
          </div>
          <input type="range" min={0} max={100} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="slider"
            style={{ backgroundImage: `linear-gradient(var(--accent), var(--accent))`, backgroundSize: `${energy}% 100%`, backgroundRepeat: "no-repeat" }} />
          {classifyReason && <p style={{ fontSize: 10, color: "var(--fg-mute)", marginTop: 2, fontStyle: "italic" }}>{classifyReason}</p>}
        </div>
      </div>
      <div className="field">
        <div className="field-label">Tags</div>
        <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="input" placeholder="comma-separated" />
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving || !observation.trim()} className="btn primary" style={{ height: 30, fontSize: 12 }}>{saving ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="btn ghost" style={{ height: 30, fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Interaction row ────────────────────────────────────────────────────────

function InteractionRow({ ix, editingId, confirmDeleteId, setEditingId, setConfirmDeleteId, onSave, onDelete, showDate = false }: {
  ix: Interaction;
  editingId: number | null;
  confirmDeleteId: number | null;
  setEditingId: (id: number | null) => void;
  setConfirmDeleteId: (id: number | null) => void;
  onSave: (id: number, data: InteractionUpdate) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  showDate?: boolean;
}) {
  const time = new Date(ix.occurred_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const date = new Date(ix.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="tl-item">
      <div className="tl-time">
        {showDate && <div>{date}</div>}
        <div style={{ marginTop: showDate ? 2 : 0, opacity: showDate ? 0.7 : 1 }}>{time}</div>
        {ix.energy !== null && ix.energy !== undefined && (
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: energyColor(ix.energy), marginTop: 3, letterSpacing: "0.03em" }}>
            {energyLabel(ix.energy)}
          </div>
        )}
      </div>
      <div className="tl-body">
        {editingId === ix.id ? (
          <EditForm ix={ix} onSave={(data) => onSave(ix.id, data)} onCancel={() => setEditingId(null)} />
        ) : (
          <>
            {ix.participants.length > 0 && (
              <div className="who">
                {ix.participants.map((p) => <b key={p.id}>{p.name}</b>)}
                <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>· {Math.round(ix.confidence * 100)}% confidence</span>
              </div>
            )}
            <div className="note">{ix.observation}</div>
            {ix.context && <div style={{ marginTop: 6, fontSize: 13, color: "var(--fg-mute)" }}>{ix.context}</div>}
            {ix.tags.length > 0 && (
              <div className="tags">{ix.tags.map((t) => <span key={t.id} className="tag">{t.name}</span>)}</div>
            )}
          </>
        )}
      </div>
      {editingId !== ix.id && (
        <div className="tl-actions">
          {confirmDeleteId === ix.id ? (
            <>
              <span style={{ fontSize: 11, color: "var(--fg-mute)" }}>Sure?</span>
              <button onClick={() => onDelete(ix.id)} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Yes</button>
              <button onClick={() => setConfirmDeleteId(null)} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>No</button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditingId(ix.id); setConfirmDeleteId(null); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>Edit</button>
              <button onClick={() => { setConfirmDeleteId(ix.id); setEditingId(null); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Calendar view ──────────────────────────────────────────────────────────

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarView({ interactions, editingId, confirmDeleteId, setEditingId, setConfirmDeleteId, onSave, onDelete }: {
  interactions: Interaction[];
  editingId: number | null;
  confirmDeleteId: number | null;
  setEditingId: (id: number | null) => void;
  setConfirmDeleteId: (id: number | null) => void;
  onSave: (id: number, data: InteractionUpdate) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const todayKey = dateKey(new Date().toISOString());
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);

  // Group interactions by date
  const byDate: Record<string, Interaction[]> = {};
  for (const ix of interactions) {
    const k = dateKey(ix.occurred_at);
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(ix);
  }

  // Average energy per day (null if no interactions or none have energy set)
  function dayAvgEnergy(k: string): number | null {
    const items = byDate[k] ?? [];
    const withEnergy = items.filter((ix) => ix.energy !== null && ix.energy !== undefined);
    if (withEnergy.length === 0) return null;
    return withEnergy.reduce((s, ix) => s + (ix.energy as number), 0) / withEnergy.length;
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedInteractions = (byDate[selectedKey] ?? [])
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}>‹</button>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500, minWidth: 160, textAlign: "center" }}>
          {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}>›</button>
        <button onClick={() => { setViewMonth(new Date()); setSelectedKey(todayKey); }} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>Today</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.06em", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day cells — show events as stacked chips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const items = byDate[k] ?? [];
          const avg = dayAvgEnergy(k);
          const isToday = k === todayKey;
          const isSelected = k === selectedKey;

          return (
            <div
              key={k}
              onClick={() => setSelectedKey(isSelected ? selectedKey : k)}
              style={{
                minHeight: 72,
                border: isSelected ? "1.5px solid var(--accent)" : `0.5px solid ${isToday ? "var(--accent)" : "var(--line-soft)"}`,
                borderRadius: "var(--r-3)",
                background: isSelected ? "var(--accent-soft)" : dayBg(avg),
                cursor: "pointer",
                padding: "5px 5px 4px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: isToday ? 600 : 400, color: isToday ? "var(--accent)" : "var(--fg)", lineHeight: 1, marginBottom: 2 }}>
                {day}
              </span>
              {items.slice(0, 3).map((ix) => (
                <div key={ix.id} style={{
                  fontSize: 9,
                  lineHeight: 1.3,
                  padding: "2px 4px",
                  borderRadius: 3,
                  background: ix.energy !== null && ix.energy !== undefined
                    ? ix.energy < 0.35 ? "color-mix(in oklch, var(--danger) 18%, var(--panel))"
                    : ix.energy > 0.65 ? "color-mix(in oklch, var(--good) 18%, var(--panel))"
                    : "var(--panel)"
                    : "var(--panel)",
                  color: ix.energy !== null && ix.energy !== undefined
                    ? ix.energy < 0.35 ? "var(--danger)"
                    : ix.energy > 0.65 ? "var(--good)"
                    : "var(--fg-mute)"
                    : "var(--fg-mute)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}>
                  {ix.observation.slice(0, 22)}
                </div>
              ))}
              {items.length > 3 && (
                <div style={{ fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", paddingLeft: 4 }}>
                  +{items.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      <div style={{ marginTop: 28, borderTop: "0.5px solid var(--line-soft)", paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {new Date(selectedKey + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {" · "}{selectedInteractions.length} interaction{selectedInteractions.length !== 1 ? "s" : ""}
          </div>
          {selectedInteractions.length > 0 && (() => {
            const avg = dayAvgEnergy(selectedKey);
            return avg !== null ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: energyColor(avg) }}>
                avg energy: {Math.round(avg * 100)}% · {energyLabel(avg)}
              </span>
            ) : null;
          })()}
        </div>
        {selectedInteractions.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Nothing logged.</p>
            <Link href="/capture" className="btn ghost" style={{ height: 26, padding: "0 10px", fontSize: 12 }}>+ Capture</Link>
          </div>
        ) : (
          <div className="tl-feed">
            {selectedInteractions.map((ix) => (
              <InteractionRow key={ix.id} ix={ix} editingId={editingId} confirmDeleteId={confirmDeleteId}
                setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
                onSave={onSave} onDelete={onDelete} showDate={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type View = "list" | "calendar";

export default function TimelinePage() {
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    api.interactions({ limit: 500 }).then(setInteractions).catch(() => setUnreachable(true));
  }, []);

  async function handleSave(id: number, data: InteractionUpdate) {
    const updated = await api.updateInteraction(id, data);
    setInteractions((prev) => prev?.map((ix) => (ix.id === id ? updated : ix)) ?? null);
    setEditingId(null);
  }

  async function handleDelete(id: number) {
    await api.deleteInteraction(id);
    setInteractions((prev) => prev?.filter((ix) => ix.id !== id) ?? null);
    setConfirmDeleteId(null);
  }

  if (unreachable) return (
    <>
      <div className="page-header"><h1 className="page-title">The <em>timeline.</em></h1></div>
      <p style={{ color: "var(--fg-mute)" }}>Cannot reach the API.</p>
    </>
  );

  if (!interactions) return <div className="page-header"><h1 className="page-title">The <em>timeline.</em></h1></div>;

  const sorted = [...interactions].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Timeline</div>
          <h1 className="page-title">The <em>timeline.</em></h1>
          <p className="page-sub">{sorted.length} interaction{sorted.length === 1 ? "" : "s"} logged.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: "0.5px solid var(--line)", borderRadius: "var(--r-3)", overflow: "hidden" }}>
            {(["list", "calendar"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={view === v ? "btn primary" : "btn ghost"}
                style={{ height: 32, padding: "0 14px", fontSize: 12, borderRadius: 0, border: "none", textTransform: "capitalize" }}>
                {v}
              </button>
            ))}
          </div>
          <Link href="/capture" className="btn primary">+ Capture</Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>Nothing captured yet.</p>
          <Link href="/capture" className="btn primary">Log your first interaction</Link>
        </div>
      ) : view === "list" ? (
        <div className="tl-feed">
          {sorted.map((ix) => (
            <InteractionRow key={ix.id} ix={ix} editingId={editingId} confirmDeleteId={confirmDeleteId}
              setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
              onSave={handleSave} onDelete={handleDelete} showDate />
          ))}
        </div>
      ) : (
        <CalendarView interactions={interactions} editingId={editingId} confirmDeleteId={confirmDeleteId}
          setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
          onSave={handleSave} onDelete={handleDelete} />
      )}
    </>
  );
}
