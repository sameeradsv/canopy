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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={28} height={28} style={{ display: "block" }}>
              <path d="M 44 56 C 42 66 38 76 34 88 L 66 88 C 62 76 58 66 56 56 Z" fill="#7a4015" />
              <path d="M 6 36 C 6 24 12 12 22 10 C 27 6 34 10 37 18 C 39 9 43 5 50 5 C 57 5 61 9 63 18 C 66 10 73 6 78 10 C 88 12 94 24 94 36 C 94 50 82 60 68 65 C 62 68 56 65 54 60 L 50 59 L 46 60 C 44 65 38 68 32 65 C 18 60 6 50 6 36 Z" fill="#2d7040" />
            </svg>
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
