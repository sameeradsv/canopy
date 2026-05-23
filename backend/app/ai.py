from __future__ import annotations

import json
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

    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    import anthropic

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

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=_SYSTEM,
        messages=[{"role": "user", "content": "\n".join(parts)}],
    )

    raw = message.content[0].text.strip()
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
