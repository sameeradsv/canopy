"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, type Person } from "@/lib/api";

const KINDS = [
  { id: "meeting",  label: "Meeting",  icon: "◧" },
  { id: "call",     label: "Call",     icon: "◌" },
  { id: "message",  label: "Message",  icon: "⌘" },
  { id: "meal",     label: "Meal",     icon: "◇" },
  { id: "walk",     label: "Walk",     icon: "⌒" },
  { id: "one-on-one", label: "1:1",   icon: "◉" },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function CapturePage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [observation, setObservation] = useState("");
  const [context, setContext] = useState("");
  const [confidence, setConfidence] = useState(0.7);
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>("meeting");
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

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!observation.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const tag_names = [
        selectedKind,
        ...tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      ];
      await api.createInteraction({
        observation: observation.trim(),
        context: context.trim() || undefined,
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

  // Cmd+Enter to submit
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  const confidencePct = Math.round(confidence * 100);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Capture · /capture</div>
          <h1 className="page-title">Log <em>an</em> interaction.</h1>
          <p className="page-sub">Write it down before the day moves on.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => router.back()} className="btn ghost">cancel</button>
          <button
            onClick={() => handleSubmit()}
            disabled={submitting || !observation.trim()}
            className="btn primary"
          >
            {submitting ? "Saving…" : "save interaction →"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={onKeyDown}>
        <div className="capture-grid">
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* With whom */}
            <div className="field">
              <div className="field-label">With whom</div>
              <div className="person-pick">
                {people.map((person) => {
                  const on = participantIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleParticipant(person.id)}
                      className={`chip ${on ? "on" : ""}`}
                    >
                      {!on && (
                        <span
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            background: "var(--accent-soft)", color: "var(--accent)",
                            display: "grid", placeItems: "center",
                            fontSize: 9, fontWeight: 600, flexShrink: 0,
                          }}
                        >
                          {initials(person.name)}
                        </span>
                      )}
                      {person.name}
                    </button>
                  );
                })}
                <span className="chip add">+ new person</span>
              </div>
            </div>

            {/* Kind */}
            <div className="field">
              <div className="field-label">Kind</div>
              <div className="kind-grid">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setSelectedKind(k.id)}
                    className={`kind-btn ${selectedKind === k.id ? "on" : ""}`}
                  >
                    <span style={{ fontSize: 16 }}>{k.icon}</span>
                    <b>{k.label}</b>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="field">
              <div className="field-label">Note</div>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                required
                autoFocus
                placeholder="What happened? What did you notice?"
                className="textarea"
                style={{ minHeight: 120 }}
              />
            </div>

            {/* Tags */}
            <div className="field">
              <div className="field-label">Tags</div>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="follow-up, work (comma-separated)"
                className="input"
              />
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* When */}
            <div className="field">
              <div className="field-label">When</div>
              <div
                className="input"
                style={{ color: "var(--fg-mute)", fontFamily: "var(--font-mono)", fontSize: 13 }}
              >
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short", month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>
            </div>

            {/* Context */}
            <div className="field">
              <div className="field-label">Context</div>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Where, setting, circumstance"
                className="input"
              />
            </div>

            {/* Confidence / energy */}
            <div className="field">
              <div className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Confidence</span>
                <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                  {confidencePct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={confidencePct}
                onChange={(e) => setConfidence(Number(e.target.value) / 100)}
                className="slider"
                style={{
                  backgroundImage: `linear-gradient(var(--accent), var(--accent))`,
                  backgroundSize: `${confidencePct}% 100%`,
                  backgroundRepeat: "no-repeat",
                }}
              />
            </div>

            {error && (
              <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !observation.trim()}
              className="btn primary"
              style={{ marginTop: "auto" }}
            >
              {submitting ? "Saving…" : "Save interaction →"}
            </button>
            <p style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "center" }}>
              or <span style={{ fontFamily: "var(--font-mono)" }}>⌘ Enter</span> from anywhere
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
