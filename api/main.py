from __future__ import annotations

import hashlib
import json
import logging
import os
import random
from heapq import heappop, heappush
from math import asin, cos, radians, sin, sqrt
from statistics import quantiles
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

MARS_RADIUS_KM = 3389.5
logger = logging.getLogger("redreturn.ai")
AI_RUNTIME_STATUS: dict[str, str] = {"state": "not_configured"}


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
    water_liters: float = Field(12, ge=0)
    water_liters_per_person_day: float = Field(2.5, gt=0)
    radiation_msv_per_hour: float = Field(0.025, ge=0)
    max_radiation_msv: float = Field(1, gt=0)
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


class AresRequest(MissionRequest):
    question: str = Field("", max_length=500)
    runs: int = Field(1200, ge=100, le=5000)


class AresLanguage(BaseModel):
    headline: str = Field(max_length=80)
    briefing: str = Field(max_length=500)
    answer: str = Field(max_length=700)


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
    water_used = duration / 24 * c.crew * c.water_liters_per_person_day * factor
    radiation = duration * c.radiation_msv_per_hour
    oxygen_left, energy_left, water_left = c.oxygen_kg - oxygen_used, c.energy_kwh - energy_used, c.water_liters - water_used
    checks = {
        "oxygen": oxygen_left >= c.oxygen_kg * c.reserve_percent / 100,
        "energy": energy_left >= c.energy_kwh * c.reserve_percent / 100,
        "water": water_left >= c.water_liters * c.reserve_percent / 100,
        "radiation": radiation <= c.max_radiation_msv,
        "time": duration <= c.max_hours,
    }
    return {"distance_km": total_distance, "duration_hours": duration, "travel_hours": travel_hours,
            "oxygen_used_kg": oxygen_used, "oxygen_remaining_kg": oxygen_left,
            "energy_used_kwh": energy_used, "energy_remaining_kwh": energy_left,
            "water_used_liters": water_used, "water_remaining_liters": water_left,
            "radiation_msv": radiation,
            "constraints": checks, "feasible_within_model": all(checks.values()),
            "terrain_status": "insufficient-data", "disclaimer": "Educational planning estimate; not medical or operational certification."}


def _percentile(values: list[float], percentile: int) -> float:
    """Inclusive percentile, stable for the minimum supported sample count."""
    return quantiles(values, n=100, method="inclusive")[percentile - 1]


def analyze_uncertainty(req: AresRequest) -> dict:
    """Reproducible scenario analysis. Inputs are assumptions, never forecasts."""
    seed_material = req.model_dump_json(exclude={"question"})
    seed = int(hashlib.sha256(seed_material.encode()).hexdigest()[:16], 16)
    rng = random.Random(seed)
    pass_counts = {key: 0 for key in ("oxygen", "energy", "water", "radiation", "time")}
    durations: list[float] = []
    margins: list[float] = []
    successes = 0

    for _ in range(req.runs):
        c = req.config.model_copy(update={
            "speed_kmh": max(0.5, req.config.speed_kmh * (1 + rng.gauss(0, .15))),
            "oxygen_kg_per_person_hour": req.config.oxygen_kg_per_person_hour * max(.6, 1 + rng.gauss(0, .12)),
            "energy_kwh_per_hour": req.config.energy_kwh_per_hour * max(.6, 1 + rng.gauss(0, .12)),
            "water_liters_per_person_day": req.config.water_liters_per_person_day * max(.6, 1 + rng.gauss(0, .12)),
            "radiation_msv_per_hour": req.config.radiation_msv_per_hour * max(.35, 1 + rng.gauss(0, .25)),
        })
        result = evaluate(req.route, c)
        durations.append(result["duration_hours"])
        normalized_margins = [
            (result["oxygen_remaining_kg"] - c.oxygen_kg * c.reserve_percent / 100) / max(c.oxygen_kg, .001),
            (result["energy_remaining_kwh"] - c.energy_kwh * c.reserve_percent / 100) / max(c.energy_kwh, .001),
            (result["water_remaining_liters"] - c.water_liters * c.reserve_percent / 100) / max(c.water_liters, .001),
            (c.max_hours - result["duration_hours"]) / c.max_hours,
            (c.max_radiation_msv - result["radiation_msv"]) / c.max_radiation_msv,
        ]
        margins.append(min(normalized_margins) * 100)
        for key, passed in result["constraints"].items():
            pass_counts[key] += int(passed)
        successes += int(result["feasible_within_model"])

    probabilities = {key: round(value / req.runs * 100, 2) for key, value in pass_counts.items()}
    critical = min(probabilities, key=probabilities.get)  # type: ignore[arg-type]
    survival = round(successes / req.runs * 100, 2)
    duration_p90 = _percentile(durations, 90)
    c = req.config
    contingency = 1 + c.contingency_percent / 100
    reserve_factor = max(.05, 1 - c.reserve_percent / 100)
    requirements = {
        "oxygen": duration_p90 * c.crew * c.oxygen_kg_per_person_hour * contingency / reserve_factor,
        "energy": duration_p90 * c.energy_kwh_per_hour * contingency / reserve_factor,
        "water": duration_p90 / 24 * c.crew * c.water_liters_per_person_day * contingency / reserve_factor,
    }
    actions: list[dict] = []
    if c.oxygen_kg < requirements["oxygen"] * 1.02:
        target = int(requirements["oxygen"] + .999)
        actions.append({"id": "oxygen", "label": f"Subir O₂ a {target} kg", "rationale": "Cubre el consumo del percentil 90 sin invadir la reserva configurada.", "configPatch": {"oxygenKg": target}})
    if c.energy_kwh < requirements["energy"] * 1.02:
        target = int(requirements["energy"] + .999)
        actions.append({"id": "energy", "label": f"Subir energía a {target} kWh", "rationale": "Protege el presupuesto energético frente a demoras y variación de consumo.", "configPatch": {"energyKwh": target}})
    if c.water_liters < requirements["water"] * 1.02:
        target = int(requirements["water"] + .999)
        actions.append({"id": "water", "label": f"Subir agua a {target} L", "rationale": "Mantiene la reserva de agua en el escenario lento del percentil 90.", "configPatch": {"waterLiters": target}})
    if c.max_hours < duration_p90:
        target = int(duration_p90 + .999)
        actions.append({"id": "time", "label": f"Ampliar ventana a {target} h", "rationale": "Evita que una reducción plausible de velocidad invalide la ventana operativa.", "configPatch": {"maxHours": target}})
    radiation_p90 = duration_p90 * c.radiation_msv_per_hour * 1.32
    if radiation_p90 > c.max_radiation_msv:
        science_target = max(0, round(c.science_hours - min(1, c.science_hours), 1))
        actions.append({"id": "radiation", "label": "Reducir duración o exposición", "rationale": f"La dosis conservadora ronda {radiation_p90:.2f} mSv; aumentar el límite no reduce el riesgo físico.", "configPatch": {"scienceHours": science_target}})
    actions.sort(key=lambda action: probabilities.get(action["id"], 100))

    factor_es = {"oxygen": "oxígeno", "energy": "energía", "water": "agua", "radiation": "radiación", "time": "tiempo"}
    headline = "Misión robusta" if survival >= 90 else "Misión sensible" if survival >= 60 else "Misión no autorizable"
    briefing = f"{req.runs:,} futuros plausibles evaluados. {survival:.0f}% conserva simultáneamente recursos, tiempo y dosis dentro de los límites."
    question = req.question.lower().strip()
    if any(word in question for word in ("mejor", "optim", "cambiar", "recom")) and actions:
        answer = f"La mejora de mayor impacto es: {actions[0]['label']}. {actions[0]['rationale']}"
    else:
        answer = f"ARES estima {survival:.0f}% de éxito bajo las variaciones simuladas. El cuello de botella es {factor_es[critical]}."

    return {
        "mode": "local", "runs": req.runs, "survivalProbability": survival,
        "confidence": {"durationP10": round(_percentile(durations, 10), 2), "durationP90": round(duration_p90, 2), "marginP10": round(_percentile(margins, 10), 2), "marginP90": round(_percentile(margins, 90), 2)},
        "constraintProbabilities": probabilities, "criticalFactor": critical,
        "headline": headline, "briefing": briefing, "answer": answer, "actions": actions[:4],
        "caveats": [
            "Las distribuciones representan supuestos de escenario, no pronósticos medidos.",
            "No hay DEM numérico: pendiente, rocas y transitabilidad siguen sin evaluar.",
            "La radiación usa una tasa constante editable, no meteorología espacial en tiempo real.",
        ],
    }


