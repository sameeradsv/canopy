"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Theme    = "paper" | "slate" | "ink";
type FontMode = "editorial" | "grotesk" | "typewriter";
type Density  = "compact" | "regular" | "comfy";

function apply(attr: string, value: string, key: string) {
  document.documentElement.setAttribute(attr, value);
  localStorage.setItem(key, value);
}

export default function SettingsPage() {
  const [theme,    setTheme]    = useState<Theme>("paper");
  const [fontMode, setFontMode] = useState<FontMode>("editorial");
  const [density,  setDensity]  = useState<Density>("regular");

  const [exportPass,   setExportPass]   = useState("");
  const [exporting,    setExporting]    = useState(false);
  const [exportError,  setExportError]  = useState<string | null>(null);

  const [importPass,   setImportPass]   = useState("");
  const [importBlob,   setImportBlob]   = useState<Record<string, unknown> | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ created: Record<string, number>; skipped: Record<string, number> } | null>(null);
  const [importError,  setImportError]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTheme((localStorage.getItem("canopy.theme")    ?? "paper")     as Theme);
    setFontMode((localStorage.getItem("canopy.fontMode") ?? "editorial") as FontMode);
    setDensity((localStorage.getItem("canopy.density") ?? "regular")  as Density);
  }, []);

  function onTheme(v: Theme) { setTheme(v); apply("data-theme", v, "canopy.theme"); }
  function onFontMode(v: FontMode) { setFontMode(v); apply("data-fontmode", v, "canopy.fontMode"); }
  function onDensity(v: Density) { setDensity(v); apply("data-density", v, "canopy.density"); }

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
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, paddingTop: 8 }}>
      <div className="kicker" style={{ marginBottom: 24 }}>Appearance</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 13 }}>Theme</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["paper", "slate", "ink"] as Theme[]).map((t) => (
            <button key={t} onClick={() => onTheme(t)} className={`btn ${theme === t ? "primary" : "ghost"}`} style={{ textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {theme === "paper" && "Warm cream — easy on the eyes in daylight."}
          {theme === "slate" && "Cool neutral — balanced for mixed lighting."}
          {theme === "ink"   && "Dark background — comfortable at night."}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 13 }}>Font style</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["editorial", "grotesk", "typewriter"] as FontMode[]).map((f) => (
            <button key={f} onClick={() => onFontMode(f)} className={`btn ${fontMode === f ? "primary" : "ghost"}`} style={{ textTransform: "capitalize" }}>
              {f}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {fontMode === "editorial"   && "Spectral serif — readable and considered."}
          {fontMode === "grotesk"     && "Manrope sans — clean and modern."}
          {fontMode === "typewriter"  && "JetBrains Mono — structured and technical."}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 13 }}>Density</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["compact", "regular", "comfy"] as Density[]).map((d) => (
            <button key={d} onClick={() => onDensity(d)} className={`btn ${density === d ? "primary" : "ghost"}`} style={{ textTransform: "capitalize" }}>
              {d}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {density === "compact" && "Tighter rows — more content visible at once."}
          {density === "regular" && "Balanced spacing — default."}
          {density === "comfy"   && "More breathing room — relaxed reading."}
        </p>
      </div>

      <div className="kicker" style={{ marginBottom: 24 }}>Data</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Export backup</div>
        <p className="faint small" style={{ marginBottom: 14 }}>
          Downloads all your data as an encrypted JSON file. The passphrase is never stored — keep it somewhere safe.
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

      <div className="card">
        <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Restore backup</div>
        <p className="faint small" style={{ marginBottom: 14 }}>
          Load a previously exported file. Duplicates are skipped automatically.
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
              {importing ? "Importing…" : "Restore"}
            </button>
          </div>
        </form>
        {importError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{importError}</p>}
        {importResult && (
          <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg)", border: "0.5px solid var(--line)", borderRadius: "var(--r-3)", fontSize: 12, color: "var(--fg-mute)" }}>
            <p style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Restore complete</p>
            <p>Created — people: {importResult.created.people ?? 0}, interactions: {importResult.created.interactions ?? 0}</p>
            <p>Skipped — people: {importResult.skipped.people ?? 0}, interactions: {importResult.skipped.interactions ?? 0}</p>
          </div>
        )}
      </div>
    </div>
  );
}
