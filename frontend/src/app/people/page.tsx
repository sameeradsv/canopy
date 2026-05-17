"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type RelationshipDefaults } from "@/lib/api";
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
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [defaults, setDefaults] = useState<RelationshipDefaults | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<RelationshipType>("colleague");
  const [notes, setNotes] = useState("");
  const [notesTouched, setNotesTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyRelationshipDefault(
    rel: RelationshipType,
    source: RelationshipDefaults | null
  ) {
    const fromApi = source?.defaults[rel]?.notes;
    const fallback = FALLBACK_DEFAULTS[rel].notes;
    setNotes(fromApi ?? fallback);
    setNotesTouched(false);
  }

  async function load() {
    try {
      const [peopleData, defaultsData] = await Promise.all([
        api.people(),
        api.relationshipDefaults().catch(() => null),
      ]);
      setPeople(peopleData);
      setDefaults(defaultsData);
      if (!notesTouched) applyRelationshipDefault(relationship, defaultsData);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onRelationshipChange(rel: RelationshipType) {
    setRelationship(rel);
    if (!notesTouched) applyRelationshipDefault(rel, defaults);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.createPerson({
        name: name.trim(),
        relationship,
        notes: notes.trim() || undefined,
      });
      setName("");
      setRelationship("colleague");
      setNotesTouched(false);
      applyRelationshipDefault("colleague", defaults);
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
          Entities you interact with — choose a relationship for contextual
          defaults you can edit.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="panel space-y-3 p-4">
        <h2 className="text-sm font-medium text-canopy-muted">Add person</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className={inputClass}
        />
        <select
          value={relationship}
          onChange={(e) => onRelationshipChange(e.target.value as RelationshipType)}
          className={inputClass}
        >
          {RELATIONSHIP_TYPES.map((rel) => (
            <option key={rel} value={rel}>
              {RELATIONSHIP_LABELS[rel]}
            </option>
          ))}
        </select>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesTouched(true);
          }}
          placeholder="Notes (prefilled from relationship — edit freely)"
          rows={2}
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
        <ul className="panel divide-y divide-canopy-border">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-medium text-canopy-text">{person.name}</p>
                {person.relationship && (
                  <p className="mt-0.5 text-xs capitalize text-canopy-accent">
                    {person.relationship}
                  </p>
                )}
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
