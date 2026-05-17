import Link from "next/link";
import { InteractionCard } from "@/components/InteractionCard";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let summary;
  try {
    summary = await api.summary();
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium text-canopy-text">Canopy</h1>
        <p className="text-canopy-muted">
          Cannot reach the API. Start the backend on port 8000.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">Dashboard</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Local-first contextual memory
        </p>
      </header>

      <section className="grid grid-cols-3 gap-4">
        <Stat label="Interactions" value={summary.total_interactions} />
        <Stat label="People" value={summary.total_people} />
        <Stat label="Tags" value={summary.total_tags} />
      </section>

      {summary.top_tags.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-canopy-muted">Top tags</h2>
          <div className="flex flex-wrap gap-2">
            {summary.top_tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded bg-canopy-surface border border-canopy-border px-2 py-1 text-xs text-canopy-muted"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-canopy-muted">Recent</h2>
        <Link
          href="/capture"
          className="text-sm text-canopy-accent hover:text-canopy-text"
        >
          Quick capture →
        </Link>
      </section>

      {summary.recent_interactions.length === 0 ? (
        <p className="text-sm text-canopy-muted">
          No interactions yet.{" "}
          <Link href="/capture" className="text-canopy-accent">
            Capture your first
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {summary.recent_interactions.map((interaction) => (
            <li key={interaction.id}>
              <InteractionCard interaction={interaction} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-canopy-border bg-canopy-surface px-4 py-3">
      <p className="text-2xl font-medium text-canopy-text">{value}</p>
      <p className="text-xs text-canopy-muted">{label}</p>
    </div>
  );
}
