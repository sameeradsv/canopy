"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, type SearchResult } from "@/lib/api";

type Scope = "all" | "people" | "interactions";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount (⌘K brings user here)
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function doSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(q.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    doSearch(query);
  }

  const people = results?.people ?? [];
  const interactions = results?.interactions ?? [];

  const filteredPeople = scope === "interactions" ? [] : people;
  const filteredInteractions = scope === "people" ? [] : interactions;
  const hasResults = filteredPeople.length > 0 || filteredInteractions.length > 0;

  return (
    <>
      <div className="page-header" style={{ marginBottom: "var(--pad-5)" }}>
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Search · /search</div>
          <h1 className="page-title">What are you <em>looking for?</em></h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="search-h">
          <span style={{ color: "var(--fg-faint)", fontSize: 16 }}>⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, interactions, notes…"
          />
          <span className="shot">⌘K</span>
          {loading && (
            <span style={{ color: "var(--fg-faint)", fontSize: 12, fontFamily: "var(--font-mono)" }}>…</span>
          )}
        </div>
      </form>

      {/* Facets */}
      {results && (
        <div className="search-facets">
          {(["all", "people", "interactions"] as Scope[]).map((s) => {
            const count = s === "all" ? people.length + interactions.length
              : s === "people" ? people.length : interactions.length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`facet ${scope === s ? "on" : ""}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <b>{count}</b>
              </button>
            );
          })}
        </div>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "16px 0" }}>{error}</p>}

      {results && !hasResults && (
        <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
          <p style={{ color: "var(--fg-mute)" }}>
            No results for &ldquo;{results.query}&rdquo;.
          </p>
        </div>
      )}

      {/* People results */}
      {filteredPeople.length > 0 && (
        <div style={{ marginBottom: "var(--pad-6)" }}>
          <div className="kicker" style={{ marginBottom: 12 }}>People · {filteredPeople.length}</div>
          <div style={{ border: "0.5px solid var(--line)", borderRadius: "var(--r-5)", overflow: "hidden" }}>
            {filteredPeople.map((person, idx) => (
              <div
                key={person.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: idx < filteredPeople.length - 1 ? "0.5px solid var(--line-soft)" : "none",
                  background: "var(--panel)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{person.name}</div>
                {person.relationship && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginTop: 2 }}>
                    {person.relationship}
                  </div>
                )}
                {person.notes && (
                  <div style={{ fontSize: 12.5, color: "var(--fg-mute)", marginTop: 4 }}>{person.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interaction results */}
      {filteredInteractions.length > 0 && (
        <div>
          <div className="kicker" style={{ marginBottom: 12 }}>Interactions · {filteredInteractions.length}</div>
          <div className="tl-feed">
            {filteredInteractions.map((ix) => {
              const d = new Date(ix.occurred_at);
              return (
                <div key={ix.id} className="tl-item">
                  <div className="tl-time">
                    {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div className="tl-body">
                    {ix.participants.length > 0 && (
                      <div className="who">
                        {ix.participants.map((p) => <b key={p.id}>{p.name}</b>)}
                      </div>
                    )}
                    <div className="note">{ix.observation}</div>
                    {ix.tags.length > 0 && (
                      <div className="tags">
                        {ix.tags.map((t) => <span key={t.id} className="tag">{t.name}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
