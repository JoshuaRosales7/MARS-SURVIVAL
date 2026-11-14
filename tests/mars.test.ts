import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, evaluateMission, greatCircleDistance, initialBearing, interpolateGreatCircle, normalizeLon } from "../lib/mars";
import { analyzeMissionRobustly } from "../lib/ares";
import { buildConceptualTerrain, conceptualElevationM } from "../lib/terrain";
import { LANDMARKS, MISSION_TEMPLATES, MARS_PLANETARY_FACTS, SURVIVAL_GUIDE_ITEMS } from "../data/mars";

describe("Mars geodesy", () => {
  it("returns zero for identical points", () => expect(greatCircleDistance({lat:0,lon:0},{lat:0,lon:0})).toBe(0));
  it("handles the antimeridian by shortest arc", () => expect(greatCircleDistance({lat:0,lon:179},{lat:0,lon:-179})).toBeLessThan(120));
  it("handles polar coordinates", () => expect(greatCircleDistance({lat:90,lon:0},{lat:90,lon:170})).toBeLessThan(1e-4));
  it("normalizes longitudes", () => { expect(normalizeLon(190)).toBe(-170); expect(normalizeLon(-190)).toBe(170); });
  it("interpolates finite points across antimeridian", () => expect(interpolateGreatCircle({lat:10,lon:179},{lat:12,lon:-179}).every(p=>Number.isFinite(p.lat+p.lon))).toBe(true));
  it("computes a cardinal initial bearing", () => expect(initialBearing({lat:0,lon:0},{lat:0,lon:10})).toBeCloseTo(90));
});

describe("Survival model", () => {
  const route = [{lat:0,lon:0},{lat:0,lon:0.1}];
  it("accounts for required return", () => expect(evaluateMission(route, DEFAULT_CONFIG).distanceKm).toBeCloseTo(greatCircleDistance(route[0], route[1])*2));
  it("rejects impossible oxygen budget", () => expect(evaluateMission(route,{...DEFAULT_CONFIG,oxygenKg:0}).constraints.oxygen).toBe(false));
  it("rejects impossible duration", () => expect(evaluateMission(route,{...DEFAULT_CONFIG,maxHours:0.01}).constraints.time).toBe(false));
  it("accounts for water and radiation limits", () => {
    const result = evaluateMission(route,{...DEFAULT_CONFIG,waterLiters:0,maxRadiationMsv:0.001});
    expect(result.constraints.water).toBe(false);
    expect(result.constraints.radiation).toBe(false);
  });
});

describe("ARES uncertainty engine", () => {
  const route = [{lat:18.38,lon:77.58},{lat:18.65,lon:78.15}];
  it("is reproducible for an auditable mission", () => {
    const first = analyzeMissionRobustly(route, DEFAULT_CONFIG, "", 300);
    const second = analyzeMissionRobustly(route, DEFAULT_CONFIG, "", 300);
    expect(first.survivalProbability).toBe(second.survivalProbability);
    expect(first.confidence).toEqual(second.confidence);
  });
  it("finds and repairs an impossible oxygen budget", () => {
    const result = analyzeMissionRobustly(route, {...DEFAULT_CONFIG, oxygenKg: 1}, "", 300);
    expect(result.constraintProbabilities.oxygen).toBeLessThan(100);
    expect(result.actions.some(action => action.configPatch.oxygenKg !== undefined)).toBe(true);
  });
  it("provides informative answers to custom operational questions", () => {
    const o2Answer = analyzeMissionRobustly(route, DEFAULT_CONFIG, "¿Cuánto oxígeno necesito?", 100);
    expect(o2Answer.answer.toLowerCase()).toContain("oxígeno");
    const returnAnswer = analyzeMissionRobustly(route, DEFAULT_CONFIG, "¿Por qué el regreso obligatorio?", 100);
    expect(returnAnswer.answer.toLowerCase()).toContain("regreso");
  });
});

describe("Conceptual terrain laboratory", () => {
  const route = [{lat:18.38,lon:77.58},{lat:18.65,lon:78.15}];
  it("builds a deterministic corridor profile", () => {
    const first = buildConceptualTerrain(route, 41);
    const second = buildConceptualTerrain(route, 41);
    expect(first.profile).toEqual(second.profile);
    expect(first.profile).toHaveLength(41);
    expect(first.lengthKm).toBeGreaterThan(0);
  });
  it("produces finite terrain metrics and ordered route distance", () => {
    const model = buildConceptualTerrain(route);
    expect(model.profile.every(point => Number.isFinite(point.elevationM + point.slopeDeg + point.roughness))).toBe(true);
    expect(model.profile.at(-1)!.distanceKm).toBeCloseTo(model.lengthKm);
    expect(model.stats.highRiskPercent).toBeGreaterThanOrEqual(0);
    expect(model.stats.highRiskPercent).toBeLessThanOrEqual(100);
  });
  it("keeps the conceptual surface stable for a seed", () => {
    expect(conceptualElevationM(1.2, -.4, 12345)).toBe(conceptualElevationM(1.2, -.4, 12345));
  });
});

describe("Mars scientific and educational dataset", () => {
  it("contains valid and bounded coordinates for all landmarks", () => {
    expect(LANDMARKS.length).toBeGreaterThanOrEqual(15);
    for (const lm of LANDMARKS) {
      expect(lm.lat).toBeGreaterThanOrEqual(-90);
      expect(lm.lat).toBeLessThanOrEqual(90);
      expect(lm.lon).toBeGreaterThanOrEqual(-180);
      expect(lm.lon).toBeLessThanOrEqual(180);
      expect(lm.name.length).toBeGreaterThan(0);
      expect(lm.kind.length).toBeGreaterThan(0);
      expect(lm.description.length).toBeGreaterThan(0);
    }
  });

  it("contains complete mission templates that evaluate without errors", () => {
    expect(MISSION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const tmpl of MISSION_TEMPLATES) {
      expect(tmpl.title.length).toBeGreaterThan(0);
      expect(tmpl.learningGoal.length).toBeGreaterThan(0);
      const evalRes = evaluateMission([tmpl.base, tmpl.destination], { ...DEFAULT_CONFIG, ...tmpl.configPatch });
      expect(Number.isFinite(evalRes.distanceKm)).toBe(true);
      expect(evalRes.durationHours).toBeGreaterThan(0);
    }
  });

  it("contains rich planetary facts and survival guide topics", () => {
    expect(MARS_PLANETARY_FACTS.length).toBeGreaterThanOrEqual(8);
    expect(SURVIVAL_GUIDE_ITEMS.length).toBeGreaterThanOrEqual(5);
    for (const item of SURVIVAL_GUIDE_ITEMS) {
      expect(item.scientificExplanation.length).toBeGreaterThan(20);
      expect(item.safetyRule.length).toBeGreaterThan(10);
    }
  });
});
