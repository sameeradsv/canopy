"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Interaction, type InteractionUpdate } from "@/lib/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditForm({
  ix,
  onSave,
  onCancel,
}: {
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
      <textarea
        value={observation}
        onChange={(e) => setObservation(e.target.value)}
        className="textarea"
        style={{ minHeight: 80 }}
        autoFocus
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="field">
          <div className="field-label">When</div>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="input"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
          />
        </div>
        <div className="field">
          <div className="field-label">Context</div>
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="input"
            placeholder="Where, setting…"
          />
        </div>
      </div>
      <div className="field">
        <div className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Confidence</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{pct}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => setConfidence(Number(e.target.value) / 100)}
          className="slider"
          style={{
            backgroundImage: `linear-gradient(var(--accent), var(--accent))`,
            backgroundSize: `${pct}% 100%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
      <div className="field">
        <div className="field-label">Tags</div>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="input"
          placeholder="comma-separated"
        />
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving || !observation.trim()} className="btn primary" style={{ height: 30, fontSize: 12 }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="btn ghost" style={{ height: 30, fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    api.interactions({ limit: 200 }).then(setInteractions).catch(() => setUnreachable(true));
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

  if (unreachable) {
    return (
      <>
        <div className="page-header"><h1 className="page-title">The <em>timeline.</em></h1></div>
        <p style={{ color: "var(--fg-mute)" }}>Cannot reach the API.</p>
      </>
    );
  }

  if (!interactions) {
    return <div className="page-header"><h1 className="page-title">The <em>timeline.</em></h1></div>;
  }

  const sorted = [...interactions].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Timeline</div>
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
            <div key={ix.id} className="tl-item" style={{ position: "relative" }}>
              <div className="tl-time">
                <div>{formatDate(ix.occurred_at)}</div>
                <div style={{ marginTop: 2, opacity: 0.7 }}>{formatTime(ix.occurred_at)}</div>
              </div>

              <div className="tl-body">
                {editingId === ix.id ? (
                  <EditForm
                    ix={ix}
                    onSave={(data) => handleSave(ix.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    {ix.participants.length > 0 && (
                      <div className="who">
                        {ix.participants.map((p) => <b key={p.id}>{p.name}</b>)}
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
                        {ix.tags.map((t) => <span key={t.id} className="tag">{t.name}</span>)}
                      </div>
                    )}
                    <div className="tl-actions">
                      {confirmDeleteId === ix.id ? (
                        <>
                          <span style={{ fontSize: 11, color: "var(--fg-mute)" }}>Delete?</span>
                          <button
                            onClick={() => handleDelete(ix.id)}
                            className="btn ghost"
                            style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="btn ghost"
                            style={{ height: 22, padding: "0 8px", fontSize: 11 }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(ix.id); setConfirmDeleteId(null); }}
                            className="btn ghost"
                            style={{ height: 22, padding: "0 8px", fontSize: 11 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteId(ix.id); setEditingId(null); }}
                            className="btn ghost"
                            style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
