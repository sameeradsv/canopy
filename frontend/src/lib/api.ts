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
  last_interaction_at: string | null;
}

export interface Interaction {
  id: number;
  occurred_at: string;
  kind: string | null;
  context: string | null;
  observation: string;
  outcome: string | null;
  confidence: number;
  energy: number | null;
  reflection: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  participants: Person[];
  tags: Tag[];
}

export interface PersonScore {
  person_id: number;
  scores: Record<string, number>;
  confidence: number;
  summary: string | null;
  interaction_count: number;
  scored_at: string;
}

export interface Summary {
  total_interactions: number;
  total_people: number;
  total_tags: number;
  recent_interactions: Interaction[];
  top_tags: Tag[];
  frequently_contacted: Person[];
}

export interface SearchResult {
  interactions: Interaction[];
  people: Person[];
  query: string;
}

export interface EnergyEvent {
  occurred_at: string;
  time: string;
  energy: number;
  /** Signed energy change this event caused (positive = restored, negative = drained) */
  delta?: number;
  /** Cumulative energy balance after this event (0–1) */
  running_energy?: number;
  label: "draining" | "neutral" | "energising";
  note: string;
  source: "canopy" | "circuit" | "chef";
}

export interface EnergyTimeline {
  date: string;
  source: string;
  /** Opening energy balance for the day (0–1) */
  start_energy?: number;
  /** Closing energy balance after all events (0–1) */
  end_energy?: number;
  events: EnergyEvent[];
  avg_energy: number | null;
}

export interface InteractionCreate {
  observation: string;
  kind?: string | null;
  context?: string | null;
  outcome?: string | null;
  confidence?: number;
  energy?: number | null;
  reflection?: Record<string, string> | null;
  participant_ids?: number[];
  tag_names?: string[];
  occurred_at?: string;
}

export interface InteractionUpdate {
  observation?: string;
  kind?: string | null;
  context?: string | null;
  confidence?: number;
  energy?: number | null;
  reflection?: Record<string, string> | null;
  occurred_at?: string;
  tag_names?: string[];
  participant_ids?: number[];
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

export interface InteractionPage {
  items: Interaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PersonPage {
  items: Person[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type InteractionListParams = {
  person_id?: number;
  tag?: string;
  kind?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
  page?: number;
};

export interface AuthResponse {
  token: string;
  user: { id: number; username: string; created_at: string };
}

export interface RelationshipDefaults {
  types: string[];
  defaults: Record<string, { notes: string }>;
}

export interface Preset {
  id: string;
  name: string;
  dims: Record<string, number | null>;
  note: string;
  use: number;
}

import { getAuthToken, setAuthToken } from "@/lib/auth";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  if (res.status === 401) {
    setAuthToken(null);
    if (typeof window !== "undefined") window.location.replace("/login");
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  summary: () => request<Summary>("/api/summary"),

  people: (q?: string) =>
    request<Person[]>(q ? `/api/people?q=${encodeURIComponent(q)}` : "/api/people"),

  peoplePage: (opts?: { q?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (opts?.q) search.set("q", opts.q);
    search.set("page", String(opts?.page ?? 1));
    search.set("limit", String(opts?.limit ?? 24));
    return request<PersonPage>(`/api/people?${search.toString()}`);
  },

  createPerson: (data: PersonCreate) =>
    request<Person>("/api/people", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  interactions: (params?: Omit<InteractionListParams, "page">) => {
    const search = new URLSearchParams();
    if (params?.person_id != null) search.set("person_id", String(params.person_id));
    if (params?.tag) search.set("tag", params.tag);
    if (params?.kind) search.set("kind", params.kind);
    if (params?.from_date) search.set("from_date", params.from_date);
    if (params?.to_date) search.set("to_date", params.to_date);
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.offset != null) search.set("offset", String(params.offset));
    const qs = search.toString();
    return request<Interaction[]>(`/api/interactions${qs ? `?${qs}` : ""}`);
  },

  interactionsPage: (params?: Omit<InteractionListParams, "page"> & { page?: number }) => {
    const search = new URLSearchParams();
    if (params?.person_id != null) search.set("person_id", String(params.person_id));
    if (params?.tag) search.set("tag", params.tag);
    if (params?.kind) search.set("kind", params.kind);
    if (params?.from_date) search.set("from_date", params.from_date);
    if (params?.to_date) search.set("to_date", params.to_date);
    search.set("page", String(params?.page ?? 1));
    search.set("limit", String(params?.limit ?? 30));
    return request<InteractionPage>(`/api/interactions?${search.toString()}`);
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

  relationshipDefaults: () =>
    request<RelationshipDefaults>("/api/relationship-defaults"),

  authStatus: () =>
    request<{ has_users: boolean }>("/api/auth/status"),

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

  /** Plain JSON export (ops / scripts — not encrypted). */
  exportData: () => request<Record<string, unknown>>("/api/export"),

  listTags: () => request<Tag[]>("/api/tags"),

  energyTimeline: (date?: string) =>
    request<EnergyTimeline>(`/api/sync/energy/timeline${date ? `?date=${date}` : ""}`),

  classifyInteraction: (data: { observation: string; context?: string | null; participant_ids?: number[] }) =>
    request<{ energy: number; label: string; reasoning: string }>("/api/ai/classify", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  classifyAll: () =>
    request<{ classified: number; errors: number; total: number }>("/api/ai/classify-all", {
      method: "POST",
    }),

  scorePersonById: (personId: number) =>
    request<PersonScore>(`/api/people/${personId}/score`, { method: "POST" }),

  getAllScores: () =>
    request<Record<number, PersonScore>>("/api/people/scores/all"),

  scoreAll: () =>
    request<{ scored: number; errors: number; total: number }>("/api/people/score-all", {
      method: "POST",
    }),

  getPresets: () =>
    request<{ presets: Preset[] }>("/api/settings/presets"),

  setPresets: (presets: Preset[]) =>
    request<{ presets: Preset[] }>("/api/settings/presets", {
      method: "PUT",
      body: JSON.stringify({ presets }),
    }),

  getDimensions: () =>
    request<{ values: Record<string, number | null> }>("/api/settings/dimensions"),

  setDimensions: (values: Record<string, number | null>) =>
    request<{ values: Record<string, number | null> }>("/api/settings/dimensions", {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),

  getPatterns: () =>
    request<{
      insights: string[];
      recurring_tags: { tag: string; count: number }[];
      stale_contacts: { name: string; days_since: number }[];
    }>("/api/ai/patterns"),

  synthesize: (days = 7) =>
    request<{ summary: string; days: number; interaction_count?: number; error?: string }>(
      `/api/ai/synthesize?days=${days}`,
      { method: "POST" },
    ),
};