def enrich_with_openai(analysis: dict, question: str) -> dict:
    """Let the model communicate verified facts; never let it replace the calculator."""
    global AI_RUNTIME_STATUS
    if not os.getenv("OPENAI_API_KEY"):
        AI_RUNTIME_STATUS = {"state": "not_configured"}
        return analysis
    try:
        from openai import OpenAI

        client = OpenAI(timeout=20, max_retries=1)
        facts = {key: value for key, value in analysis.items() if key not in {"headline", "briefing", "answer"}}
        response = client.responses.parse(
            model=os.getenv("OPENAI_MODEL", "gpt-6-astra"),
            store=False,
            input=[
                {"role": "system", "content": "Eres ARES, copiloto de una misión educativa a Marte. Responde en español claro y conciso. Usa únicamente los hechos calculados suministrados. Nunca declares que una misión es segura ni inventes terreno, clima o telemetría. Distingue simulación de medición."},
                {"role": "user", "content": json.dumps({"facts": facts, "question": question or "Resume el riesgo y la mejor acción."}, ensure_ascii=False)},
            ],
            text_format=AresLanguage,
        )
        if response.output_parsed:
            language = response.output_parsed
            AI_RUNTIME_STATUS = {"state": "ready", "model": os.getenv("OPENAI_MODEL", "gpt-6-astra")}
            return {**analysis, "mode": "openai", "model": os.getenv("OPENAI_MODEL", "gpt-6-astra"), **language.model_dump()}
    except Exception as exc:
        # The mission calculator remains available if credentials, quota or network fail.
        # This is safe to expose locally: it never includes the credential itself.
        detail = f"{type(exc).__name__}: {exc}"
        AI_RUNTIME_STATUS = {"state": "error", "detail": detail}
        logger.warning("ARES generative briefing unavailable: %s", detail)
        return {**analysis, "ai_error": detail}
    AI_RUNTIME_STATUS = {"state": "empty_response"}
    return {**analysis, "ai_error": "The configured model returned no structured response."}


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


app = FastAPI(title="RedReturn API", version="0.2.0", description="Transparent educational Mars expedition planning and ARES intelligence services")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "redreturn", "version": app.version,
            "features": {"ares": True, "generative_ai": bool(os.getenv("OPENAI_API_KEY"))},
            "ai_runtime": AI_RUNTIME_STATUS}


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


@app.post("/api/ai/mission-copilot")
def mission_copilot(req: AresRequest):
    """Hybrid AI: auditable Monte Carlo facts plus optional structured language generation."""
    return enrich_with_openai(analyze_uncertainty(req), req.question)


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
