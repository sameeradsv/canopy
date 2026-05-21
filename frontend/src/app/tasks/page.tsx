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
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dimensions, setDimensions] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  function loadTasks() {
    return api.tasks().then(setTasks).catch(() => setError("Cannot load tasks."));
  }

  useEffect(() => { loadTasks().finally(() => setLoading(false)); }, []);

  function setDimension(key: DimensionKey, raw: number) {
    setDimensions((prev) => ({ ...prev, [key]: raw / 100 }));
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDimensions(task.dimensions);
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDimensions({});
    setShowForm(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId != null) {
        await api.updateTask(editingId, { title: title.trim(), description: description.trim() || null, dimensions });
      } else {
        await api.createTask({ title: title.trim(), description: description.trim() || undefined, dimensions });
      }
      resetForm();
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const selectedTask = tasks.find((t) => t.id === selectedId);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Tasks · /tasks</div>
          <h1 className="page-title">What to do, and <em>why.</em></h1>
          <p className="page-sub">Each task is scored across dimensions so you know what to prioritize.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn primary">
          {showForm && editingId == null ? "cancel" : "+ New task"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "var(--pad-6)" }}>
          <div className="kicker" style={{ marginBottom: 14 }}>
            {editingId != null ? "Edit task" : "New task"}
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <div className="field-label">Title</div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                placeholder="e.g. Finish onboarding docs"
                className="input"
              />
            </div>
            <div className="field">
              <div className="field-label">Description</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional context"
                className="textarea"
                style={{ minHeight: 60 }}
              />
            </div>

            <div>
              <div className="kicker" style={{ marginBottom: 10 }}>Dimensions</div>
              {DIMENSION_KEYS.map((key) => {
                const pct = dimensions[key] != null ? Math.round((dimensions[key] as number) * 100) : 50;
                return (
                  <div key={key} className="dim-row">
                    <div>
                      <div className="dim-label">{DIMENSION_LABELS[key]}</div>
                      <div className="dim-hint">{DIMENSION_HINTS[key]}</div>
                    </div>
                    <input
                      type="range" min={0} max={100} value={pct}
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
                );
              })}
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving || !title.trim()} className="btn primary">
                {saving ? "Saving…" : editingId != null ? "Update" : "Add task"}
              </button>
              <button type="button" onClick={resetForm} className="btn ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selectedTask ? "1fr 340px" : "1fr", gap: 20 }}>
        {/* Task list */}
        <div>
          {loading ? (
            <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Loading…</p>
          ) : tasks.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>No tasks yet.</p>
              <button onClick={() => setShowForm(true)} className="btn primary">Add your first task</button>
            </div>
          ) : (
            <div style={{ border: "0.5px solid var(--line)", borderRadius: "var(--r-5)", overflow: "hidden" }}>
              {tasks.map((task, idx) => {
                const dimKeys = DIMENSION_KEYS.filter((k) => task.dimensions[k] != null);
                const isSelected = task.id === selectedId;
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedId(isSelected ? null : task.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1fr auto auto auto",
                      alignItems: "center",
                      gap: 16,
                      padding: "14px 16px",
                      borderBottom: idx < tasks.length - 1 ? "0.5px solid var(--line-soft)" : "none",
                      background: isSelected ? "var(--accent-soft)" : "var(--panel)",
                      cursor: "default",
                      transition: "background 0.08s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "var(--panel-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "var(--panel)";
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", textAlign: "right" }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{task.title}</div>
                      {task.description && (
                        <div style={{ fontSize: 12, color: "var(--fg-mute)", marginTop: 2 }}>{task.description}</div>
                      )}
                    </div>
                    {dimKeys.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, width: 80 }}>
                        {dimKeys.slice(0, 4).map((k) => (
                          <div key={k} className="bar">
                            <i style={{ width: `${Math.round((task.dimensions[k] as number) * 100)}%` }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                      className="btn ghost"
                      style={{ height: 26, padding: "0 8px", fontSize: 11 }}
                    >
                      edit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTask && (
          <div className="card" style={{ alignSelf: "start", position: "sticky", top: 0 }}>
            <div className="kicker" style={{ marginBottom: 4 }}>Selected</div>
            <h3 style={{ marginBottom: 16, lineHeight: 1.3 }}>{selectedTask.title}</h3>
            {selectedTask.description && (
              <p style={{ fontSize: 13, color: "var(--fg-mute)", marginBottom: 16 }}>{selectedTask.description}</p>
            )}
            <div className="kicker" style={{ marginBottom: 10 }}>Dimensions</div>
            {DIMENSION_KEYS.map((key) => {
              const val = selectedTask.dimensions[key];
              const pct = val != null ? Math.round(val * 100) : 0;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "0.5px solid var(--line-soft)" }}>
                  <div style={{ flex: 1, fontSize: 13 }}>{DIMENSION_LABELS[key]}</div>
                  <div style={{ width: 60 }}>
                    <div className="bar">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-mute)", width: 26, textAlign: "right" }}>
                    {val != null ? pct : "—"}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => startEdit(selectedTask)}
              className="btn"
              style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
            >
              Edit task
            </button>
          </div>
        )}
      </div>
    </>
  );
}
