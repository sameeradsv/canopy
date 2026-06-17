export const DIMENSION_KEYS = [
  "urgency",
  "reversibility",
  "visibility",
  "effort",
  "growth_value",
  "operational_cost",
] as const;

export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const DIMENSION_LABELS: Record<string, string> = {
  urgency: "Urgency",
  reversibility: "Reversibility",
  visibility: "Visibility",
  effort: "Effort",
  growth_value: "Growth value",
  operational_cost: "Operational cost",
};

export const DIMENSION_DESC: Record<string, string> = {
  urgency: "How time-sensitive is this? Does delay compound the problem?",
  reversibility:
    "How easy is it to undo? Low = hard to reverse, high = easily undone.",
  visibility: "How visible is this to others? High = visible to stakeholders.",
  effort: "How much time and energy is required? High = significant investment.",
  growth_value: "Does this build capability or create lasting value?",
  operational_cost: "What is the ongoing cost of maintaining this decision?",
};
