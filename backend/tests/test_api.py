import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine, SessionLocal, init_db
from app.main import app


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
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
