import Link from "next/link";
import { InteractionCard } from "@/components/InteractionCard";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  let interactions;
  try {
    interactions = await api.interactions({ limit: 200 });
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium text-canopy-text">Timeline</h1>
        <p className="text-canopy-muted">Cannot reach the API.</p>
      </div>
    );
  }

  const sorted = [...interactions].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-canopy-text">Timeline</h1>
          <p className="mt-1 text-sm text-canopy-muted">
            {sorted.length} interaction{sorted.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/capture"
          className="rounded-lg border border-canopy-border px-3 py-1.5 text-sm text-canopy-accent hover:border-canopy-accent"
        >
          + Capture
        </Link>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-canopy-muted">
          Nothing captured yet.{" "}
          <Link href="/capture" className="text-canopy-accent">
            Add your first interaction
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((interaction) => (
            <li key={interaction.id}>
              <InteractionCard interaction={interaction} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
