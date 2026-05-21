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

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [defaults, setDefaults] = useState<RelationshipDefaults | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<RelationshipType>("colleague");
  const [notes, setNotes] = useState("");
  const [notesTouched, setNotesTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyRelationshipDefault(rel: RelationshipType, source: RelationshipDefaults | null) {
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
      await api.createPerson({ name: name.trim(), relationship, notes: notes.trim() || undefined });
      setName("");
      setRelationship("colleague");
      setNotesTouched(false);
      setShowForm(false);
      applyRelationshipDefault("colleague", defaults);
      await load();
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
          <div className="kicker" style={{ marginBottom: 10 }}>People · /people</div>
          <h1 className="page-title">The <em>people.</em></h1>
          <p className="page-sub">Everyone you interact with — with context and history.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn primary">
          {showForm ? "cancel" : "+ Add person"}
        </button>
      </div>

      {/* Add person form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "var(--pad-6)", maxWidth: 500 }}>
          <div className="kicker" style={{ marginBottom: 14 }}>New person</div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <div className="field-label">Name</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                autoFocus
                className="input"
              />
            </div>
            <div className="field">
              <div className="field-label">Relationship</div>
              <select
                value={relationship}
                onChange={(e) => onRelationshipChange(e.target.value as RelationshipType)}
                className="select"
              >
                {RELATIONSHIP_TYPES.map((rel) => (
                  <option key={rel} value={rel}>{RELATIONSHIP_LABELS[rel]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="field-label">Notes</div>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesTouched(true); }}
                placeholder="Context about this person"
                rows={2}
                className="textarea"
                style={{ minHeight: 60 }}
              />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn primary"
            >
              {submitting ? "Adding…" : "Add person"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Loading…</p>
      ) : people.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "var(--fg-mute)", marginBottom: 16 }}>No people yet.</p>
          <button onClick={() => setShowForm(true)} className="btn primary">Add your first person</button>
        </div>
      ) : (
        <div className="people-grid">
          {people.map((person) => (
            <div key={person.id} className="person-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar big">{initials(person.name)}</div>
                <div>
                  <div className="p-name">{person.name}</div>
                  {person.relationship && (
                    <div className="p-rel">{person.relationship}</div>
                  )}
                </div>
              </div>
              {person.notes && (
                <div className="p-notes" style={{ lineClamp: 2, overflow: "hidden" }}>
                  {person.notes.length > 100 ? person.notes.slice(0, 100) + "…" : person.notes}
                </div>
              )}
              <div className="p-count">
                {person.interaction_count} interaction{person.interaction_count === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
