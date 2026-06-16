"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { setAuthToken } from "@/lib/auth";
import { usePasskey } from "@/lib/usePasskey";
import { CortexSignIn } from "@shared/cortex";

const CORTEX_URL = (process.env.NEXT_PUBLIC_CORTEX_URL ?? "").replace(/\/$/, "");

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, refetch } = useAuth();
  const { supported, loginWithPasskey } = usePasskey();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [submitting, setSubmitting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Show Cortex first when configured; fall back to local-only if not
  const [showLocal, setShowLocal] = useState(!CORTEX_URL);

  useEffect(() => {
    if (!loading && user) router.replace("/account");
  }, [user, loading, router]);

  useEffect(() => {
    let cancelled = false;
    const intervalMs = 3000;
    const maxAttempts = 25;

    async function loadAuthStatus() {
      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, intervalMs));
          if (cancelled) return;
        }
        try {
          const status = await api.authStatus();
          if (!cancelled) {
            setHasUsers(status.has_users);
            setMode(status.has_users ? "login" : "register");
          }
          return;
        } catch {
          /* retry during cold start */
        }
      }
      if (!cancelled) setHasUsers(false);
    }

    loadAuthStatus();
    return () => { cancelled = true; };
  }, []);

  async function handlePasskeyLogin() {
    setPasskeyBusy(true);
    setError(null);
    try {
      const result = await loginWithPasskey();
      setAuthToken(result.token);
      await refetch();
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biometric login failed");
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function handleLocalSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = mode === "register"
        ? await api.register(username.trim(), password)
        : await api.login(username.trim(), password);
      setAuthToken(result.token);
      await refetch();
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) return null;

  return (
    <div className="login-wrap">
      {/* Form side */}
      <div className="login-side">
        <div>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={28} height={28} style={{ display: "block" }}>
              <rect x="44" y="64" width="12" height="22" rx="4" fill="#8a4a08" />
              <polygon points="50,16 80,64 20,64" fill="#d4831a" />
              <polygon points="50,28 72,64 50,64" fill="#8a4a08" opacity="0.55" />
            </svg>
            <div className="brand-name" style={{ fontSize: 18 }}>Canop<em>y</em></div>
          </div>

          {/* Shared heading — always visible */}
          <div className="kicker" style={{ marginBottom: 10 }}>
            {mode === "register" ? "Create account" : "Sign in"}
          </div>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>
            {mode === "register" ? <>Welcome <em>aboard.</em></> : <>Good to <em>see you.</em></>}
          </h1>

          {/* Cortex sign-in */}
          {CORTEX_URL && !showLocal && (
            <>
              <p style={{ color: "var(--fg-mute)", fontSize: 13, marginBottom: 24 }}>
                One account across Canopy, Chef, and Circuit.
              </p>
              <CortexSignIn
                cortexApiBase={CORTEX_URL}
                tokenKey="canopy_auth_token"
                appName="Canopy"
                showHeader={false}
                onSuccess={async () => {
                  await refetch();
                  router.push("/account");
                }}
                onLocalMode={() => setShowLocal(true)}
                classNames={{
                  field: "field",
                  label: "field-label",
                  input: "input",
                  submitBtn: "btn primary",
                }}
              />
              {supported && (
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyBusy || submitting}
                  className="btn ghost"
                  style={{ justifyContent: "center", marginTop: 4 }}
                >
                  {passkeyBusy ? "Please wait…" : "Sign in with biometrics"}
                </button>
              )}
            </>
          )}

          {/* Local account form */}
          {showLocal && (
            <>
              <p style={{ color: "var(--fg-mute)", fontSize: 13.5, marginBottom: 32, maxWidth: "40ch" }}>
                {mode === "register"
                  ? "Create a Canopy-only account. Your data stays in this app."
                  : "Sign in to continue to your workspace."}
              </p>

              {hasUsers === null ? (
                <p style={{ color: "var(--fg-mute)", fontSize: 13 }}>Checking…</p>
              ) : (
                <form onSubmit={handleLocalSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="field">
                    <div className="field-label">Username</div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your username"
                      required
                      autoComplete="username"
                      autoFocus
                      className="input"
                    />
                  </div>
                  <div className="field">
                    <div className="field-label">Password</div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="min 6 characters"
                      required
                      minLength={6}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      className="input"
                    />
                  </div>
                  {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
                  <button type="submit" disabled={submitting} className="btn primary" style={{ marginTop: 8 }}>
                    {submitting ? "Please wait…" : mode === "register" ? "Create account →" : "Sign in →"}
                  </button>
                  {supported && (
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={passkeyBusy || submitting}
                      className="btn ghost"
                      style={{ justifyContent: "center", marginTop: 4 }}
                    >
                      {passkeyBusy ? "Please wait…" : "Sign in with biometrics"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode(mode === "login" ? "register" : "login")}
                    className="btn ghost"
                    style={{ justifyContent: "center", fontSize: 12 }}
                  >
                    {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
                  </button>
                  {CORTEX_URL && (
                    <button
                      type="button"
                      onClick={() => setShowLocal(false)}
                      className="btn ghost"
                      style={{ justifyContent: "center", fontSize: 12 }}
                    >
                      ← Back to Cortex sign-in
                    </button>
                  )}
                </form>
              )}
            </>
          )}
        </div>

        <p style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
          Credentials are hashed and never stored in plain text.
        </p>
      </div>

      {/* Art side */}
      <div className="login-art">
        <div className="quote">
          &ldquo;The quality of your life is the quality of your relationships.&rdquo;
          <div className="quote-attr">— Tony Robbins</div>
        </div>
      </div>
    </div>
  );
}
