import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, evaluateMission, greatCircleDistance, interpolateGreatCircle, normalizeLon } from "../lib/mars";

describe("Mars geodesy", () => {
  it("returns zero for identical points", () => expect(greatCircleDistance({lat:0,lon:0},{lat:0,lon:0})).toBe(0));
  it("handles the antimeridian by shortest arc", () => expect(greatCircleDistance({lat:0,lon:179},{lat:0,lon:-179})).toBeLessThan(120));
  it("handles polar coordinates", () => expect(greatCircleDistance({lat:90,lon:0},{lat:90,lon:170})).toBeLessThan(1e-4));
  it("normalizes longitudes", () => { expect(normalizeLon(190)).toBe(-170); expect(normalizeLon(-190)).toBe(170); });
  it("interpolates finite points across antimeridian", () => expect(interpolateGreatCircle({lat:10,lon:179},{lat:12,lon:-179}).every(p=>Number.isFinite(p.lat+p.lon))).toBe(true));
});

describe("Survival model", () => {
  const route = [{lat:0,lon:0},{lat:0,lon:0.1}];
  it("accounts for required return", () => expect(evaluateMission(route, DEFAULT_CONFIG).distanceKm).toBeCloseTo(greatCircleDistance(route[0], route[1])*2));
  it("rejects impossible oxygen budget", () => expect(evaluateMission(route,{...DEFAULT_CONFIG,oxygenKg:0}).constraints.oxygen).toBe(false));
  it("rejects impossible duration", () => expect(evaluateMission(route,{...DEFAULT_CONFIG,maxHours:0.01}).constraints.time).toBe(false));
});
