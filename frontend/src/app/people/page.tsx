"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type Person } from "@/lib/api";

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setPeople(await api.people());
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.createPerson({
        name: name.trim(),
        notes: notes.trim() || undefined,
      });
      setName("");
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">People</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Entities you interact with — linked to captures.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-canopy-border bg-canopy-surface p-4 space-y-3"
      >
        <h2 className="text-sm font-medium text-canopy-muted">Add person</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className={inputClass}
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className={inputClass}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded-lg bg-canopy-accent px-4 py-2 text-sm font-medium text-canopy-bg disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add person"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-canopy-muted">Loading…</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-canopy-muted">No people yet.</p>
      ) : (
        <ul className="divide-y divide-canopy-border rounded-lg border border-canopy-border">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-medium text-canopy-text">{person.name}</p>
                {person.notes && (
                  <p className="mt-0.5 text-sm text-canopy-muted">{person.notes}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-canopy-muted">
                {person.interaction_count} interaction
                {person.interaction_count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-canopy-border bg-canopy-bg px-3 py-2 text-sm text-canopy-text placeholder:text-canopy-muted/60 focus:border-canopy-accent focus:outline-none";
