export interface Tag {
  id: number;
  name: string;
}

export interface Person {
  id: number;
  name: string;
  relationship: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  interaction_count: number;
}

export interface Interaction {
  id: number;
  occurred_at: string;
  context: string | null;
  observation: string;
  outcome: string | null;
  confidence: number;
  energy: number | null;
  created_at: string;
  updated_at: string;
  participants: Person[];
  tags: Tag[];
}

export interface Summary {
  total_interactions: number;
  total_people: number;
  total_tags: number;
  recent_interactions: Interaction[];
  top_tags: Tag[];
}

export interface SearchResult {
  interactions: Interaction[];
  people: Person[];
  query: string;
}

export interface InteractionCreate {
  observation: string;
  context?: string | null;
  outcome?: string | null;
  confidence?: number;
  energy?: number | null;
  participant_ids?: number[];
  tag_names?: string[];
  occurred_at?: string;
}

export interface InteractionUpdate {
  observation?: string;
  context?: string | null;
  confidence?: number;
  energy?: number | null;
  occurred_at?: string;
  tag_names?: string[];
}

export interface PersonUpdate {
  name?: string;
  relationship?: string | null;
  notes?: string | null;
}

export interface PersonCreate {
  name: string;
  relationship?: string | null;
  notes?: string | null;
}

export interface AuthResponse {
  token: string;
  user: { id: number; username: string; created_at: string };
}

export interface RelationshipDefaults {
  types: string[];
  defaults: Record<string, { notes: string }>;
}

import { getAuthToken } from "@/lib/auth";

function resolveUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return `${configured}${path}`;
  if (typeof window !== "undefined") return path;
  return `http://127.0.0.1:8000${path}`;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(resolveUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; version: string }>("/api/health"),

  summary: () => request<Summary>("/api/summary"),

  people: (q?: string) =>
    request<Person[]>(q ? `/api/people?q=${encodeURIComponent(q)}` : "/api/people"),

  createPerson: (data: PersonCreate) =>
    request<Person>("/api/people", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  interactions: (params?: { person_id?: number; tag?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.person_id != null) search.set("person_id", String(params.person_id));
    if (params?.tag) search.set("tag", params.tag);
    if (params?.limit != null) search.set("limit", String(params.limit));
    const qs = search.toString();
    return request<Interaction[]>(`/api/interactions${qs ? `?${qs}` : ""}`);
  },

  createInteraction: (data: InteractionCreate) =>
    request<Interaction>("/api/interactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateInteraction: (id: number, data: InteractionUpdate) =>
    request<Interaction>(`/api/interactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteInteraction: (id: number) =>
    request<void>(`/api/interactions/${id}`, { method: "DELETE" }),

  updatePerson: (id: number, data: PersonUpdate) =>
    request<Person>(`/api/people/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePerson: (id: number) =>
    request<void>(`/api/people/${id}`, { method: "DELETE" }),

  search: (q: string) =>
    request<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`),

  tags: () => request<Tag[]>("/api/tags"),

  exportData: () =>
    request<{ people: unknown[]; tags: unknown[]; interactions: unknown[] }>("/api/export"),

  deleteAll: () =>
    request<void>("/api/data", { method: "DELETE" }),

  relationshipDefaults: () =>
    request<RelationshipDefaults>("/api/relationship-defaults"),

  authStatus: () =>
    request<{ has_users: boolean; sync_ready: boolean }>("/api/auth/status"),

  register: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<AuthResponse["user"]>("/api/auth/me"),

  encryptedExport: (passphrase: string) =>
    request<Record<string, unknown>>("/api/sync/export", {
      method: "POST",
      body: JSON.stringify({ passphrase }),
    }),

  encryptedImport: (passphrase: string, blob: Record<string, unknown>) =>
    request<{ status: string; created: Record<string, number>; skipped: Record<string, number> }>(
      "/api/sync/import",
      {
        method: "POST",
        body: JSON.stringify({ passphrase, blob }),
      },
    ),

  logout: () => request<void>("/api/auth/logout", { method: "DELETE" }),

  classifyInteraction: (data: { observation: string; context?: string | null; participant_ids?: number[] }) =>
    request<{ energy: number; label: string; reasoning: string }>("/api/ai/classify", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  classifyAll: () =>
    request<{ classified: number; errors: number; total: number }>("/api/ai/classify-all", {
      method: "POST",
    }),
};
