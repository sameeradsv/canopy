from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps.auth import require_user
from app.models import PushSubscription, User
from app.services import get_setting, set_setting
from app.services.push import PushGoneError, send_web_push

router = APIRouter(prefix="/notifications", tags=["notifications"])
_IST = ZoneInfo("Asia/Kolkata")

REMINDER_SETTINGS_KEY = "notification_reminders"
REMINDER_SENT_KEY_PREFIX = "notification_sent"
REMINDER_TYPES = {"morning", "afternoon", "evening"}

DEFAULT_REMINDER_SETTINGS = {
    "enabled": False,
    "times": {
        "morning": "11:00",
        "afternoon": "15:00",
        "evening": "21:30",
    },
    "types": {
        "morning": False,
        "afternoon": False,
        "evening": True,
    },
}


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)


class SubscribePayload(BaseModel):
    endpoint: str = Field(min_length=1)
    keys: PushKeys
    device_name: Optional[str] = None
    platform: Optional[str] = None


class UnsubscribePayload(BaseModel):
    endpoint: str = Field(min_length=1)
    device_name: Optional[str] = None
    platform: Optional[str] = None


class ReminderSettingsPayload(BaseModel):
    enabled: bool
    times: dict[str, str]
    types: dict[str, bool] = {}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today_ist_key() -> str:
    return datetime.now(_IST).date().isoformat()


def _settings_for_user(db: Session, user_id: int) -> dict:
    row = get_setting(db, REMINDER_SETTINGS_KEY, user_id=user_id)
    if not row:
        return DEFAULT_REMINDER_SETTINGS.copy()
    try:
        loaded = json.loads(row.value)
    except json.JSONDecodeError:
        return DEFAULT_REMINDER_SETTINGS.copy()
    return {
        "enabled": bool(loaded.get("enabled", False)),
        "times": {**DEFAULT_REMINDER_SETTINGS["times"], **loaded.get("times", {})},
        "types": {**DEFAULT_REMINDER_SETTINGS["types"], **loaded.get("types", {})},
    }


def _validate_time(value: str) -> str:
    try:
        hour, minute = value.split(":", 1)
        h = int(hour)
        m = int(minute)
    except Exception as exc:
        raise HTTPException(400, "Reminder times must be HH:MM") from exc
    if not (0 <= h <= 23 and m in (0, 30)):
        raise HTTPException(400, "Reminder times must be HH:MM on a 30-minute boundary")
    return f"{h:02d}:{m:02d}"


def _rotating_message(reminder_type: str) -> dict[str, str]:
    variants = {
        "morning": [
            ("Morning interaction check-in", "Capture any important people moments from the morning."),
            ("Morning reflection", "Log the conversations, support, or friction worth remembering."),
            ("Canopy morning note", "A quick pass over who you met, helped, or need to follow up with."),
        ],
        "afternoon": [
            ("Afternoon interaction check-in", "Add what shifted with people since lunch."),
            ("Afternoon reflection", "Catch the small social signals before the day moves on."),
            ("Canopy afternoon note", "Save any useful context from the middle of the day."),
        ],
        "evening": [
            ("Evening interaction check-in", "Close the loop on the people moments from today."),
            ("Evening reflection", "Record the wins, tension, gratitude, or follow-ups while fresh."),
            ("Canopy evening note", "A final scan for conversations you may want future-you to remember."),
        ],
    }[reminder_type]
    day = datetime.now(_IST).toordinal()
    index = (day + sorted(REMINDER_TYPES).index(reminder_type)) % len(variants)
    title, body = variants[index]
    return {"title": title, "body": body}


def _payload_for(reminder_type: str) -> dict:
    return {
        **_rotating_message(reminder_type),
        "tag": f"canopy-{reminder_type}-reminder",
        "url": "/capture",
        "reminderType": reminder_type,
    }


def _notification_storage_error(exc: SQLAlchemyError) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail=(
            "Notification storage is not initialized. Run the Canopy database "
            "migration against the production DATABASE_URL."
        ),
    )


