"use client";

import { useEffect, useState } from "react";
import { api, type Preset } from "@/lib/api";
import { DIMENSION_KEYS, DIMENSION_LABELS, DIMENSION_DESC } from "@/lib/dimensions";

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Dimension bar ──────────────────────────────────────────────────────────

function DimBar({ label, desc, value, onChange }: {
  label: string;
  desc?: string;
  value: number | null;
  onChange?: (v: number) => void;
}) {
  const pct = value !== null ? Math.round(value * 100) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
          {desc && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--fg-faint)" }}>{desc}</span>}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", minWidth: 36, textAlign: "right" }}>
          {pct !== null ? `${pct}%` : "—"}
        </span>
      </div>
      {onChange ? (
        <input
          type="range" min={0} max={100} value={pct ?? 50}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="slider"
          style={{ backgroundImage: `linear-gradient(var(--accent), var(--accent))`, backgroundSize: `${pct ?? 50}% 100%`, backgroundRepeat: "no-repeat" }}
        />
      ) : (
        <div style={{ height: 4, borderRadius: 2, background: "var(--line-soft)", position: "relative" }}>
          {pct !== null && (
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 2 }} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Preset card ────────────────────────────────────────────────────────────

function PresetCard({ preset, selected, onSelect, onDelete }: {
  preset: Preset;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeDims = Object.entries(preset.dims).filter(([, v]) => v !== null);

  return (
    <div
      className="card"
      style={{ cursor: "default", border: selected ? "1.5px solid var(--accent)" : undefined, background: selected ? "var(--accent-soft)" : undefined }}
      onClick={onSelect}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{preset.name}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {confirmDelete ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>Yes</button>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11 }}>No</button>
            </>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="btn ghost" style={{ height: 22, padding: "0 8px", fontSize: 11, color: "var(--danger)" }}>×</button>
          )}
        </div>
      </div>
      {preset.note && <div style={{ fontSize: 12, color: "var(--fg-mute)", marginBottom: 8 }}>{preset.note}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {activeDims.map(([k]) => (
          <span key={k} className="tag">{DIMENSION_LABELS[k] ?? k}</span>
        ))}
        {activeDims.length === 0 && <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>No dimensions set</span>}
      </div>
      {preset.use > 0 && (
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", marginTop: 8 }}>used {preset.use}×</div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DimensionsPage() {
  const [dimValues, setDimValues] = useState<Record<string, number | null>>({});
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPresets, setSavingPresets] = useState(false);

  // New preset form
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDims, setNewDims] = useState<Record<string, number | null>>(
    Object.fromEntries(DIMENSION_KEYS.map((k) => [k, null]))
  );

  useEffect(() => {
    Promise.all([api.getDimensions(), api.getPresets()])
      .then(([dims, pData]) => {
        setDimValues(dims.values);
        setPresets(pData.presets);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveDimensions() {
    setSaving(true);
    try {
      const updated = await api.setDimensions(dimValues);
      setDimValues(updated.values);
    } finally {
      setSaving(false);
    }
  }

  async function savePresets(updated: Preset[]) {
    setSavingPresets(true);
    try {
      const res = await api.setPresets(updated);
      setPresets(res.presets);
    } finally {
      setSavingPresets(false);
    }
  }

  async function handleCreatePreset() {
    if (!newName.trim()) return;
    const preset: Preset = { id: genId(), name: newName.trim(), note: newNote.trim(), dims: newDims, use: 0 };
    const updated = [...presets, preset];
    await savePresets(updated);
    setShowNewPreset(false);
    setNewName("");
    setNewNote("");
    setNewDims(Object.fromEntries(DIMENSION_KEYS.map((k) => [k, null])));
  }

  async function handleDeletePreset(id: string) {
    const updated = presets.filter((p) => p.id !== id);
    await savePresets(updated);
    if (selectedPresetId === id) setSelectedPresetId(null);
  }

  const selectedPreset = presets.find((p) => p.id === selectedPresetId) ?? null;

  if (loading) return (
    <>
      <div className="page-header"><h1 className="page-title">The <em>dimensions.</em></h1></div>
      <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Loading…</p>
    </>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Dimensions</div>
          <h1 className="page-title">The <em>dimensions.</em></h1>
          <p className="page-sub">Six axes for evaluating decisions and interactions. Tune values and manage scoring presets.</p>
        </div>
      </div>

      {/* Current dimension values */}
      <div className="card" style={{ marginBottom: "var(--pad-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div className="kicker">Current values</div>
          <button onClick={saveDimensions} disabled={saving} className="btn primary" style={{ height: 28, padding: "0 14px", fontSize: 12 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {DIMENSION_KEYS.map((k) => (
            <DimBar
              key={k}
              label={DIMENSION_LABELS[k]}
              desc={DIMENSION_DESC[k]}
              value={dimValues[k] ?? null}
              onChange={(v) => setDimValues((prev) => ({ ...prev, [k]: v }))}
            />
          ))}
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="kicker">Presets</div>
        <button onClick={() => setShowNewPreset(!showNewPreset)} className="btn ghost" style={{ height: 28, padding: "0 12px", fontSize: 12 }}>
          {showNewPreset ? "cancel" : "+ New preset"}
        </button>
      </div>

      {showNewPreset && (
        <div className="card" style={{ marginBottom: "var(--pad-6)" }}>
          <div className="kicker" style={{ marginBottom: 14 }}>New preset</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <div className="field-label">Name</div>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" placeholder="e.g. Quick triage" autoFocus />
            </div>
            <div className="field">
              <div className="field-label">Note</div>
              <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} className="input" placeholder="Optional description" />
            </div>
            <div className="field">
              <div className="field-label">Dimensions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {DIMENSION_KEYS.map((k) => (
                  <DimBar
                    key={k}
                    label={DIMENSION_LABELS[k]}
                    value={newDims[k] ?? null}
                    onChange={(v) => setNewDims((prev) => ({ ...prev, [k]: v }))}
                  />
                ))}
              </div>
            </div>
            <button onClick={handleCreatePreset} disabled={savingPresets || !newName.trim()} className="btn primary" style={{ alignSelf: "flex-start" }}>
              {savingPresets ? "Saving…" : "Create preset"}
            </button>
          </div>
        </div>
      )}

      {presets.length === 0 && !showNewPreset ? (
        <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 12 }}>No presets yet.</p>
          <button onClick={() => setShowNewPreset(true)} className="btn ghost">Create your first preset</button>
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: "var(--pad-6)" }}>
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              selected={selectedPresetId === p.id}
              onSelect={() => setSelectedPresetId(selectedPresetId === p.id ? null : p.id)}
              onDelete={() => handleDeletePreset(p.id)}
            />
          ))}
        </div>
      )}

      {selectedPreset && (
        <div className="card" style={{ marginBottom: "var(--pad-6)" }}>
          <div className="kicker" style={{ marginBottom: 16 }}>Practice — {selectedPreset.name}</div>
          <p style={{ fontSize: 13, color: "var(--fg-mute)", marginBottom: 20 }}>
            Score a hypothetical decision using this preset&apos;s dimensions.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(selectedPreset.dims)
              .filter(([, v]) => v !== null)
              .map(([k]) => (
                <DimBar
                  key={k}
                  label={DIMENSION_LABELS[k] ?? k}
                  desc={DIMENSION_DESC[k]}
                  value={selectedPreset.dims[k] ?? null}
                />
              ))}
          </div>
        </div>
      )}
    </>
  );
}
