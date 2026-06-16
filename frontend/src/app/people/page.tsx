"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type Person, type PersonUpdate, type RelationshipDefaults } from "@/lib/api";
import {
  FALLBACK_DEFAULTS,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from "@/lib/relationships";

interface PersonRow {
  id: number;
  name: string;
  relationship: string | null;
  notes: string | null;
  interaction_count: number;
  last_interaction_at: string | null;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Cards view ─────────────────────────────────────────────────────────────

function PersonCard({ person, editing, confirmDelete, onEdit, onCancelEdit, onSave, onDelete, onConfirmDelete, onCancelDelete, relationshipTypes, relationshipLabels }: {
  person: PersonRow;
  editing: boolean;
  confirmDelete: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: PersonUpdate) => Promise<void>;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  relationshipTypes: readonly string[];
  relationshipLabels: Record<string, string>;
}) {
  const [name, setName] = useState(person.name);
  const [relationship, setRelationship] = useState(person.relationship ?? "");
  const [notes, setNotes] = useState(person.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true); setErr(null);
    try {
      await onSave({ name: name.trim(), relationship: relationship || null, notes: notes.trim() || null });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="person-card">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Name" autoFocus style={{ fontSize: 13 }} />
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="select" style={{ fontSize: 13 }}>
            <option value="">— relationship —</option>
            {relationshipTypes.map((r) => <option key={r} value={r}>{relationshipLabels[r] ?? r}</option>)}
          </select>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="textarea" placeholder="Notes" style={{ minHeight: 56, fontSize: 13 }} />
          {err && <p style={{ color: "var(--danger)", fontSize: 12 }}>{err}</p>}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={save} disabled={saving || !name.trim()} className="btn primary" style={{ height: 28, fontSize: 12, flex: 1 }}>{saving ? "…" : "Save"}</button>
            <button onClick={onCancelEdit} className="btn ghost" style={{ height: 28, fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="person-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="avatar big">{initials(person.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p-name">{person.name}</div>
          {person.relationship && <div className="p-rel">{person.relationship}</div>}
        </div>
      </div>
      {person.notes && (
        <div className="p-notes" style={{ overflow: "hidden" }}>
          {person.notes.length > 100 ? person.notes.slice(0, 100) + "…" : person.notes}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="p-count">{person.interaction_count} interaction{person.interaction_count === 1 ? "" : "s"}</div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>last {relativeTime(person.last_interaction_at)}</div>
        </div>
        <div className="tl-actions" style={{ flexDirection: "row", marginTop: 0 }}>
          {confirmDelete ? (
            <>
              <span style={{ fontSize: 11, color: "var(--fg-mute)" }}>Sure?</span>
              <button onClick={onDelete} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Yes</button>
              <button onClick={onCancelDelete} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>No</button>
            </>
          ) : (
            <>
              <button onClick={onEdit} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>Edit</button>
              <button onClick={onConfirmDelete} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Delete</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Table view ─────────────────────────────────────────────────────────────

function TableView({ people, onEdit, onDelete }: {
  people: PersonRow[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmId, setConfirmId] = useState<number | null>(null);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--line)" }}>
            {["Name", "Relationship", "Last contact", "Interactions", "Notes"].map((h) => (
              <th key={h} style={{ textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", fontWeight: 500, padding: "8px 12px 8px 0" }}>{h}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} style={{ borderBottom: "0.5px solid var(--line-soft)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-alt)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={{ padding: "10px 12px 10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="avatar" style={{ width: 26, height: 26, fontSize: 9 }}>{initials(p.name)}</div>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                </div>
              </td>
              <td style={{ padding: "10px 12px 10px 0", color: "var(--fg-mute)" }}>{p.relationship ?? "—"}</td>
              <td style={{ padding: "10px 12px 10px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>{relativeTime(p.last_interaction_at)}</td>
              <td style={{ padding: "10px 12px 10px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-mute)" }}>{p.interaction_count}</td>
              <td style={{ padding: "10px 12px 10px 0", color: "var(--fg-mute)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.notes ?? "—"}</td>
              <td style={{ padding: "10px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                {confirmId === p.id ? (
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--fg-mute)" }}>Sure?</span>
                    <button onClick={() => { onDelete(p.id); setConfirmId(null); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Yes</button>
                    <button onClick={() => setConfirmId(null)} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>No</button>
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    <button onClick={() => onEdit(p.id)} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>Edit</button>
                    <button onClick={() => setConfirmId(p.id)} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Delete</button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Constellation view ─────────────────────────────────────────────────────

function ConstellationView({ people }: { people: PersonRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 560, H = 520, cx = W / 2, cy = H / 2;
  const now = Date.now();

  function daysSince(iso: string | null): number {
    if (!iso) return 999;
    return Math.floor((now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  }

  function ringIndex(days: number): 0 | 1 | 2 | 3 {
    if (days < 7) return 0;
    if (days < 30) return 1;
    if (days < 90) return 2;
    return 3;
  }

  const RADII = [80, 150, 210, 255];
  const RING_LABELS = ["< 1 week", "< 1 month", "< 3 months", "3+ months"];

  const byRing: PersonRow[][] = [[], [], [], []];
  for (const p of people) {
    byRing[ringIndex(daysSince(p.last_interaction_at))].push(p);
  }

  const nodes = byRing.flatMap((ring, ri) =>
    ring.map((person, i) => {
      const total = ring.length || 1;
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      const r = RADII[ri];
      return { person, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), ri };
    })
  );

  return (
    <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
      <svg width={W} height={H} style={{ maxWidth: "100%" }}>
        {RADII.map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={0.5} />
        ))}
        {RING_LABELS.map((label, i) => (
          <text key={i} x={cx + 4} y={cy - RADII[i] + 11} fill="var(--fg-faint)" fontSize={8} fontFamily="var(--font-mono)">{label}</text>
        ))}
        <circle cx={cx} cy={cy} r={14} fill="var(--accent)" />
        <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--bg)" fontSize={8} fontFamily="var(--font-mono)" fontWeight={600}>you</text>
        {nodes.map(({ person, x, y }) => {
          const isHovered = hovered === person.id;
          return (
            <g key={person.id}
              onMouseEnter={() => setHovered(person.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              <circle cx={x} cy={y} r={18} fill={isHovered ? "var(--accent-soft)" : "var(--panel)"} stroke={isHovered ? "var(--accent)" : "var(--line)"} strokeWidth={isHovered ? 1.5 : 0.5} />
              <text x={x} y={y + 4} textAnchor="middle" fill="var(--accent)" fontSize={8} fontFamily="var(--font-mono)" fontWeight={600}>{initials(person.name)}</text>
              {isHovered && (
                <g>
                  <rect x={x - 40} y={y + 22} width={80} height={28} rx={3} fill="var(--panel)" stroke="var(--line)" strokeWidth={0.5} />
                  <text x={x} y={y + 33} textAnchor="middle" fill="var(--fg)" fontSize={10} fontFamily="var(--font-sans)" fontWeight={500}>{person.name}</text>
                  <text x={x} y={y + 44} textAnchor="middle" fill="var(--fg-faint)" fontSize={8} fontFamily="var(--font-mono)">{relativeTime(person.last_interaction_at)}</text>
                </g>
              )}
              {!isHovered && (
                <text x={x} y={y + 30} textAnchor="middle" fill="var(--fg-mute)" fontSize={9} fontFamily="var(--font-sans)">{person.name.split(" ")[0]}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type PeopleView = "cards" | "table" | "constellation";
const PEOPLE_VIEWS: PeopleView[] = ["cards", "table", "constellation"];
const PAGE_SIZE = 24;

function PeoplePagination({
  page,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, fontSize: 13 }}>
      <span style={{ fontFamily: "var(--font-serif)", color: "var(--fg-mute)" }}>
        {rangeStart}–{rangeEnd} of {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn ghost" style={{ height: 30, fontSize: 12 }} disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontSize: 12 }}>
          {page + 1} / {pageCount}
        </span>
        <button className="btn ghost" style={{ height: 30, fontSize: 12 }} disabled={page >= pageCount - 1 || loading} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [constellationPeople, setConstellationPeople] = useState<PersonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [defaults, setDefaults] = useState<RelationshipDefaults | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<RelationshipType>("colleague");
  const [notes, setNotes] = useState("");
  const [notesTouched, setNotesTouched] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [confirmDeletePersonId, setConfirmDeletePersonId] = useState<number | null>(null);
  const [view, setView] = useState<PeopleView>("cards");

  function applyRelationshipDefault(rel: RelationshipType, source: RelationshipDefaults | null) {
    const fromApi = source?.defaults[rel]?.notes;
    const fallback = FALLBACK_DEFAULTS[rel].notes;
    setNotes(fromApi ?? fallback);
    setNotesTouched(false);
  }

  async function loadPage(nextPage = page) {
    setListLoading(true);
    try {
      const data = await api.peoplePage({ page: nextPage + 1, limit: PAGE_SIZE });
      setPeople(data.items as PersonRow[]);
      setTotal(data.total);
      setPage(nextPage);
    } catch {
      setPeople([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }

  async function loadDefaults() {
    try {
      const defaultsData = await api.relationshipDefaults();
      setDefaults(defaultsData);
      if (!notesTouched) applyRelationshipDefault(relationship, defaultsData);
    } catch {
      setDefaults(null);
    }
  }

  async function loadConstellation() {
    try {
      const all = await api.people();
      setConstellationPeople(all as PersonRow[]);
    } catch {
      setConstellationPeople([]);
    }
  }

  useEffect(() => {
    loadPage(0);
    loadDefaults();
  }, []);

  useEffect(() => {
    if (view === "constellation") loadConstellation();
  }, [view]);

  function onRelationshipChange(rel: RelationshipType) {
    setRelationship(rel);
    if (!notesTouched) applyRelationshipDefault(rel, defaults);
  }

  async function handleDeletePerson(id: number) {
    await api.deletePerson(id);
    if (people.length === 1 && page > 0) {
      await loadPage(page - 1);
    } else {
      setPeople((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    }
    setConstellationPeople((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeletePersonId(null);
  }

  async function handleUpdatePerson(id: number, data: PersonUpdate) {
    const updated = await api.updatePerson(id, data);
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    setEditingPersonId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createPerson({ name: name.trim(), relationship, notes: notes.trim() || undefined });
      setName("");
      setRelationship("colleague");
      setNotesTouched(false);
      setShowForm(false);
      applyRelationshipDefault("colleague", defaults);
      await loadPage(page);
      if (view === "constellation") await loadConstellation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>People</div>
          <h1 className="page-title">The <em>people.</em></h1>
          <p className="page-sub">
            {total} person{total === 1 ? "" : "s"} tracked.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="view-switcher">
            {PEOPLE_VIEWS.map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={view === v ? "btn primary" : "btn ghost"}
                style={{ height: 32, padding: "0 12px", fontSize: 12, borderRadius: 0, border: "none", textTransform: "capitalize" }}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn primary">
            {showForm ? "cancel" : "+ Add person"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "var(--pad-6)", maxWidth: 500 }}>
          <div className="kicker" style={{ marginBottom: 14 }}>New person</div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <div className="field-label">Name</div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required autoFocus className="input" />
            </div>
            <div className="field">
              <div className="field-label">Relationship</div>
              <select value={relationship} onChange={(e) => onRelationshipChange(e.target.value as RelationshipType)} className="select">
                {RELATIONSHIP_TYPES.map((rel) => (
                  <option key={rel} value={rel}>{RELATIONSHIP_LABELS[rel]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="field-label">Notes</div>
              <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setNotesTouched(true); }} placeholder="Context about this person" rows={2} className="textarea" style={{ minHeight: 60 }} />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={submitting || !name.trim()} className="btn primary">
              {submitting ? "Adding…" : "Add person"}
            </button>
          </form>
        </div>
      )}

      {listLoading && view !== "constellation" ? (
        <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Loading…</p>
      ) : total === 0 && view !== "constellation" ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>No people yet.</p>
          <button onClick={() => setShowForm(true)} className="btn primary">Add your first person</button>
        </div>
      ) : view === "cards" ? (
        <>
          <div className="people-grid" style={{ opacity: listLoading ? 0.5 : 1 }}>
            {people.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                editing={editingPersonId === person.id}
                confirmDelete={confirmDeletePersonId === person.id}
                onEdit={() => { setEditingPersonId(person.id); setConfirmDeletePersonId(null); }}
                onCancelEdit={() => setEditingPersonId(null)}
                onSave={(data) => handleUpdatePerson(person.id, data)}
                onDelete={() => handleDeletePerson(person.id)}
                onConfirmDelete={() => { setConfirmDeletePersonId(person.id); setEditingPersonId(null); }}
                onCancelDelete={() => setConfirmDeletePersonId(null)}
                relationshipTypes={RELATIONSHIP_TYPES}
                relationshipLabels={RELATIONSHIP_LABELS}
              />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <PeoplePagination page={page} total={total} loading={listLoading} onPageChange={loadPage} />
          )}
        </>
      ) : view === "table" ? (
        <>
          <div style={{ opacity: listLoading ? 0.5 : 1 }}>
            <TableView
              people={people}
              onEdit={(id) => { setEditingPersonId(id); setView("cards"); }}
              onDelete={handleDeletePerson}
            />
          </div>
          {total > PAGE_SIZE && (
            <PeoplePagination page={page} total={total} loading={listLoading} onPageChange={loadPage} />
          )}
        </>
      ) : constellationPeople.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>No people yet.</p>
          <button onClick={() => setShowForm(true)} className="btn primary">Add your first person</button>
        </div>
      ) : (
        <ConstellationView people={constellationPeople} />
      )}
    </>
  );
}