def _disable_matching_device_subscriptions(
    db: Session,
    *,
    user_id: int,
    current_endpoint: str,
    device_name: Optional[str],
    platform: Optional[str],
    now: datetime,
) -> None:
    if not device_name or not platform:
        return
    rows = (
        db.query(PushSubscription)
        .filter(
            PushSubscription.user_id == user_id,
            PushSubscription.device_name == device_name,
            PushSubscription.platform == platform,
            PushSubscription.endpoint != current_endpoint,
            PushSubscription.enabled == True,  # noqa: E712
        )
        .all()
    )
    for row in rows:
        row.enabled = False
        row.updated_at = now


@router.get("/vapid-public-key")
def vapid_public_key():
    if not settings.vapid_public_key:
        raise HTTPException(status_code=503, detail="Push notifications are not configured")
    return {"public_key": settings.vapid_public_key}


@router.get("/subscriptions")
def list_subscriptions(user: User = Depends(require_user), db: Session = Depends(get_db)):
    rows = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user.id)
        .order_by(PushSubscription.updated_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "endpoint": row.endpoint,
            "device_name": row.device_name,
            "platform": row.platform,
            "enabled": bool(row.enabled),
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        }
        for row in rows
    ]


@router.post("/subscribe", status_code=201)
def subscribe(payload: SubscribePayload, user: User = Depends(require_user), db: Session = Depends(get_db)):
    try:
        row = (
            db.query(PushSubscription)
            .filter(PushSubscription.user_id == user.id, PushSubscription.endpoint == payload.endpoint)
            .first()
        )
        if row is None:
            row = PushSubscription(user_id=user.id, endpoint=payload.endpoint)
            db.add(row)
        row.p256dh = payload.keys.p256dh
        row.auth = payload.keys.auth
        row.device_name = payload.device_name
        row.platform = payload.platform
        row.enabled = True
        now = _now_utc()
        row.updated_at = now
        _disable_matching_device_subscriptions(
            db,
            user_id=user.id,
            current_endpoint=payload.endpoint,
            device_name=payload.device_name,
            platform=payload.platform,
            now=now,
        )
        if get_setting(db, REMINDER_SETTINGS_KEY, user_id=user.id) is None:
            defaults = {
                **DEFAULT_REMINDER_SETTINGS,
                "enabled": True,
            }
            set_setting(db, REMINDER_SETTINGS_KEY, json.dumps(defaults), user_id=user.id)
        db.commit()
        db.refresh(row)
        return {"id": row.id, "enabled": bool(row.enabled)}
    except SQLAlchemyError as exc:
        db.rollback()
        raise _notification_storage_error(exc) from exc


@router.post("/unsubscribe")
def unsubscribe(payload: UnsubscribePayload, user: User = Depends(require_user), db: Session = Depends(get_db)):
    row = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user.id, PushSubscription.endpoint == payload.endpoint)
        .first()
    )
    if row:
        row.enabled = False
        now = _now_utc()
        row.updated_at = now
        _disable_matching_device_subscriptions(
            db,
            user_id=user.id,
            current_endpoint=payload.endpoint,
            device_name=payload.device_name,
            platform=payload.platform,
            now=now,
        )
        db.commit()
    return {"status": "ok"}


