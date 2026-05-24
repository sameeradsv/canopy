from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

_SYSTEM = """\
You classify personal interaction log entries for their energy impact on the author.
Given an interaction note, optional setting/context, and optional notes about the people involved,
return ONLY a JSON object — no markdown, no commentary — with exactly these keys:
  "energy": float 0.0–1.0  (0.0 = completely draining, 0.5 = neutral, 1.0 = completely energising)
  "label": one of "draining" | "neutral" | "energising"
  "reasoning": one short sentence explaining the classification

Classify from the perspective of the person who wrote the note (the author's energy, not a third party's).
Use person notes to inform the baseline — e.g. if someone is described as "demanding" that context
should weight an ambiguous interaction toward draining."""


def classify_energy(
    observation: str,
    context: Optional[str] = None,
    person_notes: Optional[list[tuple[str, str]]] = None,  # [(name, notes), ...]
) -> dict:
    """
    Returns {"energy": float, "label": str, "reasoning": str}.
    Raises RuntimeError if the API key is not configured or the call fails.
    """
    from app.config import settings

    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    from groq import Groq

    parts = [f"Interaction note: {observation}"]
    if context:
        parts.append(f"Setting/context: {context}")
    if person_notes:
        lines = ["People involved:"]
        for name, notes in person_notes:
            if notes:
                lines.append(f"  - {name}: {notes}")
            else:
                lines.append(f"  - {name}: (no notes)")
        parts.append("\n".join(lines))

    client = Groq(api_key=settings.groq_api_key)
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=256,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": "\n".join(parts)},
        ],
    )

    raw = response.choices[0].message.content.strip()
    # Strip accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    result = json.loads(raw)

    energy = float(result["energy"])
    energy = max(0.0, min(1.0, energy))
    label = "draining" if energy < 0.35 else "energising" if energy > 0.65 else "neutral"
    return {"energy": energy, "label": label, "reasoning": result.get("reasoning", "")}


# ── Person scoring ─────────────────────────────────────────────────────────────

DIMENSIONS_BY_RELATIONSHIP: dict[str, list[str]] = {
    "colleague": ["energy", "reciprocity", "intent", "effort", "fairness", "reliability", "collaboration", "growth", "boundaries"],
    "coworker":  ["energy", "reciprocity", "intent", "effort", "fairness", "reliability", "collaboration", "growth", "boundaries"],
    "manager":   ["energy", "reciprocity", "intent", "effort", "fairness", "reliability", "growth", "boundaries"],
    "report":    ["energy", "reciprocity", "intent", "effort", "reliability", "growth", "boundaries"],
    "friend":    ["energy", "reciprocity", "intent", "reliability", "authenticity", "support", "boundaries", "tension"],
    "family":    ["energy", "reciprocity", "intent", "reliability", "support", "authenticity", "connection", "boundaries", "tension"],
    "partner":   ["energy", "reciprocity", "intent", "reliability", "support", "authenticity", "connection", "boundaries", "tension"],
    "default":   ["energy", "reciprocity", "intent", "reliability", "effort"],
}

_DIMENSION_HINTS = {
    "energy":        "0.0 = every interaction leaves you depleted, 1.0 = consistently energising",
    "reciprocity":   "0.0 = very one-sided (they take, you give), 1.0 = highly balanced exchange",
    "intent":        "0.0 = motives feel unclear or misaligned with yours, 1.0 = clearly well-intentioned and aligned",
    "effort":        "0.0 = rarely follows through or puts in work, 1.0 = consistently puts in effort",
    "fairness":      "0.0 = credit/blame distributed very unfairly, 1.0 = always equitable",
    "reliability":   "0.0 = frequently says one thing and does another, 1.0 = completely dependable",
    "collaboration": "0.0 = joint work is unproductive or conflicted, 1.0 = highly effective together",
    "growth":        "0.0 = interactions rarely help you develop, 1.0 = consistently challenges/develops you",
    "boundaries":    "0.0 = limits routinely ignored or tested, 1.0 = fully respected",
    "authenticity":  "0.0 = interactions feel performative or guarded, 1.0 = deeply genuine",
    "support":       "0.0 = rarely shows up when it counts, 1.0 = consistently supportive",
    "connection":    "0.0 = feels purely obligatory, 1.0 = deep genuine bond",
    "tension":       "0.0 = no underlying friction, 1.0 = constant unresolved tension",
}

_SCORE_SYSTEM = """\
You assess the quality of a personal relationship based on interaction logs.
Given a person's profile, their relationship type, and a chronological list of interactions,
score each relevant dimension on a scale of 0.0 to 1.0.

Return ONLY a JSON object with these keys:
  "scores": {{ <dimension>: float 0.0–1.0, ... }}  — only include dimensions listed in the request
  "confidence": float 0.0–1.0  — how confident you are given the data volume and clarity
  "summary": one sentence capturing the overall relationship quality

Weight recent interactions more than old ones.
If data is sparse (< 3 interactions), still provide scores but keep confidence low (< 0.4).
Base scores strictly on the provided data — do not invent or assume."""


def score_person(
    person_name: str,
    relationship: Optional[str],
    person_notes: Optional[str],
    interactions: list[dict],  # [{"occurred_at": str, "observation": str, "context": str|None, "reflection": dict|None}]
) -> dict:
    """
    Returns {"scores": {dim: float}, "confidence": float, "summary": str}.
    """
    from app.config import settings

    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    from groq import Groq

    rel_key = (relationship or "").lower().strip()
    dimensions = DIMENSIONS_BY_RELATIONSHIP.get(rel_key, DIMENSIONS_BY_RELATIONSHIP["default"])

    dim_hints = "\n".join(f"  {d}: {_DIMENSION_HINTS[d]}" for d in dimensions)
    dims_list = ", ".join(dimensions)

    parts = [
        f"Person: {person_name}",
        f"Relationship type: {relationship or 'unspecified'}",
    ]
    if person_notes:
        parts.append(f"Notes about this person: {person_notes}")

    parts.append(f"\nDimensions to score: {dims_list}")
    parts.append(f"Dimension guidance:\n{dim_hints}")

    if interactions:
        parts.append(f"\nInteractions ({len(interactions)} total, oldest first):")
        for ix in interactions:
            ts = ix.get("occurred_at", "unknown date")
            obs = ix.get("observation", "")
            ctx = ix.get("context", "")
            refl = ix.get("reflection") or {}
            line = f"  [{ts}] {obs}"
            if ctx:
                line += f" (context: {ctx})"
            if refl:
                answers = "; ".join(f"{k}: {v}" for k, v in refl.items())
                line += f" [reflection: {answers}]"
            parts.append(line)
    else:
        parts.append("\nNo interactions logged yet.")

    client = Groq(api_key=settings.groq_api_key)
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=512,
        messages=[
            {"role": "system", "content": _SCORE_SYSTEM},
            {"role": "user", "content": "\n".join(parts)},
        ],
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    result = json.loads(raw)

    scores = {
        d: max(0.0, min(1.0, float(v)))
        for d, v in result.get("scores", {}).items()
        if d in dimensions
    }
    confidence = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
    return {
        "scores": scores,
        "confidence": confidence,
        "summary": result.get("summary", ""),
    }
