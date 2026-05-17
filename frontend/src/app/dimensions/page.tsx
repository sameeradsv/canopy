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
      .catch(() => setError("Cannot load dimensions. Is the backend running?"))
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
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">Dimensions</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Global default lenses for tasks — saved locally. Per-task values are
          set on the Tasks page. Adjust when they help you think; leave unset
          when they do not.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-canopy-muted">Loading…</p>
      ) : (
        <div className="panel space-y-6 p-5">
          {DIMENSION_KEYS.map((key) => {
            const pct =
              values[key] != null ? Math.round((values[key] as number) * 100) : 50;
            return (
              <label key={key} className="block space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-canopy-text">
                    {DIMENSION_LABELS[key]}
                  </span>
                  <span className="text-xs text-canopy-muted">
                    {values[key] != null ? `${pct}%` : "unset"}
                  </span>
                </div>
                <p className="text-xs text-canopy-muted">{DIMENSION_HINTS[key]}</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) => setDimension(key, Number(e.target.value))}
                  className="w-full accent-canopy-accent"
                />
              </label>
            );
          })}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {saved && !error && (
            <p className="text-sm text-canopy-accent">Saved to local database.</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-canopy-accent px-4 py-2 text-sm font-medium text-canopy-bg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save dimensions"}
          </button>
        </div>
      )}
    </div>
  );
}
