import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine, init_db
from app.limiter import limiter
from app.main import app


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
            "participant_ids": [person["id"]],
            "tag_names": ["work", "deadline"],
        },
    ).json()
    assert interaction["observation"].startswith("Delayed")
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
            "reflection": {"felt_good": "Yes"},
            "participant_ids": [person["id"]],
        },
    ).json()

    patched = client.patch(
        f"/api/interactions/{interaction['id']}",
        json={"context": None, "outcome": None, "energy": None, "reflection": None},
    ).json()

    assert patched["context"] is None
    assert patched["outcome"] is None
    assert patched["energy"] is None
    assert patched["reflection"] is None


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
