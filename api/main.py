from __future__ import annotations

from heapq import heappop, heappush
from math import asin, cos, radians, sin, sqrt
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

MARS_RADIUS_KM = 3389.5


class Coordinate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=360)
    name: str | None = None


class MissionConfig(BaseModel):
    crew: int = Field(2, ge=1, le=12)
    speed_kmh: float = Field(4.5, gt=0, le=50)
    oxygen_kg: float = Field(18, ge=0)
    oxygen_kg_per_person_hour: float = Field(0.084, gt=0)
    energy_kwh: float = Field(45, ge=0)
    energy_kwh_per_hour: float = Field(1.2, gt=0)
    reserve_percent: float = Field(20, ge=0, lt=100)
    max_hours: float = Field(18, gt=0)
    science_hours: float = Field(1.5, ge=0)
    contingency_percent: float = Field(15, ge=0, le=200)
    return_required: bool = True


class RouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    waypoints: list[Coordinate] = Field(default_factory=list, max_length=20)
    strategy: Literal["direct", "conservative", "science", "limited"] = "direct"


class RouteResult(BaseModel):
    coordinates: list[Coordinate]
    distance_km: float
    strategy: str
    quality: Literal["global-geometric", "mola-evaluated", "high-resolution-dem"]
    terrain_evaluated: bool
    warnings: list[str]


class CompareRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    strategies: list[Literal["direct", "conservative", "science", "limited"]] = ["direct", "conservative", "science", "limited"]


class MissionRequest(BaseModel):
    route: RouteResult
    config: MissionConfig = MissionConfig()


class SimulationRequest(MissionRequest):
    steps: int = Field(30, ge=2, le=1000)


def normalize_lon(lon: float) -> float:
    return (lon + 540) % 360 - 180


def distance_km(a: Coordinate, b: Coordinate) -> float:
    p1, p2 = radians(a.lat), radians(b.lat)
    dp, dl = radians(b.lat - a.lat), radians(normalize_lon(b.lon - a.lon))
    h = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * MARS_RADIUS_KM * asin(min(1, sqrt(h)))


def route_distance(points: list[Coordinate]) -> float:
    return sum(distance_km(points[i], points[i + 1]) for i in range(len(points) - 1))


def plan_route(req: RouteRequest) -> RouteResult:
    points = [req.origin, *req.waypoints, req.destination]
    warnings = ["Global geometric route only; terrain hazards and local obstacles are not evaluated."]
    if req.strategy in {"conservative", "science"} and not req.waypoints:
        warnings.append(f"{req.strategy.title()} behavior requires terrain/objective data; the great-circle route is returned unchanged.")
    return RouteResult(coordinates=points, distance_km=route_distance(points), strategy=req.strategy,
                       quality="global-geometric", terrain_evaluated=False, warnings=warnings)


def evaluate(route: RouteResult, c: MissionConfig) -> dict:
    total_distance = route.distance_km * (2 if c.return_required else 1)
    travel_hours = total_distance / c.speed_kmh
    duration = travel_hours + c.science_hours
    factor = 1 + c.contingency_percent / 100
    oxygen_used = duration * c.crew * c.oxygen_kg_per_person_hour * factor
    energy_used = duration * c.energy_kwh_per_hour * factor
    oxygen_left, energy_left = c.oxygen_kg - oxygen_used, c.energy_kwh - energy_used
    checks = {
        "oxygen": oxygen_left >= c.oxygen_kg * c.reserve_percent / 100,
        "energy": energy_left >= c.energy_kwh * c.reserve_percent / 100,
        "time": duration <= c.max_hours,
    }
    return {"distance_km": total_distance, "duration_hours": duration, "travel_hours": travel_hours,
            "oxygen_used_kg": oxygen_used, "oxygen_remaining_kg": oxygen_left,
            "energy_used_kwh": energy_used, "energy_remaining_kwh": energy_left,
            "constraints": checks, "feasible_within_model": all(checks.values()),
            "terrain_status": "insufficient-data", "disclaimer": "Educational planning estimate; not medical or operational certification."}


