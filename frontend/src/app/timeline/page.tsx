"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Interaction, type InteractionUpdate, type Person } from "@/lib/api";
import { InteractionCard } from "@/components/InteractionCard";
import { TagInput } from "@/components/TagInput";
import { TZ, fmtDateIST, fmtTimeIST, toISTDatetimeLocal, fromISTDatetimeLocal } from "@/lib/tz";

const KIND_GLYPH: Record<string, string> = {
  meeting: "◧",
  call: "◌",
  message: "✉",
  meal: "◇",
  walk: "⌒",
  "one-on-one": "◉",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function toDatetimeLocal(iso: string): string {
  return toISTDatetimeLocal(iso);
}
function dateKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
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
function dayBg(avg: number | null): string {
  if (avg === null) return "transparent";
  if (avg < 0.35) return "color-mix(in oklch, var(--danger) 10%, transparent)";
  if (avg > 0.65) return "color-mix(in oklch, var(--good) 10%, transparent)";
  return "transparent";
}

// ── Edit form ──────────────────────────────────────────────────────────────

function EditForm({ ix, onSave, onCancel, people }: {
  ix: Interaction;
  onSave: (data: InteractionUpdate) => Promise<void | Interaction>;
  onCancel: () => void;
  people: Person[];
}) {
  const [observation, setObservation] = useState(ix.observation);
  const [context, setContext] = useState(ix.context ?? "");
  const [confidence, setConfidence] = useState(ix.confidence);
  const [energy, setEnergy] = useState(ix.energy !== null && ix.energy !== undefined ? Math.round(ix.energy * 100) : 50);
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal(ix.occurred_at));
  const [tagsInput, setTagsInput] = useState(ix.tags.map((t) => t.name).join(", "));
  const [participantIds, setParticipantIds] = useState<number[]>(ix.participants.map((p) => p.id));
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
        occurred_at: fromISTDatetimeLocal(occurredAt),
        tag_names: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        participant_ids: participantIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const cpct = Math.round(confidence * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      {people.length > 0 && (
        <div className="field">
          <div className="field-label">With whom</div>
          <div className="person-pick" style={{ gap: 4 }}>
            {people.map((p) => {
              const on = participantIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setParticipantIds((prev) => on ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                  className={`chip ${on ? "on" : ""}`}
                  style={{ fontSize: 12, padding: "3px 8px" }}
                >
                  {!on && (
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 8, fontWeight: 600, flexShrink: 0 }}>
                      {initials(p.name)}
                    </span>
                  )}
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
        <TagInput value={tagsInput} onChange={setTagsInput} className="input" placeholder="comma-separated" />
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving || !observation.trim()} className="btn primary" style={{ height: 30, fontSize: 12 }}>{saving ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="btn ghost" style={{ height: 30, fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Interaction row (feed view) ────────────────────────────────────────────

function InteractionRow({ ix, editingId, confirmDeleteId, setEditingId, setConfirmDeleteId, onSave, onDelete, showDate = false, people }: {
  ix: Interaction;
  editingId: number | null;
  confirmDeleteId: number | null;
  setEditingId: (id: number | null) => void;
  setConfirmDeleteId: (id: number | null) => void;
  onSave: (id: number, data: InteractionUpdate) => Promise<Interaction | void>;
  onDelete: (id: number) => Promise<void>;
  showDate?: boolean;
  people: Person[];
}) {
  if (editingId === ix.id) {
    return (
      <InteractionCard
        ix={ix}
        showDate={showDate}
        body={<EditForm ix={ix} onSave={(data) => onSave(ix.id, data)} onCancel={() => setEditingId(null)} people={people} />}
      />
    );
  }

  return (
    <InteractionCard
      ix={ix}
      showDate={showDate}
      actions={
        confirmDeleteId === ix.id ? (
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
        )
      }
    />
  );
}

// ── Diary view ─────────────────────────────────────────────────────────────

function DiaryView({ interactions, editingId, confirmDeleteId, setEditingId, setConfirmDeleteId, onSave, onDelete, people }: {
  interactions: Interaction[];
  editingId: number | null;
  confirmDeleteId: number | null;
  setEditingId: (id: number | null) => void;
  setConfirmDeleteId: (id: number | null) => void;
  onSave: (id: number, data: InteractionUpdate) => Promise<Interaction | void>;
  onDelete: (id: number) => Promise<void>;
  people: Person[];
}) {
  // Group by local date key, descending
  const grouped: { key: string; date: Date; items: Interaction[] }[] = [];
  const seen = new Map<string, Interaction[]>();
  for (const ix of interactions) {
    const k = dateKey(ix.occurred_at);
    if (!seen.has(k)) {
      seen.set(k, []);
      grouped.push({ key: k, date: new Date(ix.occurred_at), items: seen.get(k)! });
    }
    seen.get(k)!.push(ix);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {grouped.map(({ key, date, items }) => {
        const day = date.getDate();
        const dow = fmtDateIST(date, { weekday: "long" });
        const monthYear = fmtDateIST(date, { month: "long", year: "numeric" });
        return (
          <div key={key}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16, borderBottom: "0.5px solid var(--line-soft)", paddingBottom: 12 }}>
              <span style={{
                fontFamily: "var(--font-serif)",
                fontSize: 56,
                fontWeight: 500,
                lineHeight: 1,
                color: "var(--accent)",
                fontStyle: "italic",
                minWidth: 56,
              }}>{day}</span>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)" }}>{dow}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>{monthYear}</div>
              </div>
              <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-faint)" }}>
                {items.length} interaction{items.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="tl-feed">
              {items.map((ix) => (
                <InteractionRow key={ix.id} ix={ix} editingId={editingId} confirmDeleteId={confirmDeleteId}
                  setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
                  onSave={onSave} onDelete={onDelete} showDate={false} people={people} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Terminal view ──────────────────────────────────────────────────────────

function TerminalView({ interactions, onDelete }: {
  interactions: Interaction[];
  onDelete: (id: number) => Promise<void>;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Group by day for dashed day separators
  let lastDay = "";

  return (
    <div className="terminal-scroll">
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, minWidth: 280 }}>
      {interactions.map((ix) => {
        const d = new Date(ix.occurred_at);
        const dayStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
        const isNewDay = dayStr !== lastDay;
        lastDay = dayStr;
        const dateStr = dayStr;
        const timeStr = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
        const kindStr = ix.kind ? ix.kind.padEnd(10) : "—".padEnd(10);
        const names = ix.participants.map((p) => p.name.split(" ")[0]).join(", ") || "—";
        const note = ix.observation.slice(0, 60) + (ix.observation.length > 60 ? "…" : "");

        return (
          <div key={ix.id}>
            {isNewDay && (
              <div style={{ color: "var(--fg-faint)", borderTop: "0.5px dashed var(--line)", marginTop: 8, paddingTop: 8, paddingBottom: 2, letterSpacing: "0.08em", fontSize: 10 }}>
                {dateStr}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: 0, padding: "1px 0" }}>
              <span style={{ color: "var(--fg-faint)", minWidth: 44 }}>{timeStr}</span>
              <span style={{ color: "var(--accent)", minWidth: 88 }}>{kindStr}</span>
              <span style={{ color: "var(--fg-mute)", minWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names.padEnd(12).slice(0, 12)}</span>
              <span style={{ color: "var(--fg)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note}</span>
              <div style={{ marginLeft: 12, display: "flex", gap: 4, flexShrink: 0 }}>
                {confirmDeleteId === ix.id ? (
                  <>
                    <button onClick={() => onDelete(ix.id)} style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "none", border: "none", color: "var(--danger)", cursor: "default", padding: "0 4px" }}>del</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "none", border: "none", color: "var(--fg-faint)", cursor: "default", padding: "0 4px" }}>no</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDeleteId(ix.id)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "none", border: "none", color: "var(--fg-faint)", cursor: "default", padding: "0 4px", opacity: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                  >×</button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

// ── Calendar view ──────────────────────────────────────────────────────────

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthDateRange(year: number, month: number) {
  const from_date = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to_date = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from_date, to_date };
}

function CalendarView({ editingId, confirmDeleteId, setEditingId, setConfirmDeleteId, onSave, onDelete, people }: {
  editingId: number | null;
  confirmDeleteId: number | null;
  setEditingId: (id: number | null) => void;
  setConfirmDeleteId: (id: number | null) => void;
  onSave: (id: number, data: InteractionUpdate) => Promise<Interaction | void>;
  onDelete: (id: number) => Promise<void>;
  people: Person[];
}) {
  const todayKey = dateKey(new Date().toISOString());
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [monthInteractions, setMonthInteractions] = useState<Interaction[]>([]);
  const [monthLoading, setMonthLoading] = useState(true);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  useEffect(() => {
    let cancelled = false;
    setMonthLoading(true);
    const { from_date, to_date } = monthDateRange(year, month);
    api.interactions({ from_date, to_date, limit: 500 })
      .then((items) => { if (!cancelled) setMonthInteractions(items); })
      .catch(() => { if (!cancelled) setMonthInteractions([]); })
      .finally(() => { if (!cancelled) setMonthLoading(false); });
    return () => { cancelled = true; };
  }, [year, month]);

  async function handleSave(id: number, data: InteractionUpdate) {
    const updated = await onSave(id, data);
    if (updated) {
      setMonthInteractions((prev) => prev.map((ix) => (ix.id === id ? updated : ix)));
    }
  }

  async function handleDeleteLocal(id: number) {
    await onDelete(id);
    setMonthInteractions((prev) => prev.filter((ix) => ix.id !== id));
  }

  const byDate: Record<string, Interaction[]> = {};
  for (const ix of monthInteractions) {
    const k = dateKey(ix.occurred_at);
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(ix);
  }

  function dayAvgEnergy(k: string): number | null {
    const items = byDate[k] ?? [];
    const withEnergy = items.filter((ix) => ix.energy !== null && ix.energy !== undefined);
    if (withEnergy.length === 0) return null;
    return withEnergy.reduce((s, ix) => s + (ix.energy as number), 0) / withEnergy.length;
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}>‹</button>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500, minWidth: 160, textAlign: "center" }}>
          {fmtDateIST(viewMonth, { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="btn ghost" style={{ height: 30, padding: "0 10px" }}>›</button>
        <button onClick={() => { setViewMonth(new Date()); setSelectedKey(todayKey); }} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>Today</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.06em", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, opacity: monthLoading ? 0.5 : 1 }}>
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
                  fontSize: 9, lineHeight: 1.3, padding: "2px 4px", borderRadius: 3,
                  background: ix.energy !== null && ix.energy !== undefined
                    ? ix.energy < 0.35 ? "color-mix(in oklch, var(--danger) 18%, var(--panel))"
                    : ix.energy > 0.65 ? "color-mix(in oklch, var(--good) 18%, var(--panel))"
                    : "var(--panel)" : "var(--panel)",
                  color: ix.energy !== null && ix.energy !== undefined
                    ? ix.energy < 0.35 ? "var(--danger)" : ix.energy > 0.65 ? "var(--good)" : "var(--fg-mute)"
                    : "var(--fg-mute)",
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}>
                  {ix.kind && KIND_GLYPH[ix.kind] ? KIND_GLYPH[ix.kind] + " " : ""}{ix.observation.slice(0, 20)}
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

      <div style={{ marginTop: 28, borderTop: "0.5px solid var(--line-soft)", paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {fmtDateIST(new Date(selectedKey + "T12:00:00Z"), { weekday: "long", month: "long", day: "numeric" })}
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
                onSave={handleSave} onDelete={handleDeleteLocal} showDate={false} people={people} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type View = "feed" | "diary" | "calendar" | "terminal";
const VIEWS: View[] = ["feed", "diary", "calendar", "terminal"];
const PAGE_SIZE = 30;

function TimelinePagination({
  page,
  pageSize,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(total, (page + 1) * pageSize);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, fontSize: 13 }}>
      <span style={{ fontFamily: "var(--font-serif)", color: "var(--fg-mute)" }}>
        {rangeStart}–{rangeEnd} of {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="btn ghost"
          style={{ height: 30, fontSize: 12 }}
          disabled={page === 0 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontSize: 12 }}>
          {page + 1} / {pageCount}
        </span>
        <button
          className="btn ghost"
          style={{ height: 30, fontSize: 12 }}
          disabled={page >= pageCount - 1 || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const [view, setView] = useState<View>("feed");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function loadPage(nextPage = page) {
    setListLoading(true);
    try {
      const data = await api.interactionsPage({ page: nextPage + 1, limit: PAGE_SIZE });
      setInteractions(data.items);
      setTotal(data.total);
      setPage(nextPage);
      setInitialized(true);
    } catch {
      setUnreachable(true);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadPage(0);
    api.people().then(setPeople).catch(() => {});
  }, []);

  async function handleSave(id: number, data: InteractionUpdate): Promise<Interaction> {
    const updated = await api.updateInteraction(id, data);
    setInteractions((prev) => prev.map((ix) => (ix.id === id ? updated : ix)));
    setEditingId(null);
    return updated;
  }

  async function handleDelete(id: number) {
    await api.deleteInteraction(id);
    setConfirmDeleteId(null);
    if (interactions.length === 1 && page > 0) {
      await loadPage(page - 1);
    } else {
      setInteractions((prev) => prev.filter((ix) => ix.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    }
  }

  if (unreachable) return (
    <>
      <div className="page-header"><h1 className="page-title">The <em>timeline.</em></h1></div>
      <p style={{ color: "var(--fg-mute)" }}>Cannot reach the API.</p>
    </>
  );

  if (!initialized) return <div className="page-header"><h1 className="page-title">The <em>timeline.</em></h1></div>;

  const sorted = [...interactions].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Timeline</div>
          <h1 className="page-title">The <em>timeline.</em></h1>
          <p className="page-sub">{total} interaction{total === 1 ? "" : "s"} logged.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="view-switcher">
            {VIEWS.map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={view === v ? "btn primary" : "btn ghost"}
                style={{ height: 32, padding: "0 12px", fontSize: 12, borderRadius: 0, border: "none", textTransform: "capitalize" }}>
                {v}
              </button>
            ))}
          </div>
          <Link href="/capture" className="btn primary">+ Capture</Link>
        </div>
      </div>

      {total === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>Nothing captured yet.</p>
          <Link href="/capture" className="btn primary">Log your first interaction</Link>
        </div>
      ) : view === "feed" ? (
        <>
          <div className="tl-feed" style={{ opacity: listLoading ? 0.5 : 1 }}>
            {sorted.map((ix) => (
              <InteractionRow key={ix.id} ix={ix} editingId={editingId} confirmDeleteId={confirmDeleteId}
                setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
                onSave={handleSave} onDelete={handleDelete} showDate people={people} />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <TimelinePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              loading={listLoading}
              onPageChange={loadPage}
            />
          )}
        </>
      ) : view === "diary" ? (
        <>
          <div style={{ opacity: listLoading ? 0.5 : 1 }}>
            <DiaryView interactions={sorted} editingId={editingId} confirmDeleteId={confirmDeleteId}
              setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
              onSave={handleSave} onDelete={handleDelete} people={people} />
          </div>
          {total > PAGE_SIZE && (
            <TimelinePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              loading={listLoading}
              onPageChange={loadPage}
            />
          )}
        </>
      ) : view === "terminal" ? (
        <>
          <div style={{ opacity: listLoading ? 0.5 : 1 }}>
            <TerminalView interactions={sorted} onDelete={handleDelete} />
          </div>
          {total > PAGE_SIZE && (
            <TimelinePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              loading={listLoading}
              onPageChange={loadPage}
            />
          )}
        </>
      ) : (
        <CalendarView editingId={editingId} confirmDeleteId={confirmDeleteId}
          setEditingId={setEditingId} setConfirmDeleteId={setConfirmDeleteId}
          onSave={handleSave} onDelete={handleDelete} people={people} />
      )}
    </>
  );
}
