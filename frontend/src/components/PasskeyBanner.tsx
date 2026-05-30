"use client";

import { useState } from "react";
import { usePasskey } from "@/lib/usePasskey";

export function PasskeyBanner() {
  const { supported, registered, registerPasskey } = usePasskey();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!supported || registered || dismissed || done) return null;

  async function handleEnable() {
    setBusy(true);
    setErr(null);
    try {
      await registerPasskey();
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 20px", background: "var(--surface-2, #f5efe2)", borderBottom: "1px solid var(--border, #e8dfc8)", fontSize: 13 }}>
      {err ? (
        <span style={{ color: "var(--error, #c0392b)", flexGrow: 1 }}>{err}</span>
      ) : (
        <span style={{ color: "var(--fg-mute)", flexGrow: 1 }}>Enable biometric sign-in for faster access?</span>
      )}
      <button onClick={handleEnable} disabled={busy} className="btn primary" style={{ padding: "3px 14px", fontSize: 12 }}>
        {busy ? "Setting up…" : "Enable"}
      </button>
      <button onClick={() => setDismissed(true)} className="btn ghost" style={{ fontSize: 12 }}>
        Not now
      </button>
    </div>
  );
}
