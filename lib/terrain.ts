import { normalizeLon, routeDistance, type Coordinate } from "./mars";

export type TerrainPoint = {
  fraction: number;
  distanceKm: number;
  elevationM: number;
  slopeDeg: number;
  roughness: number;
  risk: "low" | "medium" | "high";
  worldX: number;
  worldZ: number;
};

export type TerrainModel = {
  seed: number;
  lengthKm: number;
  widthKm: number;
  profile: TerrainPoint[];
  stats: {
    minElevationM: number;
    maxElevationM: number;
    maxSlopeDeg: number;
    meanRoughness: number;
    highRiskPercent: number;
  };
};

function hashRoute(route: Coordinate[]) {
  let hash = 2166136261;
  for (const point of route) {
    const text = `${point.lat.toFixed(5)},${normalizeLon(point.lon).toFixed(5)};`;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

function phase(seed: number, shift: number) {
  return ((seed >>> shift) & 255) / 255 * Math.PI * 2;
}

/** Deterministic conceptual terrain. Values are not MOLA measurements. */
export function conceptualElevationM(x: number, z: number, seed: number) {
  const p0 = phase(seed, 0), p1 = phase(seed, 8), p2 = phase(seed, 16), p3 = phase(seed, 24);
  const broad = Math.sin(x * .62 + p0) * 150 + Math.cos(z * .78 + p1) * 115;
  const ridges = Math.sin(x * 1.7 + z * .55 + p2) * 58 + Math.cos(z * 2.25 - x * .31 + p3) * 42;
  const detail = Math.sin(x * 4.8 + p1) * Math.cos(z * 4.1 + p0) * 18;
  const craterA = -210 * Math.exp(-((x + 1.55) ** 2 / 1.15 + (z - .55) ** 2 / .72));
  const craterARim = 72 * Math.exp(-((Math.hypot(x + 1.55, (z - .55) * 1.2) - 1.05) ** 2) / .08);
  const craterB = -95 * Math.exp(-((x - 2.15) ** 2 / .34 + (z + .72) ** 2 / .28));
  return broad + ridges + detail + craterA + craterARim + craterB;
}

export function sampleConceptualTerrain(x: number, z: number, seed: number, lengthKm: number, widthKm: number) {
  const elevationM = conceptualElevationM(x, z, seed);
  const epsilon = .035;
  const dxM = Math.max(10, lengthKm * 1000 / 10 * epsilon);
  const dzM = Math.max(10, widthKm * 1000 / 6 * epsilon);
  const gradientX = (conceptualElevationM(x + epsilon, z, seed) - conceptualElevationM(x - epsilon, z, seed)) / (2 * dxM);
  const gradientZ = (conceptualElevationM(x, z + epsilon, seed) - conceptualElevationM(x, z - epsilon, seed)) / (2 * dzM);
  const slopeDeg = Math.atan(Math.hypot(gradientX, gradientZ)) * 180 / Math.PI;
  const roughness = Math.min(1, Math.abs(conceptualElevationM(x + epsilon * 2, z - epsilon, seed) - 2 * elevationM + conceptualElevationM(x - epsilon * 2, z + epsilon, seed)) / 45);
  const risk: TerrainPoint["risk"] = slopeDeg >= 18 || roughness >= .72 ? "high" : slopeDeg >= 10 || roughness >= .42 ? "medium" : "low";
  return { elevationM, slopeDeg, roughness, risk };
}

function routeLateralOffset(route: Coordinate[], index: number) {
  if (route.length < 3 || index === 0 || index === route.length - 1) return 0;
  const fraction = index / (route.length - 1);
  const start = route[0], end = route[route.length - 1];
  const expectedLat = start.lat + (end.lat - start.lat) * fraction;
  const lonDelta = normalizeLon(end.lon - start.lon);
  const expectedLon = normalizeLon(start.lon + lonDelta * fraction);
  const latDeviation = route[index].lat - expectedLat;
  const lonDeviation = normalizeLon(route[index].lon - expectedLon) * Math.cos(route[index].lat * Math.PI / 180);
  return Math.max(-2.2, Math.min(2.2, (latDeviation + lonDeviation) * 3));
}

export function buildConceptualTerrain(route: Coordinate[], samples = 81): TerrainModel {
  const safeRoute = route.length >= 2 ? route : [{ lat: 0, lon: 0 }, { lat: 0, lon: .01 }];
  const seed = hashRoute(safeRoute);
  const lengthKm = Math.max(1, routeDistance(safeRoute));
  const widthKm = Math.max(2, Math.min(80, lengthKm * .22));
  const profile = Array.from({ length: Math.max(3, samples) }, (_, index): TerrainPoint => {
    const fraction = index / (Math.max(3, samples) - 1);
    const routeIndex = Math.min(safeRoute.length - 1, Math.round(fraction * (safeRoute.length - 1)));
    const worldX = -4.5 + fraction * 9;
    const worldZ = routeLateralOffset(safeRoute, routeIndex);
    const sample = sampleConceptualTerrain(worldX, worldZ, seed, lengthKm, widthKm);
    return { fraction, distanceKm: lengthKm * fraction, worldX, worldZ, ...sample };
  });
  const elevations = profile.map(point => point.elevationM);
  const slopes = profile.map(point => point.slopeDeg);
  return {
    seed, lengthKm, widthKm, profile,
    stats: {
      minElevationM: Math.min(...elevations), maxElevationM: Math.max(...elevations),
      maxSlopeDeg: Math.max(...slopes),
      meanRoughness: profile.reduce((sum, point) => sum + point.roughness, 0) / profile.length,
      highRiskPercent: profile.filter(point => point.risk === "high").length / profile.length * 100,
    },
  };
}

