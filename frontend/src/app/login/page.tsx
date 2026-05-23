"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { setAuthToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, refetch } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/account");
  }, [user, loading, router]);

  useEffect(() => {
    api.authStatus()
      .then((status) => {
        setHasUsers(status.has_users);
        setMode(status.has_users ? "login" : "register");
      })
      .catch(() => setHasUsers(false));
  }, []);

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
        {/* Brand */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
            <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 16 }}>C</div>
            <div className="brand-name" style={{ fontSize: 18 }}>Canop<em>y</em></div>
          </div>

          {/* Local account form */}
          {(
            <>
              <div className="kicker" style={{ marginBottom: 10 }}>
                {mode === "register" ? "Create account" : "Sign in"}
              </div>
              <h1 style={{ fontSize: 32, marginBottom: 8 }}>
                {mode === "register" ? <>Welcome <em>aboard.</em></> : <>Good to <em>see you.</em></>}
              </h1>
              <p style={{ color: "var(--fg-mute)", fontSize: 13.5, marginBottom: 32, maxWidth: 40 + "ch" }}>
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
                  <button
                    type="button"
                    onClick={() => setMode(mode === "login" ? "register" : "login")}
                    className="btn ghost"
                    style={{ justifyContent: "center", fontSize: 12 }}
                  >
                    {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
                  </button>
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
