"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  DIMENSION_HINTS,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type DimensionKey,
} from "@/lib/dimensions";

export default function DimensionsPage() {
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dimensions()
      .then((data) => setValues(data.values))
      .catch(() => setError("Cannot load dimensions."))
      .finally(() => setLoading(false));
  }, []);

  function setDimension(key: DimensionKey, raw: number) {
    setValues((prev) => ({ ...prev, [key]: raw / 100 }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await api.saveDimensions({ values });
      setValues(result.values);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Dimensions · /dimensions</div>
          <h1 className="page-title">Score with <em>intent.</em></h1>
          <p className="page-sub">
            Global default weights for tasks — each dimension gives you a lens to prioritize differently.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="btn primary"
        >
          {saving ? "Saving…" : "Save defaults"}
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Loading…</p>
      ) : (
        <div className="card">
          <div className="kicker" style={{ marginBottom: 18 }}>Default dimension weights</div>

          {DIMENSION_KEYS.map((key) => {
            const pct = values[key] != null ? Math.round((values[key] as number) * 100) : 50;
            return (
              <div key={key} style={{ marginBottom: 24 }}>
                <div className="dim-row">
                  <div>
                    <div className="dim-label">{DIMENSION_LABELS[key]}</div>
                    <div className="dim-hint">{DIMENSION_HINTS[key]}</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={pct}
                    onChange={(e) => setDimension(key, Number(e.target.value))}
                    className="slider"
                    style={{
                      backgroundImage: `linear-gradient(var(--accent), var(--accent))`,
                      backgroundSize: `${pct}% 100%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                  <div className="dim-val">{pct}</div>
                </div>
                <hr className="divider" />
              </div>
            );
          })}

          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {saved && !error && (
            <p style={{ color: "var(--good)", fontSize: 13, marginBottom: 12 }}>Saved to local database.</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn primary"
          >
            {saving ? "Saving…" : "Save dimensions"}
          </button>
        </div>
      )}
    </>
  );
}
