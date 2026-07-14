import os
import json

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine, init_db, _migrate_single_diary_reminder_settings
from app.limiter import limiter
from app.main import app
from app.models import PushSubscription, Setting


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    limiter._storage.reset()
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_capture_flow(client):
    person = client.post("/api/people", json={"name": "Alex", "notes": "colleague"}).json()
    interaction = client.post(
        "/api/interactions",
        json={
            "observation": "Delayed follow-up under deadline pressure",
            "context": "Sprint planning",
            "confidence": 0.6,
            "duration_minutes": 45,
            "participant_ids": [person["id"]],
            "tag_names": ["work", "deadline"],
        },
    ).json()
    assert interaction["observation"].startswith("Delayed")
    assert interaction["duration_minutes"] == 45
    assert len(interaction["tags"]) == 2

    search = client.get("/api/search", params={"q": "deadline"}).json()
    assert len(search["interactions"]) >= 1

    summary = client.get("/api/summary").json()
    assert summary["total_interactions"] == 1
    assert summary["total_people"] == 1


def test_dimensions_persist(client):
    payload = {"values": {"urgency": 0.8, "effort": 0.3}}
    client.put("/api/settings/dimensions", json=payload)
    saved = client.get("/api/settings/dimensions").json()
    assert saved["values"]["urgency"] == 0.8
    assert saved["values"]["reversibility"] is None


