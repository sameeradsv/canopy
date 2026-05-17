import type { Interaction } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InteractionCard({ interaction }: { interaction: Interaction }) {
  const confidencePct = Math.round(interaction.confidence * 100);

  return (
    <article className="rounded-lg border border-canopy-border bg-canopy-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-canopy-muted">
        <time dateTime={interaction.occurred_at}>
          {formatDate(interaction.occurred_at)}
        </time>
        <span className="text-canopy-border">·</span>
        <span>{confidencePct}% confidence</span>
      </div>

      {interaction.participants.length > 0 && (
        <p className="mb-2 text-sm text-canopy-accent">
          {interaction.participants.map((p) => p.name).join(", ")}
        </p>
      )}

      <p className="text-canopy-text">{interaction.observation}</p>

      {interaction.context && (
        <p className="mt-2 text-sm text-canopy-muted">
          <span className="text-canopy-border">Context: </span>
          {interaction.context}
        </p>
      )}

      {interaction.outcome && (
        <p className="mt-1 text-sm text-canopy-muted">
          <span className="text-canopy-border">Outcome: </span>
          {interaction.outcome}
        </p>
      )}

      {interaction.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {interaction.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded bg-canopy-accentDim/30 px-2 py-0.5 text-xs text-canopy-muted"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
