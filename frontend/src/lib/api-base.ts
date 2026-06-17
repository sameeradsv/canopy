/** API origin for fetch calls. Empty in browser dev → same-origin /api via next.config rewrites. */
export function getApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    return "";
  }
  return configured;
}

export function apiHostLabel(): string {
  const base = getApiBase();
  if (!base) return "local API proxy";
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}
