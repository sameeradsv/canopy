"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, type Person } from "@/lib/api";

const KINDS = [
  { id: "meeting",    label: "Meeting",  icon: "◧" },
  { id: "call",       label: "Call",     icon: "◌" },
  { id: "message",    label: "Message",  icon: "✉" },
  { id: "meal",       label: "Meal",     icon: "◇" },
  { id: "walk",       label: "Walk",     icon: "⌒" },
  { id: "one-on-one", label: "1:1",      icon: "◉" },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Tip({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{ cursor: "help", marginLeft: 4, opacity: 0.4, fontSize: 10, userSelect: "none" }}
    >
      ⓘ
    </span>
  );
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
  const [occurredAt, setOccurredAt] = useState(nowDatetimeLocal);
  const [energy, setEnergy] = useState(50);
  const [classifying, setClassifying] = useState(false);
  const [classifyReason, setClassifyReason] = useState<string | null>(null);
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

  async function handleClassify() {
    if (!observation.trim()) return;
    setClassifying(true);
    setClassifyReason(null);
    try {
      const result = await api.classifyInteraction({
        observation: observation.trim(),
        context: context.trim() || null,
        participant_ids: participantIds,
      });
      setEnergy(Math.round(result.energy * 100));
      setClassifyReason(result.reasoning);
    } catch {
      setClassifyReason("Classification unavailable — set manually.");
    } finally {
      setClassifying(false);
    }
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
        energy: energy / 100,
        participant_ids: participantIds,
        tag_names,
        occurred_at: new Date(occurredAt).toISOString(),
      });
      router.push("/timeline");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSubmitting(false);
    }
  }

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
          <div className="kicker" style={{ marginBottom: 10 }}>Capture</div>
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

            <div className="field">
              <div className="field-label">
                With whom
                <Tip text="Select everyone involved. Add new people from the People page first." />
              </div>
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
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: "var(--accent-soft)", color: "var(--accent)",
                          display: "grid", placeItems: "center",
                          fontSize: 9, fontWeight: 600, flexShrink: 0,
                        }}>
                          {initials(person.name)}
                        </span>
                      )}
                      {person.name}
                    </button>
                  );
                })}
                <Link href="/people" className="chip add">+ new person</Link>
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                Kind
                <Tip text="The type of interaction — saved as a tag for filtering and search." />
              </div>
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

            <div className="field">
              <div className="field-label">
                Note
                <Tip text="What happened? What did you observe or feel? This is the core of the entry." />
              </div>
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

            <div className="field">
              <div className="field-label">
                Tags
                <Tip text="Comma-separated labels to categorise and search this interaction later." />
              </div>
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

            <div className="field">
              <div className="field-label">
                When
                <Tip text="When this interaction took place. Defaults to now — edit to backdate an entry." />
              </div>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="input"
                style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
            </div>

            <div className="field">
              <div className="field-label">
                Context
                <Tip text="Where it happened or what prompted it — e.g. 'office kitchen', 'after standup', 'Slack DM'." />
              </div>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Where, setting, circumstance"
                className="input"
              />
            </div>

            <div className="field">
              <div className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  Confidence
                  <Tip text="How accurately you remember this. Keep it low when recalling from hours ago; raise it when writing right after it happened." />
                </span>
                <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                  {confidencePct}%
                </span>
              </div>
              <input
                type="range" min={0} max={100} value={confidencePct}
                onChange={(e) => setConfidence(Number(e.target.value) / 100)}
                className="slider"
                style={{ backgroundImage: `linear-gradient(var(--accent), var(--accent))`, backgroundSize: `${confidencePct}% 100%`, backgroundRepeat: "no-repeat" }}
              />
            </div>

            <div className="field">
              <div className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  Energy
                  <Tip text="How energising or draining was this interaction? Left = draining, right = energising. Used to track your daily battery." />
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {observation.trim() && (
                    <button
                      type="button"
                      onClick={handleClassify}
                      disabled={classifying}
                      className="btn ghost"
                      style={{ fontSize: 11, padding: "2px 8px", height: "auto" }}
                    >
                      {classifying ? "classifying…" : "✦ classify"}
                    </button>
                  )}
                  <span style={{ color: energy < 35 ? "var(--danger)" : energy > 65 ? "var(--good)" : "var(--fg-mute)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                    {energy < 35 ? "draining" : energy > 65 ? "energising" : "neutral"}
                  </span>
                </div>
              </div>
              <input
                type="range" min={0} max={100} value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="slider"
                style={{ backgroundImage: `linear-gradient(var(--accent), var(--accent))`, backgroundSize: `${energy}% 100%`, backgroundRepeat: "no-repeat" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-faint)", marginTop: 2 }}>
                <span>draining</span><span>energising</span>
              </div>
              {classifyReason && (
                <p style={{ fontSize: 11, color: "var(--fg-mute)", marginTop: 4, fontStyle: "italic" }}>
                  {classifyReason}
                </p>
              )}
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

            <button
              type="submit"
              disabled={submitting || !observation.trim()}
              className="btn primary"
              style={{ marginTop: "auto" }}
            >
              {submitting ? "Saving…" : "Save interaction →"}
            </button>
            <p style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "center" }}>
              or Ctrl+Enter from anywhere
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
