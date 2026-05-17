"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .authStatus()
      .then((status) => {
        setHasUsers(status.has_users);
        setMode(status.has_users ? "login" : "register");
      })
      .catch(() => setHasUsers(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result =
        mode === "register"
          ? await api.register(username.trim(), password)
          : await api.login(username.trim(), password);
      setAuthToken(result.token);
      setMessage(`Signed in as ${result.user.username}`);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-2xl font-medium text-canopy-text">Account</h1>
        <p className="mt-1 text-sm text-canopy-muted">
          Optional local account for future cross-device sync. Data stays on your
          machine; credentials are hashed, never stored in plain text.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="panel space-y-4 p-5">
        {hasUsers === null ? (
          <p className="text-sm text-canopy-muted">Checking status…</p>
        ) : (
          <>
            <p className="text-xs text-canopy-muted">
              {hasUsers
                ? "Sign in to continue on this device."
                : "Create the first account on this instance."}
            </p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              autoComplete="username"
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password or passcode (min 6 characters)"
              required
              minLength={6}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className={inputClass}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-canopy-accent">{message}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-canopy-accent px-4 py-2 text-sm font-medium text-canopy-bg disabled:opacity-50"
            >
              {submitting
                ? "Please wait…"
                : mode === "register"
                  ? "Create account"
                  : "Sign in"}
            </button>
            {hasUsers && (
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="w-full text-center text-xs text-canopy-muted hover:text-canopy-text"
              >
                {mode === "login"
                  ? "Need an account? Register"
                  : "Already have an account? Sign in"}
              </button>
            )}
          </>
        )}
      </form>

      <p className="text-xs text-canopy-muted">
        Sync across devices is not enabled yet — this scaffolds identity for a
        future encrypted sync layer.
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-canopy-border bg-canopy-bg px-3 py-2 text-sm text-canopy-text placeholder:text-canopy-muted/60 focus:border-canopy-accent focus:outline-none";