@router.get("/reminder-settings")
def get_reminder_settings(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return _settings_for_user(db, user.id)


@router.put("/reminder-settings")
def put_reminder_settings(
    payload: ReminderSettingsPayload,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    cleaned = {
        "enabled": payload.enabled,
        "times": {
            "morning": _validate_time(payload.times.get("morning", DEFAULT_REMINDER_SETTINGS["times"]["morning"])),
            "afternoon": _validate_time(payload.times.get("afternoon", DEFAULT_REMINDER_SETTINGS["times"]["afternoon"])),
            "evening": _validate_time(payload.times.get("evening", DEFAULT_REMINDER_SETTINGS["times"]["evening"])),
        },
        "types": {
            "morning": bool(payload.types.get("morning", DEFAULT_REMINDER_SETTINGS["types"]["morning"])),
            "afternoon": bool(payload.types.get("afternoon", DEFAULT_REMINDER_SETTINGS["types"]["afternoon"])),
            "evening": bool(payload.types.get("evening", DEFAULT_REMINDER_SETTINGS["types"]["evening"])),
        },
    }
    set_setting(db, REMINDER_SETTINGS_KEY, json.dumps(cleaned), user_id=user.id)
    return cleaned


@router.post("/test")
def send_test_notification(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return _send_to_user(db, user.id, {
        "title": "Canopy notifications are ready",
        "body": "This device can receive reflection reminders.",
        "tag": "canopy-test-notification",
        "url": "/settings",
    })


def _send_to_user(db: Session, user_id: int, payload: dict) -> dict:
    subscriptions = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user_id, PushSubscription.enabled == True)  # noqa: E712
        .all()
    )
    delivered = 0
    disabled = 0
    errors: list[str] = []
    for sub in subscriptions:
        try:
            send_web_push(sub, payload)
            delivered += 1
        except PushGoneError as exc:
            sub.enabled = False
            sub.updated_at = _now_utc()
            disabled += 1
            errors.append(str(exc))
        except Exception as exc:  # pragma: no cover - network failures are integration tested
            errors.append(str(exc))
    db.commit()
    return {
        "subscriptions": len(subscriptions),
        "delivered": delivered,
        "disabled": disabled,
        "errors": errors[:3],
        "error_count": len(errors),
    }


@router.post("/reminder/{reminder_type}")
def send_fixed_reminder(
    reminder_type: str,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if reminder_type not in REMINDER_TYPES:
        raise HTTPException(404, "Unknown reminder type")
    if not settings.reminder_cron_secret:
        raise HTTPException(503, "Reminder cron is not configured")
    if authorization != f"Bearer {settings.reminder_cron_secret}":
        raise HTTPException(401, "Invalid reminder processor token")

    today = _today_ist_key()
    users = db.execute(select(PushSubscription.user_id).where(PushSubscription.enabled == True).distinct()).all()  # noqa: E712
    payload = _payload_for(reminder_type)
    stats = {
        "users": 0,
        "attempted_subscriptions": 0,
        "delivered": 0,
        "sent": 0,
        "skipped": 0,
        "subscriptions_disabled": 0,
        "delivery_errors": 0,
        "errors": [],
    }

    for (user_id,) in users:
        reminder_settings = _settings_for_user(db, int(user_id))
        if not reminder_settings["enabled"] or not reminder_settings["types"].get(
            reminder_type, DEFAULT_REMINDER_SETTINGS["types"].get(reminder_type, True)
        ):
            stats["skipped"] += 1
            continue
        sent_key = f"{REMINDER_SENT_KEY_PREFIX}:{today}:{reminder_type}"
        if get_setting(db, sent_key, user_id=int(user_id)):
            stats["skipped"] += 1
            continue

        result = _send_to_user(db, int(user_id), payload)
        stats["users"] += 1
        stats["attempted_subscriptions"] += int(result["subscriptions"])
        stats["delivered"] += int(result["delivered"])
        stats["sent"] += 1 if result["delivered"] > 0 else 0
        stats["subscriptions_disabled"] += int(result["disabled"])
        stats["delivery_errors"] += int(result["error_count"])
        stats["errors"].extend(result["errors"])
        if result["delivered"] > 0:
            set_setting(db, sent_key, json.dumps({"sent_at": _now_utc().isoformat()}), user_id=int(user_id))

    stats["errors"] = stats["errors"][:3]
    if stats["attempted_subscriptions"] > 0 and stats["delivered"] == 0 and stats["delivery_errors"] > 0:
        raise HTTPException(status_code=502, detail={"message": "Push delivery failed", "stats": stats})

    return stats
