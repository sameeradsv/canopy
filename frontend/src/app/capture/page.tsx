"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, type Person } from "@/lib/api";

export default function CapturePage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [observation, setObservation] = useState("");
  const [context, setContext] = useState("");
  const [outcome, setOutcome] = useState("");
  const [confidence, setConfidence] = useState(0.7);
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.people().then(setPeople).catch(() => setPeople([]));
  }, []);

  function toggleParticipant(id: number) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!observation.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const tag_names = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await api.createInteraction({
        observation: observation.trim(),
        context: context.trim() || undefined,
        outcome: outcome.trim() || undefined,
        confidence,
        participant_ids: participantIds,
        tag_names,
      });
      router.push("/timeline");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">Quick capture</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Under 30 seconds — observation is all you need.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Observation" required>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            required
            rows={3}
            autoFocus
            placeholder="What happened or what did you notice?"
            className={inputClass}
          />
        </Field>

        <Field label="Context">
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Where, when, setting"
            className={inputClass}
          />
        </Field>

        <Field label="Outcome">
          <input
            type="text"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Result or follow-up"
            className={inputClass}
          />
        </Field>

        <Field label={`Confidence — ${Math.round(confidence * 100)}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(confidence * 100)}
            onChange={(e) => setConfidence(Number(e.target.value) / 100)}
            className="w-full accent-canopy-accent"
          />
        </Field>

        {people.length > 0 && (
          <Field label="Participants">
            <div className="flex flex-wrap gap-2">
              {people.map((person) => {
                const selected = participantIds.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggleParticipant(person.id)}
                    className={`rounded border px-3 py-1 text-sm transition-colors ${
                      selected
                        ? "border-canopy-accent bg-canopy-accentDim/40 text-canopy-text"
                        : "border-canopy-border text-canopy-muted hover:border-canopy-muted"
                    }`}
                  >
                    {person.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Tags">
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="work, follow-up (comma-separated)"
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !observation.trim()}
          className="w-full rounded-lg bg-canopy-accent px-4 py-2.5 text-sm font-medium text-canopy-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save interaction"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-canopy-muted">
        {label}
        {required && <span className="text-canopy-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-canopy-border bg-canopy-surface px-3 py-2 text-sm text-canopy-text placeholder:text-canopy-muted/60 focus:border-canopy-accent focus:outline-none";
