export const RELATIONSHIP_TYPES = [
  "colleague",
  "friend",
  "family",
  "relative",
  "collaborator",
  "other",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  colleague: "Colleague",
  friend: "Friend",
  family: "Family",
  relative: "Relative",
  collaborator: "Collaborator",
  other: "Other",
};

export const FALLBACK_DEFAULTS: Record<RelationshipType, { notes: string }> = {
  colleague: { notes: "Work context — shared projects or recurring syncs." },
  friend: { notes: "Personal connection — informal check-ins and shared interests." },
  family: { notes: "Family member — household or close kin context." },
  relative: { notes: "Extended family — occasional contact, relationship context varies." },
  collaborator: { notes: "Collaborator — joint goals outside strict employment." },
  other: { notes: "" },
};
