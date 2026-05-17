"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type Task } from "@/lib/api";
import {
  DIMENSION_HINTS,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type DimensionKey,
} from "@/lib/dimensions";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dimensions, setDimensions] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  function loadTasks() {
    return api
      .tasks()
      .then(setTasks)
      .catch(() => setError("Cannot load tasks. Is the backend running?"));
  }

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));
  }, []);

  function setDimension(key: DimensionKey, raw: number) {
    setDimensions((prev) => ({ ...prev, [key]: raw / 100 }));
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDimensions(task.dimensions);
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDimensions({});
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);
    try {
      if (editingId != null) {
        await api.updateTask(editingId, {
          title: title.trim(),
          description: description.trim() || null,
          dimensions,
        });
      } else {
        await api.createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          dimensions,
        });
      }
      resetForm();
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">Tasks</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Responsibilities and recurring burdens — each with its own dimension
          profile. Global defaults live under Dimensions.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="panel space-y-5 p-5">
        <label className="block space-y-1.5">
          <span className="text-sm text-canopy-muted">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={inputClass}
            placeholder="e.g. Team onboarding docs"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-canopy-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Optional context"
          />
        </label>

        <div className="space-y-4">
          <p className="text-xs text-canopy-muted">Per-task dimensions (optional)</p>
          {DIMENSION_KEYS.map((key) => {
            const pct =
              dimensions[key] != null
                ? Math.round((dimensions[key] as number) * 100)
                : 50;
            return (
              <label key={key} className="block space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-canopy-text">{DIMENSION_LABELS[key]}</span>
                  <span className="text-xs text-canopy-muted">
                    {dimensions[key] != null ? `${pct}%` : "unset"}
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
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-lg bg-canopy-accent px-4 py-2 text-sm font-medium text-canopy-bg disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId != null ? "Update task" : "Add task"}
          </button>
          {editingId != null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-canopy-border px-4 py-2 text-sm text-canopy-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-canopy-muted">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-canopy-muted">No tasks yet.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id} className="panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium text-canopy-text">{task.title}</h2>
                  {task.description && (
                    <p className="mt-1 text-sm text-canopy-muted">{task.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(task)}
                  className="text-sm text-canopy-accent hover:underline"
                >
                  Edit
                </button>
              </div>
              <DimensionSummary dimensions={task.dimensions} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DimensionSummary({ dimensions }: { dimensions: Record<string, number | null> }) {
  const set = DIMENSION_KEYS.filter((k) => dimensions[k] != null);
  if (set.length === 0) return null;
  return (
    <p className="mt-2 text-xs text-canopy-muted">
      {set
        .map(
          (k) =>
            `${DIMENSION_LABELS[k as DimensionKey]} ${Math.round((dimensions[k] as number) * 100)}%`
        )
        .join(" · ")}
    </p>
  );
}

const inputClass =
  "w-full rounded-lg border border-canopy-border bg-canopy-surface px-3 py-2 text-sm text-canopy-text placeholder:text-canopy-muted/60 focus:border-canopy-accent focus:outline-none";