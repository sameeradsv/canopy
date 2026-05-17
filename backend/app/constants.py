RELATIONSHIP_TYPES = [
    "colleague",
    "friend",
    "family",
    "relative",
    "collaborator",
    "other",
]

RELATIONSHIP_DEFAULTS: dict[str, dict[str, str]] = {
    "colleague": {
        "notes": "Work context — shared projects or recurring syncs.",
    },
    "friend": {
        "notes": "Personal connection — informal check-ins and shared interests.",
    },
    "family": {
        "notes": "Family member — household or close kin context.",
    },
    "relative": {
        "notes": "Extended family — occasional contact, relationship context varies.",
    },
    "collaborator": {
        "notes": "Collaborator — joint goals outside strict employment.",
    },
    "other": {
        "notes": "",
    },
}

DIMENSION_KEYS = [
    "urgency",
    "reversibility",
    "visibility",
    "effort",
    "growth_value",
    "operational_cost",
]

DIMENSION_LABELS: dict[str, str] = {
    "urgency": "Urgency",
    "reversibility": "Reversibility",
    "visibility": "Visibility",
    "effort": "Effort",
    "growth_value": "Growth value",
    "operational_cost": "Operational cost",
}
