from fastapi.testclient import TestClient
from api.main import Coordinate, astar, distance_km, app

client = TestClient(app)

def test_health():
    assert client.get("/api/health").status_code == 200

def test_antimeridian_short_arc():
    assert distance_km(Coordinate(lat=0, lon=179), Coordinate(lat=0, lon=-179)) < 120

def test_astar_avoids_blocked_cell():
    path = astar([[1, 1, 1], [1, float("inf"), 1], [1, 1, 1]], (0, 0), (2, 2))
    assert (1, 1) not in path and path[0] == (0, 0) and path[-1] == (2, 2)

def test_elevation_is_honest_when_unconfigured():
    response = client.get("/api/terrain/elevation?lat=0&lon=0")
    assert response.status_code == 501

def test_impossible_mission():
    route = {"coordinates": [{"lat": 0, "lon": 0}, {"lat": 0, "lon": 1}], "distance_km": 59.16, "strategy": "direct", "quality": "global-geometric", "terrain_evaluated": False, "warnings": []}
    response = client.post("/api/mission/evaluate", json={"route": route, "config": {"oxygen_kg": 0, "energy_kwh": 0}})
    assert response.status_code == 200
    assert response.json()["feasible_within_model"] is False

def test_ares_is_reproducible_and_returns_actions():
    route = {"coordinates": [{"lat": 0, "lon": 0}, {"lat": 0, "lon": 1}], "distance_km": 59.16, "strategy": "direct", "quality": "global-geometric", "terrain_evaluated": False, "warnings": []}
    payload = {"route": route, "config": {"oxygen_kg": 1, "energy_kwh": 5}, "runs": 200, "question": "¿Qué debo mejorar?"}
    first = client.post("/api/ai/mission-copilot", json=payload)
    second = client.post("/api/ai/mission-copilot", json=payload)
    assert first.status_code == 200
    assert first.json()["survivalProbability"] == second.json()["survivalProbability"]
    assert first.json()["runs"] == 200
    assert first.json()["mode"] == "local"
    assert first.json()["actions"]
