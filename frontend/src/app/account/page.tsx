"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Summary } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  const [exportPass, setExportPass] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [importPass, setImportPass] = useState("");
  const [importBlob, setImportBlob] = useState<Record<string, unknown> | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: Record<string, number>; skipped: Record<string, number> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) api.summary().then(setSummary).catch(() => null);
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
    <>
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Account · /account</div>
          <h1 className="page-title">Your <em>account.</em></h1>
        </div>
        <button onClick={logout} className="btn" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
          Sign out
        </button>
      </div>

      {/* Identity */}
      <div className="card" style={{ marginBottom: "var(--pad-5)" }}>
        <div className="kicker" style={{ marginBottom: 12 }}>Identity</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar big" style={{ width: 44, height: 44, fontSize: 18 }}>
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{user.username}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
              {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
        {summary && (
          <div className="grid-3" style={{ marginTop: 20, paddingTop: 16, borderTop: "0.5px solid var(--line-soft)" }}>
            <StatCard label="Interactions" value={summary.total_interactions} />
            <StatCard label="People" value={summary.total_people} />
            <StatCard label="Tags" value={summary.total_tags} />
          </div>
        )}
      </div>

      {/* Sync note */}
      <div className="card" style={{ marginBottom: "var(--pad-5)", background: "var(--accent-soft)", borderColor: "color-mix(in oklch, var(--accent) 25%, var(--line))" }}>
        <p style={{ fontSize: 13, color: "var(--fg-mute)" }}>
          <strong style={{ color: "var(--fg)" }}>Cross-device sync</strong> — sign in with the same credentials on any device pointing to the same backend. Use the encrypted export below to migrate data or keep an offline backup.
        </p>
      </div>

      {/* Export */}
      <div className="card" style={{ marginBottom: "var(--pad-5)" }}>
        <div className="kicker" style={{ marginBottom: 12 }}>Encrypted export</div>
        <p style={{ fontSize: 13, color: "var(--fg-mute)", marginBottom: 14 }}>
          Downloads all your data as an encrypted JSON file. The passphrase is never stored.
        </p>
        <form onSubmit={handleExport} style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            value={exportPass}
            onChange={(e) => setExportPass(e.target.value)}
            placeholder="Passphrase (min 8 characters)"
            required
            minLength={8}
            className="input"
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={exporting} className="btn primary">
            {exporting ? "Exporting…" : "Export"}
          </button>
        </form>
        {exportError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{exportError}</p>}
      </div>

      {/* Import */}
      <div className="card">
        <div className="kicker" style={{ marginBottom: 12 }}>Import / restore</div>
        <p style={{ fontSize: 13, color: "var(--fg-mute)", marginBottom: 14 }}>
          Merges an export file into this account. Duplicates are skipped automatically.
        </p>
        <form onSubmit={handleImport} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ fontSize: 13, color: "var(--fg-mute)" }}
          />
          {importBlob && (
            <p style={{ fontSize: 12, color: "var(--accent)" }}>
              File loaded (version {String(importBlob.version ?? "?")})
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              placeholder="Passphrase used during export"
              required
              minLength={8}
              className="input"
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={importing || !importBlob} className="btn primary">
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
        </form>
        {importError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{importError}</p>}
        {importResult && (
          <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg)", border: "0.5px solid var(--line)", borderRadius: "var(--r-3)", fontSize: 12, color: "var(--fg-mute)" }}>
            <p style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Import complete</p>
            <p>Created — people: {importResult.created.people ?? 0}, interactions: {importResult.created.interactions ?? 0}, tasks: {importResult.created.tasks ?? 0}</p>
            <p>Skipped — people: {importResult.skipped.people ?? 0}, interactions: {importResult.skipped.interactions ?? 0}, tasks: {importResult.skipped.tasks ?? 0}</p>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-lbl">{label}</div>
      <div className="stat-num">{value}</div>
    </div>
  );
}
