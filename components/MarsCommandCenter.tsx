"use client";

import {
  Activity, AlertTriangle, Box, ChevronDown, ChevronRight, ChevronUp, CircleGauge, Database, Download,
  BrainCircuit, Check, Droplets, FlaskConical, Gauge, Globe2, Layers3, LoaderCircle,
  Map, MapPin, Maximize2, Minimize2, Mountain, Navigation, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, Pause, Play, Radiation, RotateCcw, Search, Send,
  ShieldCheck, Sparkles, Timer, Users, Zap, Keyboard,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, LineChart, Line as ChartLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { jsPDF } from "jspdf";
import { LANDMARKS, SOURCES, type Landmark } from "@/data/mars";
import {
  buildRoute, evaluateMission, initialBearing, normalizeLon,
  routeDistance, type Coordinate, type MissionConfig, type Strategy,
} from "@/lib/mars";
import { analyzeMissionRobustly, toApiPayload, type AresAnalysis } from "@/lib/ares";
import { buildConceptualTerrain } from "@/lib/terrain";
import { useMissionStore } from "@/lib/store";

function VisualizerLoading({ label }: { label: string }) {
  return <div className="visualizer-loading" role="status"><span/><b>{label}</b><small>Preparando motor de visualización</small></div>;
}

const AdvancedMarsGlobe = dynamic(() => import("@/components/AdvancedMarsGlobe"), {
  ssr: false,
  loading: () => <VisualizerLoading label="Cargando globo orbital" />,
});
const TerrainLab3D = dynamic(() => import("@/components/TerrainLab3D"), {
  ssr: false,
  loading: () => <VisualizerLoading label="Construyendo terreno 3D" />,
});

const TILE_BASE = process.env.NEXT_PUBLIC_MARS_TILE_BASE || "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TILE_WEST = `${TILE_BASE}/0/0/0.jpg`;
const TILE_EAST = `${TILE_BASE}/0/0/1.jpg`;

const STRATEGIES: { id: Strategy; name: string; description: string; tag: string }[] = [
  { id: "direct", name: "Directa", description: "Arco geodésico mínimo", tag: "Mínima distancia" },
  { id: "conservative", name: "Conservadora", description: "Desvío geométrico ilustrativo", tag: "DEM pendiente" },
  { id: "science", name: "Ciencia", description: "Corredor con objetivo intermedio", tag: "Más cobertura" },
  { id: "limited", name: "Recursos", description: "Ruta directa, validación estricta", tag: "Presupuesto" },
];

const PRESETS: { name: string; subtitle: string; values: Partial<MissionConfig> }[] = [
  { name: "Exploración", subtitle: "2 personas · 18 h", values: { crew: 2, speedKmh: 4.5, oxygenKg: 18, energyKwh: 45, waterLiters: 12, maxHours: 18, scienceHours: 1.5, contingencyPercent: 15, reservePercent: 20 } },
  { name: "Ciencia", subtitle: "3 personas · 30 h", values: { crew: 3, speedKmh: 3.5, oxygenKg: 42, energyKwh: 90, waterLiters: 24, maxHours: 30, scienceHours: 4, contingencyPercent: 20, reservePercent: 25 } },
  { name: "Extendida", subtitle: "4 personas · 48 h", values: { crew: 4, speedKmh: 5, oxygenKg: 80, energyKwh: 140, waterLiters: 45, maxHours: 48, scienceHours: 6, contingencyPercent: 25, reservePercent: 30 } },
];

function fmt(value: number, digits = 1) { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }
function coords(p: Coordinate) { return `${Math.abs(p.lat).toFixed(3)}°${p.lat >= 0 ? "N" : "S"}  ${Math.abs(p.lon).toFixed(3)}°${p.lon >= 0 ? "E" : "W"}`; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

function MapView({ route, simPoint }: { route: Coordinate[]; simPoint: Coordinate }) {
  const { setPoint, setCursor, base, destination, layers } = useMissionStore();
  const project = (p: Coordinate) => ({ x: (normalizeLon(p.lon) + 180) / 360 * 1000, y: (90 - p.lat) / 180 * 500 });
  const paths = route.reduce<Coordinate[][]>((segments, point, index) => {
    if (!index || Math.abs(normalizeLon(point.lon) - normalizeLon(route[index - 1].lon)) < 180) segments.at(-1)!.push(point);
    else segments.push([point]);
    return segments;
  }, [[]]);
  const click = (e: React.MouseEvent<HTMLDivElement>, commit: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { lon: normalizeLon((e.clientX - r.left) / r.width * 360 - 180), lat: clamp(90 - (e.clientY - r.top) / r.height * 180, -90, 90) };
    (commit ? setPoint : setCursor)(p);
  };
  return <div className="map-view" onMouseMove={(e) => click(e, false)} onClick={(e) => click(e, true)}>
    {layers.imagery && <div className="map-tiles"><img src={TILE_WEST} alt="Hemisferio occidental MOLA" loading="eager" decoding="async" draggable={false}/><img src={TILE_EAST} alt="Hemisferio oriental MOLA" loading="eager" decoding="async" draggable={false}/></div>}
    <svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-label="Mapa equirectangular de Marte">
      {layers.grid && <g className="grid-lines">{[-60,-30,0,30,60].map(lat => <line key={lat} x1="0" x2="1000" y1={(90-lat)/180*500} y2={(90-lat)/180*500} />)}{[-120,-60,0,60,120].map(lon => <line key={lon} y1="0" y2="500" x1={(lon+180)/360*1000} x2={(lon+180)/360*1000} />)}</g>}
      {layers.routes && paths.map((segment, i) => <path key={i} d={segment.map((p, j) => `${j ? "L" : "M"}${project(p).x},${project(p).y}`).join(" ")} className="route-path" />)}
      {layers.landmarks && LANDMARKS.map(p => <g className="landmark-dot" key={p.id}><circle cx={project(p).x} cy={project(p).y} r="3" /><title>{p.name}</title></g>)}
      {[{p:base,c:"#63e6be"},{p:destination,c:"#ff8a5c"},{p:simPoint,c:"#fff"}].map(({p,c},i)=><circle key={i} cx={project(p).x} cy={project(p).y} r={i===2?4:6} fill={c} />)}
    </svg>
    <span className="map-credit">NASA Mars Trek · MGS MOLA color hillshade · producto 463 m/px</span>
  </div>;
}

function Metric({ icon: Icon, label, value, tone = "blue", detail }: { icon: LucideIcon; label: string; value: string; tone?: string; detail?: string }) {
  return <div className={`metric ${tone}`}><span className="metric-icon"><Icon size={16}/></span><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></div>;
}

function Range({ label, value, unit, min, max, step = 1, onChange, hint }: { label: string; value: number; unit: string; min: number; max: number; step?: number; hint?: string; onChange: (v: number) => void }) {
  return <label className="range"><span>{label}<b>{value}{unit}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))}/>{hint && <small>{hint}</small>}</label>;
}

