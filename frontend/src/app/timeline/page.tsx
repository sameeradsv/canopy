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
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD, locale-independent
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
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal(ix.occurred_at));
  const [tagsInput, setTagsInput] = useState(ix.tags.map((t) => t.name).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!observation.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        observation: observation.trim(),
        context: context.trim() || null,
        confidence,
        occurred_at: new Date(occurredAt).toISOString(),
        tag_names: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const pct = Math.round(confidence * 100);
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
      <div className="field">
        <div className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Confidence</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{pct}%</span>
        </div>
        <input type="range" min={0} max={100} value={pct} onChange={(e) => setConfidence(Number(e.target.value) / 100)} className="slider"
          style={{ backgroundImage: `linear-gradient(var(--accent), var(--accent))`, backgroundSize: `${pct}% 100%`, backgroundRepeat: "no-repeat" }} />
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

// ── Single interaction row (shared by list + calendar) ─────────────────────

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
            <div className="tl-actions">
              {confirmDeleteId === ix.id ? (
                <>
                  <span style={{ fontSize: 11, color: "var(--fg-mute)" }}>Delete?</span>
                  <button onClick={() => onDelete(ix.id)} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Yes</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingId(ix.id); setConfirmDeleteId(null); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>Edit</button>
                  <button onClick={() => { setConfirmDeleteId(ix.id); setEditingId(null); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Delete</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
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
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const byDate: Record<string, Interaction[]> = {};
  for (const ix of interactions) {
    const k = dateKey(ix.occurred_at);
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(ix);
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date().toISOString());

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedInteractions = selectedKey ? (byDate[selectedKey] ?? []) : [];

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}>‹</button>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500, minWidth: 160, textAlign: "center" }}>
          {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}>›</button>
        <button onClick={() => { setViewMonth(new Date()); setSelectedKey(todayKey); }} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>Today</button>
      </div>

      {/* Day-of-week header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.06em", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = byDate[k]?.length ?? 0;
          const isToday = k === todayKey;
          const isSelected = k === selectedKey;

          return (
            <button
              key={k}
              onClick={() => setSelectedKey(isSelected ? null : k)}
              style={{
                aspectRatio: "1",
                border: isSelected ? "1.5px solid var(--accent)" : `0.5px solid ${isToday ? "var(--accent)" : "var(--line-soft)"}`,
                borderRadius: "var(--r-3)",
                background: isSelected ? "var(--accent-soft)" : "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: 2,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: isToday ? 600 : 400, color: isToday ? "var(--accent)" : "var(--fg)" }}>
                {day}
              </span>
              {count > 0 && (
                <span style={{
                  minWidth: 16, height: 14, borderRadius: 999,
                  background: isSelected ? "var(--accent)" : "var(--accent-soft)",
                  color: isSelected ? "white" : "var(--accent)",
                  fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
                  display: "grid", placeItems: "center", padding: "0 3px",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day feed */}
      {selectedKey && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            {new Date(selectedKey + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {" · "}
            {selectedInteractions.length} interaction{selectedInteractions.length !== 1 ? "s" : ""}
          </div>
          {selectedInteractions.length === 0 ? (
            <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Nothing logged this day. <Link href="/capture" className="btn ghost" style={{ height: 24, padding: "0 8px", fontSize: 12 }}>+ Capture</Link></p>
          ) : (
            <div className="tl-feed">
              {selectedInteractions
                .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
                .map((ix) => (
                  <InteractionRow key={ix.id} ix={ix} editingId={editingId} confirmDeleteId={confirmDeleteId}
                    setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
                    onSave={onSave} onDelete={onDelete} showDate={false} />
                ))}
            </div>
          )}
        </div>
      )}
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
          {/* View toggle */}
          <div style={{ display: "flex", border: "0.5px solid var(--line)", borderRadius: "var(--r-3)", overflow: "hidden" }}>
            {(["list", "calendar"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={view === v ? "btn primary" : "btn ghost"}
                style={{ height: 32, padding: "0 14px", fontSize: 12, borderRadius: 0, border: "none", textTransform: "capitalize" }}
              >
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