def test_auth_register_login(client):
    reg = client.post(
        "/api/auth/register",
        json={"username": "sam", "password": "secret12"},
    )
    assert reg.status_code == 201
    token = reg.json()["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["username"] == "sam"

    login = client.post(
        "/api/auth/login",
        json={"username": "sam", "password": "secret12"},
    )
    assert login.status_code == 200


def test_relationship_defaults(client):
    defaults = client.get("/api/relationship-defaults").json()
    assert "colleague" in defaults["types"]
    assert "notes" in defaults["defaults"]["friend"]


def test_person_with_relationship(client):
    person = client.post(
        "/api/people",
        json={"name": "Jordan", "relationship": "colleague", "notes": "Team lead"},
    ).json()
    assert person["relationship"] == "colleague"


def test_encrypted_export_import(client):
    # Register a user so import (which requires auth) works
    reg = client.post("/api/auth/register", json={"username": "exporter", "password": "secret99"})
    token = reg.json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    client.post("/api/people", json={"name": "Alex"}, headers=auth)
    blob = client.post("/api/sync/export", json={"passphrase": "local-only-secret"}, headers=auth).json()
    assert blob["format"] == "canopy-encrypted-export"

    result = client.post(
        "/api/sync/import",
        json={"passphrase": "local-only-secret", "blob": blob},
        headers=auth,
    ).json()
    assert result["status"] == "merged"
    assert result["created"]["people"] == 0  # Alex already exists; upsert skips duplicate
    assert result["skipped"]["people"] == 1


def test_logout(client):
    token = client.post(
        "/api/auth/register", json={"username": "logoutuser", "password": "pass1234"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    # Token works before logout
    assert client.get("/api/auth/me", headers=auth).status_code == 200

    # Logout invalidates the session
    r = client.delete("/api/auth/logout", headers=auth)
    assert r.status_code == 204

    # Token is now rejected
    assert client.get("/api/auth/me", headers=auth).status_code == 401


def test_encrypted_export_import_roundtrip(client):
    reg = client.post("/api/auth/register", json={"username": "roundtrip", "password": "secret99"})
    token = reg.json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    client.post("/api/people", json={"name": "RoundtripPerson"}, headers=auth)
    blob = client.post("/api/sync/export", json={"passphrase": "strongpass1"}, headers=auth).json()
    assert blob["format"] == "canopy-encrypted-export"
    assert blob["cipher"] == "aes-gcm-256"

    result = client.post(
        "/api/sync/import",
        json={"passphrase": "strongpass1", "blob": blob},
        headers=auth,
    ).json()
    assert result["status"] == "merged"
    assert result["skipped"]["people"] == 1  # already exists


def test_user_isolation(client):
    """Each user sees only their own data."""
    # Register two users
    token_a = client.post(
        "/api/auth/register", json={"username": "alice", "password": "alicepass1"}
    ).json()["token"]
    token_b = client.post(
        "/api/auth/register", json={"username": "bob", "password": "bobpass123"}
    ).json()["token"]
    auth_a = {"Authorization": f"Bearer {token_a}"}
    auth_b = {"Authorization": f"Bearer {token_b}"}

    # Alice creates a person and interaction
    alice_person = client.post("/api/people", json={"name": "Alice Contact"}, headers=auth_a).json()
    client.post(
        "/api/interactions",
        json={"observation": "Alice's private note", "participant_ids": [alice_person["id"]]},
        headers=auth_a,
    )

    # Bob creates a person and interaction
    bob_person = client.post("/api/people", json={"name": "Bob Contact"}, headers=auth_b).json()
    client.post(
        "/api/interactions",
        json={"observation": "Bob's private note", "participant_ids": [bob_person["id"]]},
        headers=auth_b,
    )

    # Alice should see only her data
    alice_people = client.get("/api/people", headers=auth_a).json()
    assert len(alice_people) == 1
    assert alice_people[0]["name"] == "Alice Contact"

    alice_interactions = client.get("/api/interactions", headers=auth_a).json()
    assert len(alice_interactions) == 1
    assert alice_interactions[0]["observation"] == "Alice's private note"

    # Bob should see only his data
    bob_people = client.get("/api/people", headers=auth_b).json()
    assert len(bob_people) == 1
    assert bob_people[0]["name"] == "Bob Contact"

    bob_interactions = client.get("/api/interactions", headers=auth_b).json()
    assert len(bob_interactions) == 1
    assert bob_interactions[0]["observation"] == "Bob's private note"

    # Alice cannot access Bob's person by ID
    r = client.get(f"/api/people/{bob_person['id']}", headers=auth_a)
    assert r.status_code == 404

    # Summaries are isolated too
    alice_summary = client.get("/api/summary", headers=auth_a).json()
    assert alice_summary["total_interactions"] == 1
    assert alice_summary["total_people"] == 1


def test_interaction_rejects_foreign_participant(client):
    token_a = client.post(
        "/api/auth/register", json={"username": "owner-a", "password": "alicepass1"}
    ).json()["token"]
    token_b = client.post(
        "/api/auth/register", json={"username": "owner-b", "password": "bobpass123"}
    ).json()["token"]
    auth_a = {"Authorization": f"Bearer {token_a}"}
    auth_b = {"Authorization": f"Bearer {token_b}"}

    bob_person = client.post("/api/people", json={"name": "Bob Contact"}, headers=auth_b).json()

    r = client.post(
        "/api/interactions",
        json={"observation": "Should not attach Bob's person", "participant_ids": [bob_person["id"]]},
        headers=auth_a,
    )
    assert r.status_code == 404
    assert client.get("/api/interactions", headers=auth_a).json() == []


def test_interaction_patch_can_clear_nullable_fields(client):
    person = client.post("/api/people", json={"name": "Pat"}).json()
    interaction = client.post(
        "/api/interactions",
        json={
            "observation": "Has nullable fields",
            "context": "Office",
            "outcome": "Follow up",
            "energy": 0.8,
            "duration_minutes": 25,
            "reflection": {"felt_good": "Yes"},
            "participant_ids": [person["id"]],
        },
    ).json()

    patched = client.patch(
        f"/api/interactions/{interaction['id']}",
        json={"context": None, "outcome": None, "energy": None, "duration_minutes": 60, "reflection": None},
    ).json()

    assert patched["context"] is None
    assert patched["outcome"] is None
    assert patched["energy"] is None
    assert patched["duration_minutes"] == 60
    assert patched["reflection"] is None


def test_energy_timeline_scales_delta_by_duration(client):
    token = client.post(
        "/api/auth/register", json={"username": "duration-user", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    client.post(
        "/api/interactions",
        json={"observation": "Short draining interaction", "energy": 0.3, "duration_minutes": 30},
        headers=auth,
    )
    client.post(
        "/api/interactions",
        json={"observation": "Long draining interaction", "energy": 0.3, "duration_minutes": 120},
        headers=auth,
    )

    events = client.get("/api/sync/energy/timeline", headers=auth).json()["events"]
    short = next(e for e in events if e["note"].startswith("Short"))
    long = next(e for e in events if e["note"].startswith("Long"))

    assert short["duration_minutes"] == 30
    assert long["duration_minutes"] == 120
    assert long["delta"] < short["delta"]
    assert abs(long["delta"]) == pytest.approx(abs(short["delta"]) * 2, abs=0.002)


def test_interactions_invalid_date_returns_400(client):
    r = client.get("/api/interactions", params={"from_date": "2026-99-99"})
    assert r.status_code == 400
    assert r.json()["detail"] == "from_date must be YYYY-MM-DD"


def test_delete_data_is_scoped_to_current_user(client):
    token_a = client.post(
        "/api/auth/register", json={"username": "clear-a", "password": "alicepass1"}
    ).json()["token"]
    token_b = client.post(
        "/api/auth/register", json={"username": "clear-b", "password": "bobpass123"}
    ).json()["token"]
    auth_a = {"Authorization": f"Bearer {token_a}"}
    auth_b = {"Authorization": f"Bearer {token_b}"}

    alice_person = client.post("/api/people", json={"name": "Alice Contact"}, headers=auth_a).json()
    bob_person = client.post("/api/people", json={"name": "Bob Contact"}, headers=auth_b).json()
    client.post(
        "/api/interactions",
        json={"observation": "Alice private", "participant_ids": [alice_person["id"]], "tag_names": ["alice-only"]},
        headers=auth_a,
    )
    client.post(
        "/api/interactions",
        json={"observation": "Bob private", "participant_ids": [bob_person["id"]], "tag_names": ["bob-only"]},
        headers=auth_b,
    )

    assert client.delete("/api/data", headers=auth_a).status_code == 204

    alice_summary = client.get("/api/summary", headers=auth_a).json()
    bob_summary = client.get("/api/summary", headers=auth_b).json()
    assert alice_summary["total_interactions"] == 0
    assert alice_summary["total_people"] == 0
    assert bob_summary["total_interactions"] == 1
    assert bob_summary["total_people"] == 1
    assert client.get("/api/auth/me", headers=auth_a).status_code == 200


def test_dynamic_gets_are_not_browser_cached(client):
    r = client.get("/api/summary")
    assert r.headers["cache-control"] == "no-store"

    defaults = client.get("/api/relationship-defaults")
    assert defaults.headers["cache-control"] == "public, max-age=86400"


def test_interactions_pagination(client):
    person = client.post("/api/people", json={"name": "Pat"}).json()
    for i in range(5):
        client.post(
            "/api/interactions",
            json={
                "observation": f"Note {i}",
                "participant_ids": [person["id"]],
            },
        )

    plain = client.get("/api/interactions", params={"limit": 2, "offset": 1}).json()
    assert isinstance(plain, list)
    assert len(plain) == 2

    page1 = client.get("/api/interactions", params={"page": 1, "limit": 2}).json()
    assert page1["total"] == 5
    assert page1["page"] == 1
    assert page1["limit"] == 2
    assert page1["pages"] == 3
    assert len(page1["items"]) == 2

    page3 = client.get("/api/interactions", params={"page": 3, "limit": 2}).json()
    assert len(page3["items"]) == 1


def test_people_pagination(client):
    for i in range(5):
        client.post("/api/people", json={"name": f"Person {i}"})

    plain = client.get("/api/people").json()
    assert isinstance(plain, list)
    assert len(plain) == 5

    page1 = client.get("/api/people", params={"page": 1, "limit": 2}).json()
    assert page1["total"] == 5
    assert page1["page"] == 1
    assert len(page1["items"]) == 2

    page3 = client.get("/api/people", params={"page": 3, "limit": 2}).json()
    assert len(page3["items"]) == 1


def test_patterns_endpoint(client):
    r = client.get("/api/ai/patterns")
    assert r.status_code == 200
    data = r.json()
    assert "insights" in data
    assert "recurring_tags" in data
    assert "stale_contacts" in data


def test_synthesize_endpoint_get_and_post(client):
    for method in ("get", "post"):
        r = getattr(client, method)("/api/ai/synthesize", params={"days": 7})
        assert r.status_code == 200
        data = r.json()
        assert data["days"] == 7
        assert "summary" in data


def test_cors_allows_github_pages_without_credentials(client):
    """GitHub Pages uses cross-origin fetch + Bearer token; credentials must stay off."""
    r = client.options(
        "/api/ai/patterns",
        headers={
            "Origin": "https://sameeradsv.github.io",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "https://sameeradsv.github.io"
    assert r.headers.get("access-control-allow-credentials") not in ("true", "True")


def test_notification_subscription_and_settings(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.vapid_public_key", "public-key")
    token = client.post(
        "/api/auth/register", json={"username": "notify-user", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    key = client.get("/api/notifications/vapid-public-key").json()
    assert key["public_key"] == "public-key"

    subscribed = client.post(
        "/api/notifications/subscribe",
        headers=auth,
        json={
            "endpoint": "https://push.example/device",
            "keys": {"p256dh": "p256", "auth": "auth"},
            "device_name": "Phone",
            "platform": "iOS",
        },
    )
    assert subscribed.status_code == 201
    assert subscribed.json()["enabled"] is True

    settings_payload = {
        "enabled": True,
        "time": "20:30",
    }
    saved = client.put("/api/notifications/reminder-settings", headers=auth, json=settings_payload)
    assert saved.status_code == 200
    assert saved.json()["time"] == "20:30"
    assert client.get("/api/notifications/reminder-settings", headers=auth).json()["enabled"] is True


def test_notification_subscribe_disables_stale_matching_endpoint(client):
    token = client.post(
        "/api/auth/register", json={"username": "notify-dedupe", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    first = client.post(
        "/api/notifications/subscribe",
        headers=auth,
        json={
            "endpoint": "https://push.example/old-phone",
            "keys": {"p256dh": "old", "auth": "old"},
            "device_name": "Phone",
            "platform": "iOS",
        },
    )
    second = client.post(
        "/api/notifications/subscribe",
        headers=auth,
        json={
            "endpoint": "https://push.example/new-phone",
            "keys": {"p256dh": "new", "auth": "new"},
            "device_name": "Phone",
            "platform": "iOS",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201
    with engine.connect() as conn:
        rows = {
            row["endpoint"]: bool(row["enabled"])
            for row in conn.execute(PushSubscription.__table__.select()).mappings()
        }
    assert rows["https://push.example/old-phone"] is False
    assert rows["https://push.example/new-phone"] is True


def test_default_reminder_times_and_rotating_copy(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.vapid_public_key", "public-key")
    token = client.post(
        "/api/auth/register", json={"username": "notify-defaults", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    client.post(
        "/api/notifications/subscribe",
        headers=auth,
        json={
            "endpoint": "https://push.example/defaults",
            "keys": {"p256dh": "p256", "auth": "auth"},
        },
    )

    settings = client.get("/api/notifications/reminder-settings", headers=auth).json()
    assert settings == {"enabled": True, "time": "21:30"}

    from app.routers.notifications import _payload_for

    payload = _payload_for()
    assert payload["title"] in {
        "Evening interaction check-in",
        "Evening reflection",
        "Canopy diary note",
    }
    assert payload["body"]


def test_migration_normalizes_legacy_reminder_settings():
    with engine.begin() as conn:
        conn.execute(Setting.__table__.insert(), [
            {
                "key": "1:notification_reminders",
                "value": json.dumps({
                    "enabled": True,
                    "times": {"morning": "11:00", "afternoon": "17:00", "evening": "22:00"},
                    "types": {"morning": False, "afternoon": False, "evening": True},
                }),
            },
            {
                "key": "2:notification_reminders",
                "value": json.dumps({
                    "enabled": True,
                    "times": {"morning": "10:00", "afternoon": "15:00", "evening": "20:30"},
                    "types": {"morning": False, "afternoon": False, "evening": True},
                }),
            },
            {
                "key": "3:notification_reminders",
                "value": json.dumps({"enabled": False, "time": "21:30"}),
            },
        ])

    _migrate_single_diary_reminder_settings()

    with engine.connect() as conn:
        rows = {
            row["key"]: json.loads(row["value"])
            for row in conn.execute(Setting.__table__.select()).mappings()
        }

    assert rows["1:notification_reminders"] == {"enabled": True, "time": "21:30"}
    assert rows["2:notification_reminders"] == {"enabled": True, "time": "20:30"}
    assert rows["3:notification_reminders"] == {"enabled": False, "time": "21:30"}


def test_subscribe_enables_default_evening_reminder_so_cron_does_not_skip(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.reminder_cron_secret", "cron-secret")
    token = client.post(
        "/api/auth/register", json={"username": "subscribe-reminder", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    client.post(
        "/api/notifications/subscribe",
        headers=auth,
        json={
            "endpoint": "https://push.example/subscribed",
            "keys": {"p256dh": "p256", "auth": "auth"},
        },
    )

    settings = client.get("/api/notifications/reminder-settings", headers=auth).json()
    assert settings["enabled"] is True

    sent = []

    def fake_send(sub, payload):
        sent.append((sub.endpoint, payload["reminderType"]))

    monkeypatch.setattr("app.routers.notifications.send_web_push", fake_send)
    r = client.post("/api/notifications/reminder", headers={"Authorization": "Bearer cron-secret"})

    assert r.status_code == 200
    assert r.json()["skipped"] == 0
    assert r.json()["attempted_subscriptions"] == 1
    assert r.json()["delivered"] == 1
    assert sent == [("https://push.example/subscribed", "diary")]


def test_typed_reminder_endpoints_are_removed(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.reminder_cron_secret", "cron-secret")

    assert client.post(
        "/api/notifications/reminder/morning", headers={"Authorization": "Bearer cron-secret"}
    ).status_code == 404
    assert client.post(
        "/api/notifications/reminder/afternoon", headers={"Authorization": "Bearer cron-secret"}
    ).status_code == 404


def test_fixed_reminder_sends_once_and_cleans_invalid_subscription(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.reminder_cron_secret", "cron-secret")
    token = client.post(
        "/api/auth/register", json={"username": "fixed-reminder", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}
    client.post(
        "/api/notifications/subscribe",
        headers=auth,
        json={
            "endpoint": "https://push.example/good",
            "keys": {"p256dh": "p256", "auth": "auth"},
        },
    )
    client.put(
        "/api/notifications/reminder-settings",
        headers=auth,
        json={
            "enabled": True,
            "time": "20:00",
        },
    )

    sent = []

    def fake_send(sub, payload):
        sent.append((sub.endpoint, payload["reminderType"]))

    monkeypatch.setattr("app.routers.notifications.send_web_push", fake_send)
    cron = {"Authorization": "Bearer cron-secret"}
    first = client.post("/api/notifications/reminder", headers=cron)
    second = client.post("/api/notifications/reminder", headers=cron)

    assert first.status_code == 200
    assert first.json()["sent"] == 1
    assert second.json()["sent"] == 0
    assert sent == [("https://push.example/good", "diary")]


def test_fixed_reminder_fails_when_all_push_delivery_fails(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.reminder_cron_secret", "cron-secret")
    token = client.post(
        "/api/auth/register", json={"username": "failed-reminder", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}
    client.post(
        "/api/notifications/subscribe",
        headers=auth,
        json={
            "endpoint": "https://push.example/failing",
            "keys": {"p256dh": "p256", "auth": "auth"},
        },
    )
    client.put(
        "/api/notifications/reminder-settings",
        headers=auth,
        json={
            "enabled": True,
            "time": "20:00",
        },
    )

    def fake_send(_sub, _payload):
        raise RuntimeError("push provider rejected the request")

    monkeypatch.setattr("app.routers.notifications.send_web_push", fake_send)
    r = client.post("/api/notifications/reminder", headers={"Authorization": "Bearer cron-secret"})

    assert r.status_code == 502
    detail = r.json()["detail"]
    assert detail["message"] == "Push delivery failed"
    assert detail["stats"]["attempted_subscriptions"] == 1
    assert detail["stats"]["delivered"] == 0
    assert detail["stats"]["delivery_errors"] == 1


def test_unsubscribe_disables_device(client):
    token = client.post(
        "/api/auth/register", json={"username": "unsub", "password": "secret99"}
    ).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}
    payload = {
        "endpoint": "https://push.example/device",
        "keys": {"p256dh": "p256", "auth": "auth"},
    }
    client.post("/api/notifications/subscribe", headers=auth, json=payload)
    r = client.post("/api/notifications/unsubscribe", headers=auth, json={"endpoint": payload["endpoint"]})
    assert r.status_code == 200
    rows = client.get("/api/notifications/subscriptions", headers=auth).json()
    assert rows[0]["enabled"] is False
