"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Summary } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  // Export state
  const [exportPass, setExportPass] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import state
  const [importPass, setImportPass] = useState("");
  const [importBlob, setImportBlob] = useState<Record<string, unknown> | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: Record<string, number>; skipped: Record<string, number> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.summary().then(setSummary).catch(() => null);
    }
  }, [user]);

  async function handleExport(e: FormEvent) {
    e.preventDefault();
    setExporting(true);
    setExportError(null);
    try {
      const blob = await api.encryptedExport(exportPass);
      const json = JSON.stringify(blob, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `canopy-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportPass("");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        setImportBlob(JSON.parse(ev.target?.result as string));
        setImportError(null);
      } catch {
        setImportError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (!importBlob) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await api.encryptedImport(importPass, importBlob);
      setImportResult({ created: result.created, skipped: result.skipped });
      setImportPass("");
      setImportBlob(null);
      if (fileRef.current) fileRef.current.value = "";
      api.summary().then(setSummary).catch(() => null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">Account</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Identity, data sync, and encrypted backup.
        </p>
      </header>

      {/* Identity */}
      <section className="panel space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-canopy-text">{user.username}</p>
            <p className="text-xs text-canopy-muted">
              Account created{" "}
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-canopy-border px-3 py-1.5 text-sm text-canopy-muted hover:border-red-500/50 hover:text-red-400"
          >
            Sign out
          </button>
        </div>
        {summary && (
          <div className="grid grid-cols-3 gap-3 border-t border-canopy-border pt-4">
            <Stat label="Interactions" value={summary.total_interactions} />
            <Stat label="People" value={summary.total_people} />
            <Stat label="Tags" value={summary.total_tags} />
          </div>
        )}
      </section>

      {/* Cross-device sync note */}
      <section className="rounded-lg border border-canopy-border/50 bg-canopy-surface/40 p-4">
        <p className="text-xs text-canopy-muted">
          <span className="font-medium text-canopy-text">Cross-device sync</span> — log
          in with the same username and passcode on any device that points to the same
          backend. Use the encrypted export below to migrate data or keep an offline
          backup.
        </p>
      </section>

      {/* Encrypted export */}
      <section className="panel space-y-3 p-5">
        <h2 className="text-sm font-medium text-canopy-text">Encrypted export</h2>
        <p className="text-xs text-canopy-muted">
          Downloads all your data as an AES-GCM encrypted JSON file. Keep the
          passphrase safe — it is never stored.
        </p>
        <form onSubmit={handleExport} className="flex gap-2">
          <input
            type="password"
            value={exportPass}
            onChange={(e) => setExportPass(e.target.value)}
            placeholder="Passphrase (min 8 characters)"
            required
            minLength={8}
            className={inputClass + " flex-1"}
          />
          <button
            type="submit"
            disabled={exporting}
            className="rounded-lg bg-canopy-accent px-4 py-2 text-sm font-medium text-canopy-bg disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
        </form>
        {exportError && <p className="text-sm text-red-400">{exportError}</p>}
      </section>

      {/* Encrypted import */}
      <section className="panel space-y-3 p-5">
        <h2 className="text-sm font-medium text-canopy-text">Import / restore</h2>
        <p className="text-xs text-canopy-muted">
          Merges an export file into this account. Duplicate people, interactions, and
          tasks are skipped automatically.
        </p>
        <form onSubmit={handleImport} className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="block w-full text-xs text-canopy-muted file:mr-3 file:rounded file:border file:border-canopy-border file:bg-canopy-surface file:px-3 file:py-1.5 file:text-xs file:text-canopy-text"
          />
          {importBlob && (
            <p className="text-xs text-canopy-accent">
              Export file loaded (version {String(importBlob.version ?? "?")})
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="password"
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              placeholder="Passphrase used during export"
              required
              minLength={8}
              className={inputClass + " flex-1"}
            />
            <button
              type="submit"
              disabled={importing || !importBlob}
              className="rounded-lg bg-canopy-accent px-4 py-2 text-sm font-medium text-canopy-bg disabled:opacity-50"
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
        </form>
        {importError && <p className="text-sm text-red-400">{importError}</p>}
        {importResult && (
          <div className="rounded border border-canopy-border bg-canopy-bg/60 p-3 text-xs text-canopy-muted">
            <p className="font-medium text-canopy-text">Import complete</p>
            <p>
              Created — people: {importResult.created.people ?? 0}, interactions:{" "}
              {importResult.created.interactions ?? 0}, tasks: {importResult.created.tasks ?? 0}
            </p>
            <p>
              Skipped (duplicates) — people: {importResult.skipped.people ?? 0}, interactions:{" "}
              {importResult.skipped.interactions ?? 0}, tasks: {importResult.skipped.tasks ?? 0}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-medium text-canopy-text">{value}</p>
      <p className="text-xs text-canopy-muted">{label}</p>
    </div>
  );
}

const inputClass =
  "rounded-lg border border-canopy-border bg-canopy-bg px-3 py-2 text-sm text-canopy-text placeholder:text-canopy-muted/60 focus:border-canopy-accent focus:outline-none";
