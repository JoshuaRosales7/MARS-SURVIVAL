export const MARS_RADIUS_KM = 3389.5;

export type Coordinate = { lat: number; lon: number; name?: string };
export type Strategy = "direct" | "conservative" | "science" | "limited";
export type MissionConfig = {
  crew: number; speedKmh: number; oxygenKg: number; oxygenKgPerPersonHour: number;
  energyKwh: number; energyKwhPerHour: number; reservePercent: number;
  maxHours: number; scienceHours: number; contingencyPercent: number; returnRequired: boolean;
};

const rad = (value: number) => value * Math.PI / 180;
const deg = (value: number) => value * 180 / Math.PI;
export const normalizeLon = (lon: number) => ((lon + 540) % 360) - 180;

export function greatCircleDistance(a: Coordinate, b: Coordinate): number {
  const p1 = rad(a.lat), p2 = rad(b.lat), dp = rad(b.lat - a.lat), dl = rad(normalizeLon(b.lon - a.lon));
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function interpolateGreatCircle(a: Coordinate, b: Coordinate, steps = 64): Coordinate[] {
  const p1 = rad(a.lat), l1 = rad(a.lon), p2 = rad(b.lat), l2 = rad(b.lon);
  const angular = greatCircleDistance(a, b) / MARS_RADIUS_KM;
  if (angular < 1e-9) return [a, b];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps;
    const A = Math.sin((1 - f) * angular) / Math.sin(angular);
    const B = Math.sin(f * angular) / Math.sin(angular);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    return { lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lon: normalizeLon(deg(Math.atan2(y, x))) };
  });
}

export function routeDistance(points: Coordinate[]) {
  return points.slice(1).reduce((sum, p, i) => sum + greatCircleDistance(points[i], p), 0);
}

export function buildRoute(base: Coordinate, destination: Coordinate, strategy: Strategy): Coordinate[] {
  if (strategy === "direct" || strategy === "limited") return interpolateGreatCircle(base, destination);
  const mid = interpolateGreatCircle(base, destination, 2)[1];
  const offset = strategy === "conservative" ? 2.2 : -3.1;
  const waypoint = { lat: Math.max(-88, Math.min(88, mid.lat + offset)), lon: normalizeLon(mid.lon + offset * 1.4) };
  return [...interpolateGreatCircle(base, waypoint, 32).slice(0, -1), ...interpolateGreatCircle(waypoint, destination, 32)];
}

export function evaluateMission(oneWay: Coordinate[], config: MissionConfig) {
  const oneWayKm = routeDistance(oneWay);
  const distanceKm = oneWayKm * (config.returnRequired ? 2 : 1);
  const travelHours = distanceKm / Math.max(0.1, config.speedKmh);
  const durationHours = travelHours + config.scienceHours;
  const contingency = 1 + config.contingencyPercent / 100;
  const oxygenUsedKg = durationHours * config.crew * config.oxygenKgPerPersonHour * contingency;
  const energyUsedKwh = durationHours * config.energyKwhPerHour * contingency;
  const oxygenRemaining = config.oxygenKg - oxygenUsedKg;
  const energyRemaining = config.energyKwh - energyUsedKwh;
  const oxygenReserve = config.oxygenKg * config.reservePercent / 100;
  const energyReserve = config.energyKwh * config.reservePercent / 100;
  const constraints = {
    oxygen: oxygenRemaining >= oxygenReserve,
    energy: energyRemaining >= energyReserve,
    time: durationHours <= config.maxHours,
  };
  const feasible = Object.values(constraints).every(Boolean);
  const reasons = [
    !constraints.oxygen && "Oxygen falls below the configured reserve.",
    !constraints.energy && "Energy falls below the configured reserve.",
    !constraints.time && "Mission duration exceeds the configured limit.",
    feasible && "All resource constraints pass within this illustrative model.",
    "Terrain safety is not certified: no route-specific DEM profile has been loaded."
  ].filter(Boolean) as string[];
  return { oneWayKm, distanceKm, travelHours, durationHours, oxygenUsedKg, energyUsedKwh, oxygenRemaining, energyRemaining, feasible, constraints, reasons };
}

export function coordinateToVector(point: Coordinate, radius = 2.02): [number, number, number] {
  const phi = rad(90 - point.lat), theta = rad(point.lon + 180);
  return [-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)];
}

export const DEFAULT_CONFIG: MissionConfig = {
  crew: 2, speedKmh: 4.5, oxygenKg: 18, oxygenKgPerPersonHour: 0.084,
  energyKwh: 45, energyKwhPerHour: 1.2, reservePercent: 20,
  maxHours: 18, scienceHours: 1.5, contingencyPercent: 15, returnRequired: true,
};
