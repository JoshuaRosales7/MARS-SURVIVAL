import { evaluateMission, type Coordinate, type MissionConfig } from "./mars";

export type AresAction = {
  id: string;
  label: string;
  rationale: string;
  configPatch: Partial<MissionConfig>;
};

export type AresAnalysis = {
  mode: "local" | "openai";
  model?: string;
  runs: number;
  survivalProbability: number;
  confidence: { durationP10: number; durationP90: number; marginP10: number; marginP90: number };
  constraintProbabilities: Record<"oxygen" | "energy" | "water" | "radiation" | "time", number>;
  criticalFactor: "oxygen" | "energy" | "water" | "radiation" | "time";
  headline: string;
  briefing: string;
  answer: string;
  actions: AresAction[];
  caveats: string[];
};

const labels = {
  oxygen: "oxígeno", energy: "energía", water: "agua", radiation: "radiación", time: "tiempo",
} as const;

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function normal(random: () => number) {
  const u = Math.max(random(), 1e-9);
  const v = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function localAnswer(question: string, critical: keyof typeof labels, probability: number, actions: AresAction[]) {
  const q = question.trim().toLowerCase();
  if (!q) return `ARES estima ${probability.toFixed(0)}% de éxito bajo las variaciones simuladas. El cuello de botella es ${labels[critical]}.`;
  if (/por qu[eé]|riesgo|falla/.test(q)) return `El principal riesgo es ${labels[critical]}: fue la restricción con menor tasa de cumplimiento en los escenarios simulados. ${actions[0]?.rationale || "Conviene aumentar el margen antes de autorizar la salida."}`;
  if (/mejor|optim|cambiar|recom/.test(q)) return actions.length ? `La mejora de mayor impacto es: ${actions[0].label}. ${actions[0].rationale}` : "La configuración ya conserva holgura en las restricciones modeladas; mantén la contingencia y valida el terreno.";
  return `Con los datos disponibles, la misión alcanza ${probability.toFixed(0)}% de éxito simulado y está limitada por ${labels[critical]}. ARES no considera pendiente, rocas ni meteorología espacial en tiempo real.`;
}

/**
 * Monte Carlo reproducible for the browser/offline demo. Variations are scenario
 * assumptions, not measured forecasts: speed ±15%, consumptions ±12%, radiation ±25%.
 */
export function analyzeMissionRobustly(route: Coordinate[], config: MissionConfig, question = "", runs = 800): AresAnalysis {
  const safeRuns = clamp(Math.round(runs), 100, 5000);
  const seed = hashSeed(JSON.stringify({ route: route.map(p => [p.lat, p.lon]), config, safeRuns }));
  const random = mulberry32(seed);
  const passCounts = { oxygen: 0, energy: 0, water: 0, radiation: 0, time: 0 };
  const durations: number[] = [];
  const margins: number[] = [];
  let successes = 0;

  for (let i = 0; i < safeRuns; i++) {
    const sample: MissionConfig = {
      ...config,
      speedKmh: Math.max(0.5, config.speedKmh * (1 + normal(random) * 0.15)),
      oxygenKgPerPersonHour: config.oxygenKgPerPersonHour * Math.max(0.6, 1 + normal(random) * 0.12),
      energyKwhPerHour: config.energyKwhPerHour * Math.max(0.6, 1 + normal(random) * 0.12),
      waterLitersPerPersonDay: config.waterLitersPerPersonDay * Math.max(0.6, 1 + normal(random) * 0.12),
      radiationMsvPerHour: config.radiationMsvPerHour * Math.max(0.35, 1 + normal(random) * 0.25),
    };
    const result = evaluateMission(route, sample);
    durations.push(result.durationHours);
    margins.push(result.limitingMarginPercent);
    (Object.keys(passCounts) as (keyof typeof passCounts)[]).forEach(key => { if (result.constraints[key]) passCounts[key]++; });
    if (result.feasible) successes++;
  }

  const constraintProbabilities = Object.fromEntries(
    Object.entries(passCounts).map(([key, value]) => [key, value / safeRuns * 100]),
  ) as AresAnalysis["constraintProbabilities"];
  const criticalFactor = (Object.entries(constraintProbabilities).sort((a, b) => a[1] - b[1])[0][0]) as AresAnalysis["criticalFactor"];
  const survivalProbability = successes / safeRuns * 100;
  const p90Duration = quantile(durations, 0.9);
  const contingency = 1 + config.contingencyPercent / 100;
  const reserveFactor = Math.max(0.05, 1 - config.reservePercent / 100);
  const requiredOxygen = p90Duration * config.crew * config.oxygenKgPerPersonHour * contingency / reserveFactor;
  const requiredEnergy = p90Duration * config.energyKwhPerHour * contingency / reserveFactor;
  const requiredWater = p90Duration / 24 * config.crew * config.waterLitersPerPersonDay * contingency / reserveFactor;
  const actions: AresAction[] = [];

  if (config.oxygenKg < requiredOxygen * 1.02) actions.push({ id: "oxygen", label: `Subir O₂ a ${Math.ceil(requiredOxygen)} kg`, rationale: "Cubre el consumo estimado del percentil 90 sin invadir la reserva configurada.", configPatch: { oxygenKg: Math.ceil(requiredOxygen) } });
  if (config.energyKwh < requiredEnergy * 1.02) actions.push({ id: "energy", label: `Subir energía a ${Math.ceil(requiredEnergy)} kWh`, rationale: "Protege el presupuesto energético frente a demoras y variación de consumo.", configPatch: { energyKwh: Math.ceil(requiredEnergy) } });
  if (config.waterLiters < requiredWater * 1.02) actions.push({ id: "water", label: `Subir agua a ${Math.ceil(requiredWater)} L`, rationale: "Mantiene la reserva de agua en el escenario lento del percentil 90.", configPatch: { waterLiters: Math.ceil(requiredWater) } });
  if (config.maxHours < p90Duration) actions.push({ id: "time", label: `Ampliar ventana a ${Math.ceil(p90Duration)} h`, rationale: "Evita que una reducción plausible de velocidad invalide la ventana operativa.", configPatch: { maxHours: Math.ceil(p90Duration) } });
  const radiationP90 = p90Duration * config.radiationMsvPerHour * 1.32;
  if (radiationP90 > config.maxRadiationMsv) actions.push({ id: "radiation", label: "Reducir duración o exposición", rationale: `La dosis conservadora ronda ${radiationP90.toFixed(2)} mSv; aumentar el límite no reduce el riesgo físico.`, configPatch: { scienceHours: Math.max(0, Number((config.scienceHours - Math.min(1, config.scienceHours)).toFixed(1))) } });

  actions.sort((a, b) => constraintProbabilities[a.id as keyof typeof constraintProbabilities] - constraintProbabilities[b.id as keyof typeof constraintProbabilities]);
  const headline = survivalProbability >= 90 ? "Misión robusta" : survivalProbability >= 60 ? "Misión sensible" : "Misión no autorizable";
  const briefing = `${safeRuns.toLocaleString("es-GT")} futuros plausibles evaluados. ${survivalProbability.toFixed(0)}% conserva simultáneamente recursos, tiempo y dosis dentro de los límites.`;

  return {
    mode: "local", runs: safeRuns, survivalProbability,
    confidence: { durationP10: quantile(durations, 0.1), durationP90: p90Duration, marginP10: quantile(margins, 0.1), marginP90: quantile(margins, 0.9) },
    constraintProbabilities, criticalFactor, headline, briefing,
    answer: localAnswer(question, criticalFactor, survivalProbability, actions),
    actions: actions.slice(0, 4),
    caveats: [
      "Las distribuciones representan supuestos de escenario, no pronósticos medidos.",
      "No hay DEM numérico: pendiente, rocas y transitabilidad siguen sin evaluar.",
      "La radiación usa una tasa constante editable, no meteorología espacial en tiempo real.",
    ],
  };
}

export function toApiPayload(route: Coordinate[], strategy: string, config: MissionConfig, question: string) {
  const result = evaluateMission(route, config);
  return {
    route: { coordinates: route, distance_km: result.oneWayKm, strategy, quality: "global-geometric", terrain_evaluated: false, warnings: ["Terrain not evaluated"] },
    config: {
      crew: config.crew, speed_kmh: config.speedKmh, oxygen_kg: config.oxygenKg,
      oxygen_kg_per_person_hour: config.oxygenKgPerPersonHour, energy_kwh: config.energyKwh,
      energy_kwh_per_hour: config.energyKwhPerHour, water_liters: config.waterLiters,
      water_liters_per_person_day: config.waterLitersPerPersonDay,
      radiation_msv_per_hour: config.radiationMsvPerHour, max_radiation_msv: config.maxRadiationMsv,
      reserve_percent: config.reservePercent, max_hours: config.maxHours, science_hours: config.scienceHours,
      contingency_percent: config.contingencyPercent, return_required: config.returnRequired,
    },
    question, runs: 1200,
  };
}