function CoordinateEditor({ label, point, color, onChange }: { label: string; point: Coordinate; color: string; onChange: (p: Coordinate) => void }) {
  const update = (key: "lat" | "lon", raw: string) => {
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
    onChange({ lat: key === "lat" ? clamp(number, -90, 90) : point.lat, lon: key === "lon" ? normalizeLon(number) : point.lon });
  };
  return <div className="coordinate-editor" style={{"--point-color": color} as React.CSSProperties}>
    <div><i/><span>{label}</span><b>{point.name || "Punto personalizado"}</b></div>
    <label>LAT<input type="number" min="-90" max="90" step="0.001" value={point.lat} onChange={e=>update("lat",e.target.value)} /></label>
    <label>LON<input type="number" min="-180" max="180" step="0.001" value={point.lon} onChange={e=>update("lon",e.target.value)} /></label>
  </div>;
}

export default function MarsCommandCenter() {
  const store = useMissionStore();
  const [leftTab, setLeftTab] = useState<"plan"|"ares"|"layers"|"places">("plan");
  const [bottomTab, setBottomTab] = useState<"profile"|"terrain"|"routes"|"sources">("profile");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(true);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  const [search, setSearch] = useState("");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [generativeAI, setGenerativeAI] = useState(false);
  const [question, setQuestion] = useState("");
  const [aresLoading, setAresLoading] = useState(false);
  const [serverAres, setServerAres] = useState<AresAnalysis | null>(null);
  const [cinematic, setCinematic] = useState(true);
  const routes = useMemo(() => STRATEGIES.map(({id}) => ({ strategy: id, points: buildRoute(store.base, store.destination, id) })), [store.base, store.destination]);
  const route = routes.find(r => r.strategy === store.strategy)!.points;
  const evaluation = useMemo(() => evaluateMission(route, store.config), [route, store.config]);
  const terrainModel = useMemo(() => buildConceptualTerrain(route), [route]);
  const localAres = useMemo(() => analyzeMissionRobustly(route, store.config, question), [route, store.config, question]);
  const ares = serverAres || localAres;
  const missionRoute = useMemo(() => store.config.returnRequired ? [...route, ...route.slice(0, -1).reverse()] : route, [route, store.config.returnRequired]);
  const simIndex = Math.min(missionRoute.length - 1, Math.floor(store.progress * (missionRoute.length - 1)));
  const simPoint = missionRoute[simIndex] || store.base;
  const bearing = initialBearing(store.base, store.destination);
  const phase = store.progress === 0 ? "Preparada" : store.progress >= 1 ? "Completada" : store.config.returnRequired && store.progress > 0.5 ? "Regreso" : "Travesía";

  const closeGuide = () => {
    setGuideOpen(false);
    window.localStorage.setItem("redreturn-onboarding-v1", "complete");
  };
  const openMissionSetup = () => {
    setFocusMode(false); setLeftCollapsed(false); setLeftTab("places");
  };
  const openTerrain = () => {
    store.setView("terrain"); setBottomTab("terrain"); setDrawerOpen(false);
  };
  const openAres = () => {
    setFocusMode(false); setLeftCollapsed(false); setLeftTab("ares");
    setQuestion(value => value || "¿Cuál es el principal riesgo y qué debo cambiar?");
  };
  const loadExampleMission = () => {
    store.setSelection("destination");
    store.setPoint({ lat: 18.55, lon: 77.93, name: "Delta de Jezero" });
    store.setStrategy("direct");
    openTerrain();
    closeGuide();
  };

  const toggleFocus = useCallback(() => {
    setFocusMode(value => {
      const next = !value;
      setDrawerOpen(false);
      setLeftCollapsed(true);
      setRightCollapsed(true);
      return next;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    fetch(`${API_URL}/api/health`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { setApiOnline(true); setGenerativeAI(Boolean(data.features?.generative_ai)); }).catch(() => setApiOnline(false)).finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "globe" || requestedView === "map" || requestedView === "terrain") {
      store.setView(requestedView);
      if (requestedView === "terrain") setBottomTab("terrain");
    }
  }, [store.setView]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("redreturn-ui-v3") || "{}");
      if (typeof saved.drawerOpen === "boolean") setDrawerOpen(saved.drawerOpen);
      if (typeof saved.leftCollapsed === "boolean") setLeftCollapsed(saved.leftCollapsed);
      if (typeof saved.rightCollapsed === "boolean") setRightCollapsed(saved.rightCollapsed);
      if (typeof saved.focusMode === "boolean") setFocusMode(saved.focusMode);
    } catch { /* Prefer safe defaults when storage is unavailable. */ }
    setUiReady(true);
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem("redreturn-onboarding-v1") !== "complete") setGuideOpen(true);
  }, []);

  useEffect(() => {
    if (!uiReady) return;
    window.localStorage.setItem("redreturn-ui-v3", JSON.stringify({ drawerOpen, leftCollapsed, rightCollapsed, focusMode }));
  }, [drawerOpen, focusMode, leftCollapsed, rightCollapsed, uiReady]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", store.view);
    window.history.replaceState({}, "", url);
  }, [store.view]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "1") store.setView("globe");
      else if (event.key === "2") store.setView("map");
      else if (event.key === "3") store.setView("terrain");
      else if (event.key.toLowerCase() === "f") toggleFocus();
      else if (event.key.toLowerCase() === "d") setDrawerOpen(value => !value);
      else if (event.key === " ") { event.preventDefault(); store.setRunning(!store.running); }
      else if (event.key === "Escape") {
        setShortcutsOpen(false);
        setDrawerOpen(false);
        if (focusMode) {
          setFocusMode(false);
          setLeftCollapsed(true);
          setRightCollapsed(true);
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [focusMode, store.running, store.setRunning, store.setView, toggleFocus]);

  useEffect(() => { setServerAres(null); }, [route, store.config]);

  useEffect(() => {
    if (!store.running) return;
    if (store.progress >= 1) { store.setRunning(false); return; }
    const id = window.setInterval(() => store.setProgress(Math.min(1, store.progress + 0.0025 * store.simSpeed)), 80);
    return () => window.clearInterval(id);
  }, [store.running, store.progress, store.simSpeed, store.setProgress, store.setRunning]);

  const timeline = Array.from({length: 17}, (_,i) => {
    const f=i/16, hours=evaluation.durationHours*f;
    return {
      h: Number(hours.toFixed(1)),
      oxygen: Math.max(0, store.config.oxygenKg - evaluation.oxygenUsedKg*f),
      energy: Math.max(0, store.config.energyKwh - evaluation.energyUsedKwh*f),
      water: Math.max(0, store.config.waterLiters - evaluation.waterUsedLiters*f),
    };
  });

  const chooseLandmark = (place: Landmark) => { store.setPoint(place); setLeftTab("plan"); };
  const runAres = async () => {
    setServerAres(null);
    if (!apiOnline) return;
    setAresLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${API_URL}/api/ai/mission-copilot`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify(toApiPayload(route, store.strategy, store.config, question)),
      });
      if (!response.ok) throw new Error("ARES unavailable");
      setServerAres(await response.json() as AresAnalysis);
    } catch {
      setServerAres(null);
    } finally {
      window.clearTimeout(timer); setAresLoading(false);
    }
  };
  const exportMission = (type: "json"|"geojson"|"pdf") => {
    const payload = { schema: "redreturn/1.1", generatedAt: new Date().toISOString(), coordinateConvention: "planetocentric latitude, east-positive longitude normalized to -180..180", mission: { base: store.base, destination: store.destination, strategy: store.strategy, config: store.config }, result: evaluation, route, scientificLimitations: ["Global geometric route only", "No route-specific DEM profile loaded", "Radiation is a constant-rate scenario, not a forecast", "Resource rates are editable illustrative assumptions"] };
    if (type === "pdf") {
      const doc = new jsPDF(); doc.setFillColor(7,12,19); doc.rect(0,0,210,297,"F"); doc.setTextColor(255,138,92); doc.setFontSize(22); doc.text("REDRETURN",18,24); doc.setTextColor(243,246,252); doc.setFontSize(11);
      ["Informe de inteligencia de misión",`Base: ${coords(store.base)}`,`Destino: ${coords(store.destination)}`,`Estrategia: ${store.strategy}`,`Distancia total: ${fmt(evaluation.distanceKm)} km`,`Duración estimada: ${fmt(evaluation.durationHours)} h`,`Oxígeno restante: ${fmt(evaluation.oxygenRemaining)} kg`,`Agua restante: ${fmt(evaluation.waterRemaining)} L`,`Radiación estimada: ${fmt(evaluation.radiationMsv,2)} mSv`,`Resultado: ${evaluation.feasible?"FAVORABLE EN EL MODELO":"RESTRICCIÓN INCUMPLIDA"}`,"",...evaluation.reasons,"","Límite: ruta geométrica global; seguridad de terreno no evaluada."].forEach((line,i)=>doc.text(line,18,40+i*8));
      doc.save("redreturn-report.pdf"); return;
    }
    const body = type === "geojson" ? { type:"FeatureCollection", crs:{type:"name",properties:{name:"IAU Mars 2000; planetocentric; longitude east-positive"}}, features:[{type:"Feature",properties:{strategy:store.strategy,quality:"global-geometric",distance_km:evaluation.distanceKm},geometry:{type:"LineString",coordinates:route.map(p=>[p.lon,p.lat])}}] } : payload;
    const blob = new Blob([JSON.stringify(body,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`redreturn.${type}`; a.click(); window.setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  return <main className={`app-shell ${drawerOpen ? "drawer-open" : "drawer-closed"} ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""} ${focusMode ? "focus-mode" : ""}`}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Globe2 size={21}/></span><div><b>REDRETURN</b><small>PLANIFICA · EVALÚA · REGRESA</small></div></div>
      <div className="mission-breadcrumb"><span>RR-01</span><ChevronRight size={13}/><b>{store.base.name || "BASE"}</b><ChevronRight size={13}/><strong>{store.destination.name || "DESTINO"}</strong></div>
      <div className="location"><span>COORDENADA ACTIVA</span><b>{coords(store.cursor)}</b></div>
      <div className="view-switch"><button aria-pressed={store.view==="globe"} className={store.view==="globe"?"active":""} onClick={()=>store.setView("globe")}><Box size={15}/> Globo</button><button aria-pressed={store.view==="map"} className={store.view==="map"?"active":""} onClick={()=>store.setView("map")}><Map size={15}/> Mapa</button><button aria-pressed={store.view==="terrain"} className={store.view==="terrain"?"active":""} onClick={()=>{store.setView("terrain");setBottomTab("terrain")}}><Mountain size={15}/> Terreno</button></div>
      <div className="workspace-actions"><button className={guideOpen?"active":""} onClick={()=>setGuideOpen(true)} aria-expanded={guideOpen} title="Abrir guía de inicio"><Navigation size={15}/><span>Guía</span></button><button className={focusMode?"active":""} onClick={toggleFocus} aria-pressed={focusMode} title="Modo enfoque (F)">{focusMode?<Minimize2 size={15}/>:<Maximize2 size={15}/>}<span>{focusMode?"Salir":"Enfoque"}</span></button><button className={shortcutsOpen?"active":""} onClick={()=>setShortcutsOpen(value=>!value)} aria-expanded={shortcutsOpen} title="Atajos de teclado"><Keyboard size={15}/><span>Atajos</span></button></div>
      <div className={`source-state ${apiOnline ? "online" : "local"}`}><i/>{apiOnline === null ? "COMPROBANDO API" : apiOnline ? "API CONECTADA" : "MODO LOCAL"}</div>
      <div className="export-menu"><Download size={16}/><select aria-label="Exportar misión" defaultValue="" onChange={(e)=>{if(e.target.value) exportMission(e.target.value as "json"|"geojson"|"pdf");e.target.value=""}}><option value="" disabled>Exportar</option><option value="pdf">Informe PDF</option><option value="json">Misión JSON</option><option value="geojson">Ruta GeoJSON</option></select></div>
      {shortcutsOpen && <div className="shortcut-popover" role="dialog" aria-label="Atajos de teclado"><div><b>Atajos rápidos</b><button onClick={()=>setShortcutsOpen(false)} aria-label="Cerrar atajos">×</button></div><p><kbd>1</kbd><span>Globo</span><kbd>2</kbd><span>Mapa</span><kbd>3</kbd><span>Terreno</span><kbd>F</kbd><span>Modo enfoque</span><kbd>D</kbd><span>Panel de datos</span><kbd>Espacio</kbd><span>Iniciar o pausar</span><kbd>Esc</kbd><span>Cerrar paneles</span></p></div>}
    </header>

    <aside className="left-panel panel">
      <nav className="tabs" aria-label="Herramientas"><button className={leftTab==="plan"?"active":""} onClick={()=>setLeftTab("plan")}><MapPin size={15}/> Misión</button><button className={leftTab==="ares"?"active":""} onClick={()=>setLeftTab("ares")}><BrainCircuit size={15}/> ARES</button><button className={leftTab==="layers"?"active":""} onClick={()=>setLeftTab("layers")}><Layers3 size={15}/> Capas</button><button className={leftTab==="places"?"active":""} onClick={()=>setLeftTab("places")}><Search size={15}/> Lugares</button></nav>
      {leftTab==="plan" && <div className="panel-content">
        <section className="mission-start">
          <span>INICIO RÁPIDO</span><h3>Planifica sin ser experto</h3><p>Primero elige un destino. Después revisa el terreno y pide a ARES una recomendación.</p>
          <button onClick={openMissionSetup}><MapPin size={15}/><span><b>Elegir destino</b><small>Explora lugares conocidos de Marte</small></span><ChevronRight size={15}/></button>
        </section>
        <section><div className="section-head"><span>01</span><div><h3>Define la expedición</h3><small>Elige qué punto editar y toca el mapa</small></div></div>
          <div className="segmented"><button className={store.selection==="base"?"active":""} onClick={()=>store.setSelection("base")}>Editar base</button><button className={store.selection==="destination"?"active":""} onClick={()=>store.setSelection("destination")}>Editar destino</button></div>
          <CoordinateEditor label="BASE" point={store.base} color="#63e6be" onChange={p=>{store.setSelection("base");store.setPoint(p)}} />
          <CoordinateEditor label="DESTINO" point={store.destination} color="#ff8a5c" onChange={p=>{store.setSelection("destination");store.setPoint(p)}} />
        </section>
        <section><div className="section-head"><span>02</span><div><h3>Objetivo de ruta</h3><small>Todos los corredores son geométricos</small></div></div><div className="strategy-grid">{STRATEGIES.map(item=><button key={item.id} className={store.strategy===item.id?"active":""} onClick={()=>store.setStrategy(item.id)}><span>{item.tag}</span><b>{item.name}</b><small>{item.description}</small></button>)}</div></section>
        <section><div className="section-head"><span>03</span><div><h3>Perfil de misión</h3><small>Presets editables, no certificaciones</small></div></div><div className="preset-row">{PRESETS.map(p=><button key={p.name} onClick={()=>store.setConfig(p.values)}><b>{p.name}</b><small>{p.subtitle}</small></button>)}</div></section>
        <section><div className="section-head"><span>04</span><div><h3>Recursos y límites</h3><small>Actualización instantánea del análisis</small></div></div>
          <Range label="Tripulación" value={store.config.crew} unit="" min={1} max={8} onChange={v=>store.setConfig({crew:v})}/>
          <Range label="Velocidad media" value={store.config.speedKmh} unit=" km/h" min={1} max={20} step={0.5} onChange={v=>store.setConfig({speedKmh:v})}/>
          <Range label="Oxígeno" value={store.config.oxygenKg} unit=" kg" min={2} max={120} onChange={v=>store.setConfig({oxygenKg:v})}/>
          <Range label="Energía" value={store.config.energyKwh} unit=" kWh" min={5} max={200} onChange={v=>store.setConfig({energyKwh:v})}/>
          <Range label="Agua" value={store.config.waterLiters} unit=" L" min={2} max={80} onChange={v=>store.setConfig({waterLiters:v})}/>
          <Range label="Reserva mínima" value={store.config.reservePercent} unit="%" min={5} max={50} onChange={v=>store.setConfig({reservePercent:v})}/>
          <details className="advanced"><summary><Gauge size={14}/> Parámetros avanzados</summary>
            <Range label="Tiempo científico" value={store.config.scienceHours} unit=" h" min={0} max={12} step={0.5} onChange={v=>store.setConfig({scienceHours:v})}/>
            <Range label="Límite de misión" value={store.config.maxHours} unit=" h" min={4} max={72} onChange={v=>store.setConfig({maxHours:v})}/>
            <Range label="Contingencia" value={store.config.contingencyPercent} unit="%" min={0} max={50} onChange={v=>store.setConfig({contingencyPercent:v})}/>
            <Range label="Tasa de radiación" value={store.config.radiationMsvPerHour} unit=" mSv/h" min={0} max={0.1} step={0.005} onChange={v=>store.setConfig({radiationMsvPerHour:v})} hint="Escenario constante editable; no es meteorología espacial."/>
            <Range label="Dosis máxima" value={store.config.maxRadiationMsv} unit=" mSv" min={0.1} max={5} step={0.1} onChange={v=>store.setConfig({maxRadiationMsv:v})}/>
            <label className="check-row"><input type="checkbox" checked={store.config.returnRequired} onChange={e=>store.setConfig({returnRequired:e.target.checked})}/><span><b>Regreso obligatorio</b><small>Incluye el trayecto de vuelta en distancia y recursos</small></span></label>
          </details>
        </section>
      </div>}
      {leftTab==="ares" && <div className="panel-content ares-panel">
        <div className="ares-hero"><span><Sparkles size={15}/> COPILOTO DE MISIÓN</span><h2>ARES</h2><p>Anticipa fallos antes de que la tripulación salga de la base.</p><div className={`ares-mode ${ares.mode}`}><i/>{ares.mode === "openai" ? `IA · ${ares.model}` : generativeAI ? "MOTOR LOCAL · IA DISPONIBLE" : "MOTOR PROBABILÍSTICO LOCAL"}</div></div>
        <section className="ares-probability"><div className="ares-ring" style={{"--probability": `${ares.survivalProbability * 3.6}deg`} as React.CSSProperties}><strong>{fmt(ares.survivalProbability,0)}%</strong><span>ÉXITO SIMULADO</span></div><div><span>{ares.headline.toUpperCase()}</span><b>{ares.runs.toLocaleString("es-GT")} escenarios</b><small>{ares.briefing}</small></div></section>
        <section className="ares-section"><h3><CircleGauge size={15}/> Resiliencia por restricción</h3><div className="ares-constraints">{Object.entries(ares.constraintProbabilities).map(([key,value])=><div key={key} className={key===ares.criticalFactor?"critical":""}><span>{({oxygen:"Oxígeno",energy:"Energía",water:"Agua",radiation:"Radiación",time:"Tiempo"} as Record<string,string>)[key]}{key===ares.criticalFactor&&<em>LIMITANTE</em>}</span><b>{fmt(value,0)}%</b><i><u style={{width:`${value}%`}}/></i></div>)}</div><p className="confidence-band">P10–P90 de duración: <b>{fmt(ares.confidence.durationP10)}–{fmt(ares.confidence.durationP90)} h</b></p></section>
        <section className="ares-section"><h3><Sparkles size={15}/> Plan de acción autónomo</h3>{ares.actions.length ? <div className="ares-actions">{ares.actions.map(action=><button key={action.id} onClick={()=>{store.setConfig(action.configPatch);setServerAres(null)}}><span><b>{action.label}</b><small>{action.rationale}</small></span><em>APLICAR</em></button>)}</div> : <div className="ares-clear"><Check size={16}/><span><b>Sin ajustes críticos</b><small>Los recursos conservan margen en el escenario P90.</small></span></div>}</section>
        <section className="ares-section"><h3><BrainCircuit size={15}/> Pregunta a ARES</h3><div className="ares-prompts"><button onClick={()=>setQuestion("¿Cuál es el principal riesgo?")}>Ver riesgo principal</button><button onClick={()=>setQuestion("¿Qué cambio aumenta más la probabilidad de regreso?")}>Mejorar la misión</button></div><form className="ares-query" onSubmit={e=>{e.preventDefault();void runAres()}}><textarea value={question} onChange={e=>{setQuestion(e.target.value);setServerAres(null)}} maxLength={500} placeholder="Escribe una pregunta o elige una sugerencia arriba"/><button disabled={aresLoading} aria-label="Analizar misión">{aresLoading?<LoaderCircle className="spin" size={16}/>:<Send size={16}/>} ANALIZAR</button></form><div className="ares-answer"><span>ARES / {ares.mode === "openai" ? "GENERATIVO" : "LOCAL AUDITABLE"}</span><p>{ares.answer}</p></div></section>
        <details className="ares-caveats"><summary>Qué sabe y qué no sabe ARES</summary><ul>{ares.caveats.map(item=><li key={item}>{item}</li>)}</ul></details>
      </div>}
      {leftTab==="layers" && <div className="panel-content"><div className="section-head"><span>05</span><div><h3>Capas científicas y 3D</h3><small>Controla datos y contexto orbital</small></div></div>{[{id:"imagery",name:"Relieve sombreado MOLA",meta:"NASA Mars Trek · cobertura global"},{id:"routes",name:"Corredor energético",meta:"Geodesia con pulsos de telemetría"},{id:"telemetry",name:"Balizas operacionales",meta:"Base, objetivo y posición simulada"},{id:"atmosphere",name:"Atmósfera óptica",meta:"Halo visual Fresnel · no es densidad medida"},{id:"orbits",name:"Contexto orbital",meta:"Órbitas y lunas como referencia visual"},{id:"landmarks",name:"Sitios de interés",meta:"Catálogo curado de ubicaciones"},{id:"grid",name:"Retícula planetocéntrica",meta:"Longitud positiva al este"}].map(l=><label className="layer-row" key={l.id}><div><b>{l.name}</b><small>{l.meta}</small></div><input type="checkbox" checked={store.layers[l.id]} onChange={()=>store.toggleLayer(l.id)}/><i/></label>)}<div className="warning"><AlertTriangle size={17}/><p><b>Visualización avanzada, no terreno 3D</b>La atmósfera, las órbitas y las balizas son contexto visual. No hay un DEM numérico conectado; pendiente, rocas y transitabilidad siguen como datos insuficientes.</p></div></div>}
      {leftTab==="places" && <div className="panel-content"><div className="search"><Search size={15}/><input aria-label="Buscar lugares" placeholder="Buscar cráter, volcán o región…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="places">{LANDMARKS.filter(p=>(`${p.name} ${p.kind}`).toLowerCase().includes(search.toLowerCase())).map(p=><button key={p.id} onClick={()=>chooseLandmark(p)}><span>{p.kind}</span><b>{p.name}</b><small>{p.description}</small><em>{coords(p)}</em></button>)}</div></div>}
    </aside>

    <section className="center-stage">
      <button className="side-panel-toggle left" onClick={()=>{setFocusMode(false);setLeftCollapsed(value=>!value)}} aria-label={leftCollapsed?"Mostrar configuración de misión":"Ocultar configuración de misión"} title={leftCollapsed?"Mostrar configuración":"Ocultar configuración"}>{leftCollapsed?<PanelLeftOpen size={16}/>:<PanelLeftClose size={16}/>}<span>{leftCollapsed?"Misión":"Cerrar"}</span></button>
      <button className="side-panel-toggle right" onClick={()=>{setFocusMode(false);setRightCollapsed(value=>!value)}} aria-label={rightCollapsed?"Mostrar análisis de misión":"Ocultar análisis de misión"} title={rightCollapsed?"Mostrar análisis":"Ocultar análisis"}><span>{rightCollapsed?"Análisis":"Cerrar"}</span>{rightCollapsed?<PanelRightOpen size={16}/>:<PanelRightClose size={16}/>}</button>
      {store.view==="globe" ? <AdvancedMarsGlobe route={route} simPoint={simPoint} feasible={evaluation.feasible} cinematic={cinematic}/> : store.view==="terrain" ? <TerrainLab3D route={route} progress={store.progress}/> : <MapView route={route} simPoint={simPoint}/>}
      {guideOpen && <section className="start-guide" aria-label="Guía de inicio">
        <div className="start-guide-heading"><div><span>BIENVENIDO A REDRETURN</span><h2>Tu primera misión, en tres pasos</h2><p>Empieza con una ruta de ejemplo o configura la tuya. No necesitas saber coordenadas ni parámetros técnicos.</p></div><button onClick={closeGuide} aria-label="Cerrar guía">×</button></div>
        <div className="start-guide-steps">
          <button onClick={openMissionSetup}><i>1</i><span><b>Elige un destino</b><small>Selecciona un lugar conocido o usa el mapa.</small></span><ChevronRight size={16}/></button>
          <button onClick={openTerrain}><i>2</i><span><b>Observa el terreno</b><small>Explora el relieve global 3D de Marte.</small></span><ChevronRight size={16}/></button>
          <button onClick={openAres}><i>3</i><span><b>Consulta a ARES</b><small>Obtén una explicación clara del riesgo.</small></span><ChevronRight size={16}/></button>
        </div>
        <footer><button onClick={closeGuide}>Explorar por mi cuenta</button><button className="primary" onClick={loadExampleMission}>Ver misión de ejemplo <ChevronRight size={15}/></button></footer>
      </section>}
      <div className="stage-label"><span>{store.view==="terrain"?"TOPOGRAFÍA GLOBAL / NASA MOLA":"OPERACIONES GLOBALES / MARS 2000"}</span><b>{store.view==="globe"?"GLOBO ORBITAL":store.view==="terrain"?"TERRENO GLOBAL 3D":"MAPA EQUIRECTANGULAR"}</b></div>
      <div className="route-readout"><div><Navigation size={14}/><span>RUMBO INICIAL</span><b>{fmt(bearing,0)}°</b></div><div><Globe2 size={14}/><span>SOLO IDA</span><b>{fmt(evaluation.oneWayKm)} km</b></div><div><FlaskConical size={14}/><span>CIENCIA</span><b>{fmt(store.config.scienceHours)} h</b></div></div>
      <div className={`quality-badge ${store.view==="terrain"?"conceptual":""}`}><Database size={14}/><span>{store.view==="terrain"?"DATOS DEL TERRENO":"CALIDAD DE RUTA"}</span><b>{store.view==="terrain"?"MOLA GLOBAL · 463 M":"GEOMETRÍA GLOBAL"}</b><small>{store.view==="terrain"?"Cobertura planetaria oficial":"Terreno no evaluado"}</small></div>
      {store.view==="globe" && <button className={`cinematic-toggle ${cinematic?"active":""}`} onClick={()=>setCinematic(value=>!value)}><i/>{cinematic?"ÓRBITA CINEMÁTICA":"CÁMARA MANUAL"}</button>}
      {store.view!=="terrain" && <div className="map-legend"><span><i className="base-dot"/>Base</span><span><i className="target-dot"/>Destino</span><span><i className="vehicle-dot"/>Tripulación</span></div>}
      <div className="sim-controls"><button aria-label={store.running?"Pausar":"Iniciar"} aria-pressed={store.running} onClick={()=>store.setRunning(!store.running)}>{store.running?<Pause size={17}/>:<Play size={17}/>}</button><button aria-label="Reiniciar" onClick={store.reset}><RotateCcw size={16}/></button><div aria-live="polite"><span>{phase} · {fmt(store.progress*100,0)}%</span><div className="progress" role="progressbar" aria-label="Progreso de simulación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(store.progress*100)}><i style={{width:`${store.progress*100}%`}}/></div></div><select aria-label="Velocidad de simulación" value={store.simSpeed} onChange={e=>store.setSimSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={4}>4×</option><option value={12}>12×</option></select></div>
    </section>

    <aside className="right-panel panel"><div className="panel-title"><div><span>ANÁLISIS DE MISIÓN</span><small>Modelo determinista v1.1</small></div><i className={evaluation.feasible?"ok":"bad"}>{evaluation.feasible?"VIABLE EN MODELO":"REVISAR MISIÓN"}</i></div>
      <div className="mission-score"><div className={evaluation.feasible?"score-ring pass":"score-ring fail"}><strong>{evaluation.feasible ? "OK" : "!"}</strong><span>RECURSOS</span></div><div><span>MARGEN LIMITANTE</span><b className={evaluation.limitingMarginPercent >= 0 ? "positive":"negative"}>{evaluation.limitingMarginPercent >= 0 ? "+":""}{fmt(evaluation.limitingMarginPercent,0)}%</b><small>Menor holgura entre todos los límites configurados</small></div></div>
      <div className="metric-grid"><Metric icon={Globe2} label="DISTANCIA TOTAL" value={`${fmt(evaluation.distanceKm)} km`}/><Metric icon={Timer} label="DURACIÓN" value={`${fmt(evaluation.durationHours)} h`} tone={evaluation.constraints.time?"green":"red"}/><Metric icon={Activity} label="OXÍGENO" value={`${fmt(evaluation.oxygenRemaining)} kg`} tone={evaluation.constraints.oxygen?"green":"red"}/><Metric icon={Zap} label="ENERGÍA" value={`${fmt(evaluation.energyRemaining)} kWh`} tone={evaluation.constraints.energy?"green":"red"}/><Metric icon={Droplets} label="AGUA" value={`${fmt(evaluation.waterRemaining)} L`} tone={evaluation.constraints.water?"green":"red"}/><Metric icon={Radiation} label="RADIACIÓN" value={`${fmt(evaluation.radiationMsv,2)} mSv`} tone={evaluation.constraints.radiation?"green":"red"}/></div>
      <section className="analysis"><h3><CircleGauge size={16}/> Márgenes normalizados</h3>{[
        ["Oxígeno",evaluation.oxygenRemaining,store.config.oxygenKg,evaluation.constraints.oxygen],
        ["Energía",evaluation.energyRemaining,store.config.energyKwh,evaluation.constraints.energy],
        ["Agua",evaluation.waterRemaining,store.config.waterLiters,evaluation.constraints.water],
        ["Tiempo",store.config.maxHours-evaluation.durationHours,store.config.maxHours,evaluation.constraints.time],
        ["Radiación",store.config.maxRadiationMsv-evaluation.radiationMsv,store.config.maxRadiationMsv,evaluation.constraints.radiation],
      ].map(([name,left,total,pass])=><div className="resource" key={String(name)}><span>{name}<b className={pass?"":"negative"}>{fmt(Number(left))}</b></span><div><i className={pass?"":"failed"} style={{width:`${clamp(Number(left)/Number(total)*100,0,100)}%`}}/></div></div>)}</section>
      <section className="analysis"><h3><ShieldCheck size={16}/> Dictamen transparente</h3><div className={`risk ${evaluation.feasible?"favorable":"high"}`}><span>ESTADO COMPUESTO</span><b>{evaluation.feasible?"FAVORABLE DENTRO DEL MODELO":"RIESGO DE RECURSOS ALTO"}</b><small>Componente de terreno: DATOS INSUFICIENTES</small></div><ul className="reasons">{evaluation.reasons.map(r=><li key={r}>{r}</li>)}</ul></section>
      <section className="analysis assumptions"><h3><Users size={16}/> Registro de hipótesis</h3><p>Consumo O₂ <b>{store.config.oxygenKgPerPersonHour} kg/persona·h</b></p><p>Consumo de agua <b>{store.config.waterLitersPerPersonDay} L/persona·día</b></p><p>Consumo energético <b>{store.config.energyKwhPerHour} kWh/h</b></p><p>Contingencia <b>{store.config.contingencyPercent}%</b></p><small>Valores editables para comparar escenarios; no son certificación médica ni operacional.</small></section>
    </aside>

    <section className="bottom-panel panel" aria-label="Datos de la misión"><nav className="bottom-tabs"><button className={bottomTab==="profile"?"active":""} onClick={()=>{setBottomTab("profile");setDrawerOpen(true)}}>Recursos</button><button className={bottomTab==="terrain"?"active":""} onClick={()=>{setBottomTab("terrain");setDrawerOpen(true)}}>Terreno</button><button className={bottomTab==="routes"?"active":""} onClick={()=>{setBottomTab("routes");setDrawerOpen(true)}}>Rutas</button><button className={bottomTab==="sources"?"active":""} onClick={()=>{setBottomTab("sources");setDrawerOpen(true)}}>Fuentes</button><button className="drawer-toggle" onClick={()=>setDrawerOpen(value=>!value)} aria-expanded={drawerOpen} aria-label={drawerOpen?"Minimizar panel de datos":"Abrir panel de datos"}>{drawerOpen?<ChevronDown size={16}/>:<ChevronUp size={16}/>}<span>{drawerOpen?"Minimizar":"Datos"}</span></button></nav>
      {bottomTab==="profile" && <div className="chart-wrap"><div className="chart-legend"><span className="oxygen">Oxígeno kg</span><span className="energy">Energía kWh</span><span className="water">Agua L</span><em>Perfil de elevación no disponible · DEM sin montar</em></div><ResponsiveContainer width="100%" height="100%"><LineChart data={timeline} margin={{top:8,right:10,bottom:0,left:-15}}><XAxis dataKey="h" stroke="#747a7e" tick={{fontSize:10}}/><YAxis stroke="#747a7e" tick={{fontSize:10}}/><Tooltip contentStyle={{background:"#191d20",border:"1px solid #3a4044",fontSize:11,borderRadius:9}} labelFormatter={v=>`${v} h`}/><ChartLine dataKey="oxygen" name="Oxígeno" stroke="#91a7aa" dot={false} strokeWidth={2}/><ChartLine dataKey="energy" name="Energía" stroke="#ce7657" dot={false} strokeWidth={2}/><ChartLine dataKey="water" name="Agua" stroke="#9c92a6" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></div>}
      {bottomTab==="terrain" && <div className="chart-wrap terrain-profile-chart"><div className="chart-legend"><span className="terrain-height">Relieve proxy m</span><span className="terrain-slope">Pendiente conceptual °</span><em>Modelo reproducible · no procede de MOLA/HRSC</em></div><ResponsiveContainer width="100%" height="100%"><AreaChart data={terrainModel.profile.map(point=>({km:Number(point.distanceKm.toFixed(2)),elevation:Number(point.elevationM.toFixed(1)),slope:Number(point.slopeDeg.toFixed(1)),risk:point.risk}))} margin={{top:8,right:18,bottom:0,left:-10}}><defs><linearGradient id="terrainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ce7657" stopOpacity={.42}/><stop offset="100%" stopColor="#ce7657" stopOpacity={.03}/></linearGradient></defs><XAxis dataKey="km" stroke="#747a7e" tick={{fontSize:10}} unit=" km"/><YAxis yAxisId="elevation" stroke="#9b7364" tick={{fontSize:10}}/><YAxis yAxisId="slope" orientation="right" stroke="#c9a06b" tick={{fontSize:10}} unit="°"/><Tooltip contentStyle={{background:"#191d20",border:"1px solid #3a4044",fontSize:11,borderRadius:9}} labelFormatter={v=>`${v} km`}/><Area yAxisId="elevation" dataKey="elevation" name="Relieve proxy" stroke="#ce7657" fill="url(#terrainFill)" strokeWidth={2}/><ChartLine yAxisId="slope" dataKey="slope" name="Pendiente conceptual" stroke="#c9a06b" dot={false} strokeWidth={1.5}/></AreaChart></ResponsiveContainer></div>}
      {bottomTab==="routes" && <div className="route-table"><div className="table-head"><span>ESTRATEGIA</span><span>SOLO IDA</span><span>DURACIÓN</span><span>CALIDAD</span><span>ESTADO</span></div>{routes.map(r=>{const ev=evaluateMission(r.points,store.config);const meta=STRATEGIES.find(s=>s.id===r.strategy)!;return <button key={r.strategy} className={store.strategy===r.strategy?"active":""} onClick={()=>store.setStrategy(r.strategy)}><b>{meta.name}<small>{meta.description}</small></b><span>{fmt(routeDistance(r.points))} km</span><span>{fmt(ev.durationHours)} h</span><span>Geométrica global</span><em className={ev.feasible?"ok":"bad"}>{ev.feasible?"Cumple":"Falla"}</em></button>})}</div>}
      {bottomTab==="sources" && <div className="sources">{SOURCES.map(s=><a key={s.name} href={s.url} target="_blank" rel="noreferrer"><Database size={17}/><div><b>{s.name}</b><span>{s.role}</span></div><em>{s.status==="live"?"VISUAL":"CATÁLOGO"}</em></a>)}<div className="convention"><b>CONVENCIÓN DE COORDENADAS</b><span>Mars 2000 · latitud planetocéntrica · longitud positiva al este · interfaz normalizada de −180° a +180°</span></div></div>}
    </section>
  </main>;
}
