"use client";

import { useState } from "react";
import { usePasskey } from "@/lib/usePasskey";

export function PasskeyBanner() {
  const { supported, registered, registerPasskey } = usePasskey();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!supported || registered || dismissed || done) return null;

  async function handleEnable() {
    setBusy(true);
    try {
      await registerPasskey();
      setDone(true);
    } catch {
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 20px", background: "var(--surface-2, #f5efe2)", borderBottom: "1px solid var(--border, #e8dfc8)", fontSize: 13 }}>
      <span style={{ color: "var(--fg-mute)", flexGrow: 1 }}>Enable biometric sign-in for faster access?</span>
      <button onClick={handleEnable} disabled={busy} className="btn primary" style={{ padding: "3px 14px", fontSize: 12 }}>
        {busy ? "Setting up…" : "Enable"}
      </button>
      <button onClick={() => setDismissed(true)} className="btn ghost" style={{ fontSize: 12 }}>
        Not now
      </button>
    </div>
  );
}
