import type { Interaction } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function InteractionCard({ interaction }: { interaction: Interaction }) {
  return (
    <div className="tl-item">
      <div className="tl-time">
        <div>{formatDate(interaction.occurred_at)}</div>
        <div style={{ marginTop: 2, opacity: 0.7 }}>{formatTime(interaction.occurred_at)}</div>
      </div>
      <div className="tl-body">
        {interaction.participants.length > 0 && (
          <div className="who">
            {interaction.participants.map((p) => <b key={p.id}>{p.name}</b>)}
            <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              · {Math.round(interaction.confidence * 100)}%
            </span>
          </div>
        )}
        <div className="note">{interaction.observation}</div>
        {interaction.context && (
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--fg-mute)" }}>{interaction.context}</div>
        )}
        {interaction.tags.length > 0 && (
          <div className="tags">
            {interaction.tags.map((t) => <span key={t.id} className="tag">{t.name}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
