"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, type ReminderSettings } from "@/lib/api";
import { usePasskey } from "@/lib/usePasskey";
import { useNotificationToggle } from "@/lib/use-notifications";

type Theme    = "paper" | "ink";
type FontMode = "editorial" | "typewriter";
type Density  = "compact" | "regular" | "comfy";

function apply(attr: string, value: string, key: string) {
  document.documentElement.setAttribute(attr, value);
  localStorage.setItem(key, value);
}

export default function SettingsPage() {
  const [theme,    setTheme]    = useState<Theme>("paper");
  const [fontMode, setFontMode] = useState<FontMode>("editorial");
  const [density,  setDensity]  = useState<Density>("regular");

  const [classifyingAll,    setClassifyingAll]    = useState(false);
  const [classifyAllResult, setClassifyAllResult] = useState<{ classified: number; errors: number; total: number } | null>(null);
  const [classifyAllError,  setClassifyAllError]  = useState<string | null>(null);

  const [exportPass,   setExportPass]   = useState("");
  const [exporting,    setExporting]    = useState(false);
  const [exportError,  setExportError]  = useState<string | null>(null);
  const [plainExporting, setPlainExporting] = useState(false);
  const [plainExportError, setPlainExportError] = useState<string | null>(null);

  const [importPass,   setImportPass]   = useState("");
  const [importBlob,   setImportBlob]   = useState<Record<string, unknown> | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ created: Record<string, number>; skipped: Record<string, number> } | null>(null);
  const [importError,  setImportError]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { supported: passkeySupported, registered: passkeyRegistered, registerPasskey } = usePasskey();
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyErr, setPasskeyErr] = useState<string | null>(null);
  const notifications = useNotificationToggle();
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const [savingReminders, setSavingReminders] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);

  async function handleEnablePasskey() {
    setPasskeyBusy(true);
    setPasskeyErr(null);
    try {
      await registerPasskey();
    } catch (e) {
      setPasskeyErr(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setPasskeyBusy(false);
    }
  }

  useEffect(() => {
    setTheme((localStorage.getItem("canopy.theme")    ?? "paper")     as Theme);
    setFontMode((localStorage.getItem("canopy.fontMode") ?? "editorial") as FontMode);
    setDensity((localStorage.getItem("canopy.density") ?? "regular")  as Density);
    api.getReminderSettings()
      .then(setReminderSettings)
      .catch(() => undefined);
  }, []);

  async function handleClassifyAll() {
    setClassifyingAll(true);
    setClassifyAllError(null);
    setClassifyAllResult(null);
    try {
      const result = await api.classifyAll();
      setClassifyAllResult(result);
    } catch (err) {
      setClassifyAllError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setClassifyingAll(false);
    }
  }

  function onTheme(v: Theme) { setTheme(v); apply("data-theme", v, "canopy.theme"); }
  function onFontMode(v: FontMode) { setFontMode(v); apply("data-fontmode", v, "canopy.fontMode"); }
  function onDensity(v: Density) { setDensity(v); apply("data-density", v, "canopy.density"); }

  function updateReminderTime(key: keyof ReminderSettings["times"], value: string) {
    setReminderSettings((current) => current ? { ...current, times: { ...current.times, [key]: value } } : current);
  }

  function updateReminderEnabled(enabled: boolean) {
    setReminderSettings((current) => current ? { ...current, enabled } : current);
  }

  function updateReminderType(key: keyof ReminderSettings["types"], enabled: boolean) {
    setReminderSettings((current) => current ? { ...current, types: { ...current.types, [key]: enabled } } : current);
  }

  async function saveReminderSettings() {
    if (!reminderSettings) return;
    setSavingReminders(true);
    setReminderError(null);
    setReminderMessage(null);
    try {
      const saved = await api.setReminderSettings(reminderSettings);
      setReminderSettings(saved);
      setReminderMessage("Reminder settings saved.");
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : "Could not save reminder settings");
    } finally {
      setSavingReminders(false);
    }
  }

  async function sendTestNotification() {
    setTestingNotification(true);
    setReminderError(null);
    setReminderMessage(null);
    try {
      const result = await api.sendTestNotification();
      setReminderMessage(
        result.delivered > 0
          ? "Test notification sent."
          : result.subscriptions > 0 && result.errors.length > 0
            ? `Notification delivery failed: ${result.errors[0]}`
            : "No enabled device subscription was found.",
      );
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : "Could not send test notification");
    } finally {
      setTestingNotification(false);
    }
  }

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

  async function handlePlainExport() {
    setPlainExporting(true);
    setPlainExportError(null);
    try {
      const blob = await api.exportData();
      const json = JSON.stringify(blob, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `canopy-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPlainExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setPlainExporting(false);
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
          {(["paper", "ink"] as Theme[]).map((t) => (
            <button key={t} onClick={() => onTheme(t)} className={`btn ${theme === t ? "primary" : "ghost"}`} style={{ textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {theme === "paper" && "Warm cream — easy on the eyes in daylight."}
          {theme === "ink"   && "Dark background — comfortable at night."}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 13 }}>Font style</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["editorial", "typewriter"] as FontMode[]).map((f) => (
            <button key={f} onClick={() => onFontMode(f)} className={`btn ${fontMode === f ? "primary" : "ghost"}`} style={{ textTransform: "capitalize" }}>
              {f}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {fontMode === "editorial"   && "Spectral serif — readable and considered."}
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

      <div className="kicker" style={{ marginBottom: 24 }}>Intelligence</div>

      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Classify unscored interactions</div>
        <p className="faint small" style={{ marginBottom: 14 }}>
          Use AI to automatically score interactions that have no energy rating yet. Requires <code>GROQ_API_KEY</code> to be set on the server.
        </p>
        <button onClick={handleClassifyAll} disabled={classifyingAll} className="btn primary" style={{ width: "fit-content" }}>
          {classifyingAll ? "Classifying…" : "✦ Classify all unscored"}
        </button>
        {classifyAllError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{classifyAllError}</p>}
        {classifyAllResult && (
          <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg)", border: "0.5px solid var(--line)", borderRadius: "var(--r-3)", fontSize: 12, color: "var(--fg-mute)" }}>
            <p style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Done</p>
            <p>Classified: {classifyAllResult.classified} · Errors: {classifyAllResult.errors} · Total: {classifyAllResult.total}</p>
          </div>
        )}
      </div>

      <div className="kicker" style={{ marginBottom: 24 }}>Reminders</div>

      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Reflection notifications</div>
            <p className="faint small" style={{ marginBottom: 0 }}>
              A private evening diary prompt, with optional daytime check-ins.
            </p>
            {notifications.error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{notifications.error}</p>}
          </div>
          <button
            type="button"
            onClick={notifications.toggle}
            disabled={!notifications.supported || notifications.busy}
            className={`btn ${notifications.enabled ? "primary" : ""}`}
            style={{ minHeight: 44, whiteSpace: "nowrap" }}
          >
            {notifications.busy ? "Working..." : notifications.enabled ? "Device enabled" : "Enable device"}
          </button>
        </div>

        {!notifications.supported && (
          <p className="faint small" style={{ marginTop: -8 }}>
            This browser does not support Web Push notifications.
          </p>
        )}

        {reminderSettings && (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={reminderSettings.enabled}
                onChange={(e) => updateReminderEnabled(e.target.checked)}
              />
              Send reflection reminders
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {(["morning", "afternoon", "evening"] as const).map((key) => (
                <label key={key} style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--fg-mute)", textTransform: "capitalize" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44 }}>
                    {key}
                    <input
                      type="checkbox"
                      checked={reminderSettings.types[key]}
                      onChange={(e) => updateReminderType(key, e.target.checked)}
                    />
                  </span>
                  <input
                    type="time"
                    step={1800}
                    value={reminderSettings.times[key]}
                    onChange={(e) => updateReminderTime(key, e.target.value)}
                    className="input"
                    style={{ minHeight: 44 }}
                  />
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void saveReminderSettings()} disabled={savingReminders} className="btn primary" style={{ minHeight: 44 }}>
                {savingReminders ? "Saving..." : "Save reminders"}
              </button>
              <button type="button" onClick={() => void sendTestNotification()} disabled={!notifications.enabled || testingNotification} className="btn" style={{ minHeight: 44 }}>
                {testingNotification ? "Sending..." : "Send test"}
              </button>
            </div>
            {reminderMessage && <p style={{ color: "var(--accent)", fontSize: 13, margin: 0 }}>{reminderMessage}</p>}
            {reminderError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{reminderError}</p>}
            <p className="faint small" style={{ margin: 0 }}>
              Cron calls still need to be set to these same times in production.
            </p>
          </div>
        )}
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Export JSON (unencrypted)</div>
        <p className="faint small" style={{ marginBottom: 14 }}>
          Plain data dump for scripts or inspection. Requires sign-in; do not share this file.
        </p>
        <button type="button" onClick={() => void handlePlainExport()} disabled={plainExporting} className="btn">
          {plainExporting ? "Exporting…" : "Download JSON"}
        </button>
        {plainExportError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{plainExportError}</p>}
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

      {passkeySupported && (
        <>
          <div className="kicker" style={{ marginBottom: 24, marginTop: 32 }}>Security</div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Biometric sign-in</div>
                <p className="faint small" style={{ marginBottom: 0 }}>
                  {passkeyRegistered
                    ? "Passkey registered — sign in with Face ID or fingerprint."
                    : "Sign in with Face ID or fingerprint instead of your passcode."}
                </p>
                {passkeyErr && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{passkeyErr}</p>}
              </div>
              {passkeyRegistered ? (
                <span style={{ fontSize: 11, color: "var(--accent)", border: "1px solid currentColor", borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap", opacity: 0.7, flexShrink: 0 }}>
                  Enabled
                </span>
              ) : (
                <button onClick={handleEnablePasskey} disabled={passkeyBusy} className="btn primary" style={{ whiteSpace: "nowrap", padding: "3px 14px", fontSize: 12, flexShrink: 0 }}>
                  {passkeyBusy ? "Setting up…" : "Enable"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
