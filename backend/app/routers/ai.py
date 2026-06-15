from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import optional_auth_user, optional_user
from app.models import Interaction, Person, User

router = APIRouter(prefix="/ai", tags=["ai"])


class ClassifyRequest(BaseModel):
    observation: str
    context: Optional[str] = None
    participant_ids: list[int] = []


class ClassifyResponse(BaseModel):
    energy: float
    label: str
    reasoning: str


@router.post("/classify", response_model=ClassifyResponse)
def classify(
    data: ClassifyRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    from app.ai import classify_energy
    from app.config import settings

    if not settings.groq_api_key:
        raise HTTPException(503, "AI classification is not configured (GROQ_API_KEY missing)")

    person_notes: list[tuple[str, str]] = []
    for pid in data.participant_ids:
        p = db.get(Person, pid)
        if p:
            person_notes.append((p.name, p.notes or ""))

    try:
        result = classify_energy(data.observation, data.context, person_notes or None)
    except Exception as exc:
        raise HTTPException(500, f"Classification failed: {exc}") from exc

    return result


@router.post("/classify-all", response_model=dict)
def classify_all(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    """Classify all interactions that have no energy score yet."""
    from app.ai import classify_energy
    from app.config import settings

    if not settings.groq_api_key:
        raise HTTPException(503, "AI classification is not configured (GROQ_API_KEY missing)")

    uid = user.id if user else None
    interactions = db.query(Interaction).filter(
        Interaction.user_id == uid,
        Interaction.energy.is_(None),
    ).all()

    classified = 0
    errors = 0
    for ix in interactions:
        person_notes = [(p.name, p.notes or "") for p in ix.participants]
        try:
            result = classify_energy(ix.observation, ix.context, person_notes or None)
            ix.energy = result["energy"]
            classified += 1
        except Exception:
            errors += 1

    db.commit()
    return {"classified": classified, "errors": errors, "total": len(interactions)}


class AgentChatRequest(BaseModel):
    messages: list[dict]
    model: str = "llama-3.3-70b-versatile"
    sibling_token: Optional[str] = None
    scope: str = "canopy"
    diary: bool = False


@router.post("/agent/chat")
def agent_chat(
    data: AgentChatRequest,
    db: Session = Depends(get_db),
    header_user: Optional[User] = Depends(optional_user),
):
    from app.auth_utils import get_user_for_token
    from app.config import settings

    if not settings.groq_api_key:
        raise HTTPException(503, "AI chat not configured (GROQ_API_KEY missing)")

    # Auth: prefer Authorization header, fall back to sibling_token in body
    user = header_user or get_user_for_token(db, data.sibling_token)
    user_id = user.id if user else None

    # Fetch context from DB
    people = (
        db.query(Person)
        .filter(Person.user_id == user_id)
        .order_by(Person.name)
        .limit(200)
        .all()
    )
    interactions = (
        db.query(Interaction)
        .filter(Interaction.user_id == user_id)
        .order_by(Interaction.occurred_at.desc())
        .limit(60)
        .all()
    )

    # Build system prompt with user's data as context
    today = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%B %d, %Y")
    lines = [
        f"You are a personal relationship assistant for Canopy. Today is {today}.",
        "Answer questions about the user's interactions and people concisely and helpfully.",
        "Refer to people by name. Give specific dates when relevant.",
    ]

    if people:
        lines.append(f"\n## People in this network ({len(people)} total)")
        for p in people:
            entry = f"- {p.name}"
            if p.relationship:
                entry += f" [{p.relationship}]"
            if p.notes:
                entry += f": {p.notes[:200]}"
            lines.append(entry)

    if interactions:
        lines.append(f"\n## Interactions ({len(interactions)} shown, most recent first)")
        for ix in interactions:
            ts = ix.occurred_at.strftime("%Y-%m-%d")
            names = ", ".join(p.name for p in ix.participants)
            entry = f"- [{ts}]"
            if names:
                entry += f" with {names}"
            entry += f": {ix.observation[:300]}"
            if ix.context:
                entry += f" (context: {ix.context})"
            lines.append(entry)

    system_prompt = "\n".join(lines)

    # Assemble Groq message list
    groq_msgs: list[dict] = [{"role": "system", "content": system_prompt}]
    for m in data.messages:
        role = m.get("role")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            groq_msgs.append({"role": role, "content": content})

    def sse_stream():
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        try:
            stream = client.chat.completions.create(
                model=data.model,
                messages=groq_msgs,
                max_tokens=1024,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(sse_stream(), media_type="text/event-stream")