def astar(costs: list[list[float]], start: tuple[int, int], goal: tuple[int, int]) -> list[tuple[int, int]]:
    """Deterministic 4-neighbor A* for local DEM cost grids; non-finite cells are blocked."""
    rows, cols = len(costs), len(costs[0]) if costs else 0
    if not rows or not (0 <= start[0] < rows and 0 <= start[1] < cols and 0 <= goal[0] < rows and 0 <= goal[1] < cols):
        raise ValueError("Invalid grid or endpoints")
    frontier: list[tuple[float, tuple[int, int]]] = [(0, start)]
    came: dict[tuple[int, int], tuple[int, int]] = {}
    score = {start: 0.0}
    while frontier:
        _, current = heappop(frontier)
        if current == goal:
            path = [current]
            while current in came:
                current = came[current]
                path.append(current)
            return list(reversed(path))
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = current[0] + dr, current[1] + dc
            if not (0 <= nxt[0] < rows and 0 <= nxt[1] < cols):
                continue
            step = costs[nxt[0]][nxt[1]]
            if step != step or step == float("inf"):
                continue
            candidate = score[current] + max(0, step)
            if candidate < score.get(nxt, float("inf")):
                score[nxt], came[nxt] = candidate, current
                heuristic = abs(goal[0] - nxt[0]) + abs(goal[1] - nxt[1])
                heappush(frontier, (candidate + heuristic, nxt))
    raise ValueError("No traversable route")


app = FastAPI(title="Mars Survival API", version="0.1.0", description="Transparent educational Mars expedition planning services")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health(): return {"status": "ok", "service": "mars-survival", "version": app.version}


@app.get("/api/regions")
def regions(): return {"coordinate_convention": "planetocentric latitude, east-positive longitude", "items": LOCATIONS}


@app.get("/api/layers")
def layers():
    return {"items": [{"id": "mola-hillshade", "name": "MGS MOLA Global Color Hillshade", "type": "WMTS", "coverage": "global", "resolution_m": 463, "source": "NASA Mars Trek", "projection": "EPSG:104905"}]}


@app.get("/api/terrain/elevation")
def elevation(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=360)):
    raise HTTPException(501, detail={"code": "dem_not_configured", "message": "MOLA numeric DEM access is not configured; no elevation is fabricated.", "coordinate": [lon, lat]})


@app.get("/api/terrain/profile")
def profile():
    raise HTTPException(501, detail={"code": "dem_not_configured", "message": "Route elevation profile requires a configured numeric MOLA/DEM source."})


@app.post("/api/routes/plan", response_model=RouteResult)
def routes_plan(req: RouteRequest): return plan_route(req)


@app.post("/api/routes/compare", response_model=list[RouteResult])
def routes_compare(req: CompareRequest): return [plan_route(RouteRequest(origin=req.origin, destination=req.destination, strategy=s)) for s in req.strategies]


@app.post("/api/mission/evaluate")
def mission_evaluate(req: MissionRequest): return evaluate(req.route, req.config)


@app.post("/api/mission/simulate")
def mission_simulate(req: SimulationRequest):
    result = evaluate(req.route, req.config)
    return {"summary": result, "timeline": [{"fraction": i/(req.steps-1), "hours": result["duration_hours"]*i/(req.steps-1), "oxygen_remaining_kg": req.config.oxygen_kg-result["oxygen_used_kg"]*i/(req.steps-1), "energy_remaining_kwh": req.config.energy_kwh-result["energy_used_kwh"]*i/(req.steps-1)} for i in range(req.steps)]}


LOCATIONS = [
    {"id": "olympus", "name": "Olympus Mons", "lat": 18.65, "lon": -133.8, "type": "volcano"},
    {"id": "valles", "name": "Valles Marineris", "lat": -13.9, "lon": -59.2, "type": "canyon"},
    {"id": "jezero", "name": "Jezero Crater", "lat": 18.38, "lon": 77.58, "type": "crater"},
    {"id": "gale", "name": "Gale Crater", "lat": -5.4, "lon": 137.8, "type": "crater"},
]


@app.get("/api/science/locations")
def science_locations(): return {"items": LOCATIONS, "provenance": "Curated named features; verify mission-critical coordinates against USGS Gazetteer."}


@app.get("/api/datasets/status")
def datasets_status():
    return {"items": [{"id": "mars-trek-wmts", "status": "configured", "purpose": "visual basemap"}, {"id": "mola-megdr", "status": "catalogued-not-mounted", "purpose": "numeric elevation"}], "checked_at": None}
