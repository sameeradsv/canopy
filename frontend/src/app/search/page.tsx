"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { InteractionCard } from "@/components/InteractionCard";
import { api, type SearchResult } from "@/lib/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">Search</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Find interactions and people by keyword.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search observations, context, names…"
          className="flex-1 rounded-lg border border-canopy-border bg-canopy-surface px-3 py-2 text-sm text-canopy-text placeholder:text-canopy-muted/60 focus:border-canopy-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-canopy-accent px-4 py-2 text-sm font-medium text-canopy-bg disabled:opacity-50"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {results && (
        <div className="space-y-8">
          {results.people.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-canopy-muted">
                People ({results.people.length})
              </h2>
              <ul className="space-y-2">
                {results.people.map((person) => (
                  <li
                    key={person.id}
                    className="rounded-lg border border-canopy-border bg-canopy-surface px-4 py-3"
                  >
                    <p className="font-medium text-canopy-text">{person.name}</p>
                    {person.notes && (
                      <p className="mt-0.5 text-sm text-canopy-muted">{person.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.interactions.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-canopy-muted">
                Interactions ({results.interactions.length})
              </h2>
              <ul className="space-y-3">
                {results.interactions.map((interaction) => (
                  <li key={interaction.id}>
                    <InteractionCard interaction={interaction} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.people.length === 0 && results.interactions.length === 0 && (
            <p className="text-sm text-canopy-muted">
              No results for &ldquo;{results.query}&rdquo;.{" "}
              <Link href="/capture" className="text-canopy-accent">
                Capture something new
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
