"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const TOKEN_KEY = "canopy_auth_token";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

type Role = "user" | "assistant" | "system";
interface Msg { id: string; role: Role; content: string; streaming?: boolean; }

let _n = 0;
const uid = () => `m${++_n}`;

async function* agentStream(
  history: { role: string; content: string }[],
  token: string | null,
  signal: AbortSignal,
  onTool: (name: string) => void,
): AsyncGenerator<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${apiBase}/api/ai/agent/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: history,
      model: "llama-3.3-70b-versatile",
      sibling_token: token,
    }),
    signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data: ")) continue;
      const raw = l.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const p = JSON.parse(raw);
        if (p.error) throw new Error(p.error);
        if (p.status === "calling_tool" && p.tool) { onTool(p.tool); continue; }
        if (p.delta) yield p.delta;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

export function TerminalChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: uid(), role: "system", content: "Ask about your people, recent interactions, or who to follow up with." },
  ]);
  const [value, setValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const push = useCallback((m: Omit<Msg, "id">): string => {
    const id = uid();
    setMsgs(prev => [...prev, { ...m, id }]);
    return id;
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || streaming) return;
    if (t === "/clear") {
      setMsgs([{ id: uid(), role: "system", content: "Conversation cleared." }]);
      return;
    }

    push({ role: "user", content: t });
    setStreaming(true);

    const history = [
      ...msgs
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: t },
    ];
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    abortRef.current = new AbortController();
    const aiId = push({ role: "assistant", content: "", streaming: true });
    let full = "";

    try {
      for await (const chunk of agentStream(
        history, token, abortRef.current.signal,
        (tool) => push({ role: "system", content: `Looking up ${tool.replace(/_/g, " ")}…` }),
      )) {
        full += chunk;
        setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, content: full } : m));
      }
      setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setMsgs(prev => prev.map(m =>
        m.id === aiId ? {
          ...m,
          content: isAbort ? (full || "(cancelled)") : `Error: ${err instanceof Error ? err.message : "something went wrong"}`,
          streaming: false,
        } : m,
      ));
    } finally {
      setStreaming(false);
    }
  }, [msgs, streaming, push]);

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(value);
      setValue("");
    }
  }, [value, handleSend]);

  return (
    <div
      className="embedded-chat flex flex-col overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          Canopy Chat
        </span>
        <span style={{ color: "var(--line)" }}>·</span>
        <span className="text-xs" style={{ color: "var(--fg-mute)" }}>
          people &amp; interactions
        </span>
        <div className="flex-1" />
        {streaming && (
          <span className="text-xs animate-pulse" style={{ color: "var(--fg-faint)" }}>
            thinking…
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-4 min-h-0"
      >
        {msgs.map(msg => {
          if (msg.role === "system") {
            return (
              <div key={msg.id} className="flex justify-center py-0.5">
                <span
                  className="text-xs px-3 py-1 rounded-full"
                  style={{
                    color: "var(--fg-faint)",
                    background: "var(--panel)",
                    border: "1px solid var(--line-soft)",
                  }}
                >
                  {msg.content}
                </span>
              </div>
            );
          }
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div
                  className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-md text-sm leading-relaxed"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className="flex justify-start">
              <div
                className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tl-md text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  color: "var(--fg)",
                }}
              >
                {msg.content}
                {msg.streaming && (
                  <span
                    className="inline-block w-1.5 h-3 ml-0.5 rounded-sm align-text-bottom animate-pulse"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div
        className="flex items-end gap-2 px-4 py-3 border-t flex-shrink-0 embedded-chat-input"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <textarea
          ref={inputRef}
          className="flex-1 rounded-lg px-3 py-2 text-sm resize-none outline-none"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            color: "var(--fg)",
            minHeight: "38px",
            maxHeight: "120px",
          }}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKey}
          placeholder={streaming ? "thinking…" : "when did I last talk to Alice?"}
          rows={1}
          spellCheck={false}
          autoComplete="off"
        />
        {streaming ? (
          <button
            className="px-4 py-2 text-sm rounded-lg flex-shrink-0 transition-colors"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "1px solid var(--line)",
            }}
            onClick={() => abortRef.current?.abort()}
          >
            stop
          </button>
        ) : (
          <button
            className="px-4 py-2 text-sm rounded-lg flex-shrink-0 disabled:opacity-40 transition-colors"
            style={{ background: "var(--accent)", color: "#fff" }}
            onClick={() => { handleSend(value); setValue(""); }}
            disabled={!value.trim()}
          >
            send
          </button>
        )}
      </div>
    </div>
  );
}
