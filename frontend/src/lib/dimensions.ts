export const DIMENSION_KEYS = [
  "urgency",
  "reversibility",
  "visibility",
  "effort",
  "growth_value",
  "operational_cost",
] as const;

export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  urgency: "Urgency",
  reversibility: "Reversibility",
  visibility: "Visibility",
  effort: "Effort",
  growth_value: "Growth value",
  operational_cost: "Operational cost",
};

export const DIMENSION_HINTS: Record<DimensionKey, string> = {
  urgency: "How time-sensitive is this burden or decision?",
  reversibility: "How hard is it to undo if you choose wrong?",
  visibility: "How visible is the work or outcome to others?",
  effort: "How much sustained effort does it demand?",
  growth_value: "How much does it contribute to long-term growth?",
  operational_cost: "Ongoing maintenance or coordination cost?",
};
