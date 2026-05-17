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
