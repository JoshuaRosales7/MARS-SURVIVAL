"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls, Stars, useTexture } from "@react-three/drei";
import { Activity, AlertTriangle, Box, CircleGauge, Database, Download, Gauge, Globe2, Layers3, Map, MapPin, Pause, Play, RotateCcw, Search, ShieldCheck, Timer, Users, Zap } from "lucide-react";
import { LineChart, Line as ChartLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Color, DoubleSide, SRGBColorSpace, Vector3 } from "three";
import { jsPDF } from "jspdf";
import { LANDMARKS, SOURCES, type Landmark } from "@/data/mars";
import { buildRoute, coordinateToVector, evaluateMission, normalizeLon, routeDistance, type Coordinate, type Strategy } from "@/lib/mars";
import { useMissionStore } from "@/lib/store";

const TILE_BASE = process.env.NEXT_PUBLIC_MARS_TILE_BASE || "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm";
const TILE_WEST = `${TILE_BASE}/0/0/0.jpg`;
const TILE_EAST = `${TILE_BASE}/0/0/1.jpg`;

function fmt(value: number, digits = 1) { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }
function coords(p: Coordinate) { return `${Math.abs(p.lat).toFixed(3)}°${p.lat >= 0 ? "N" : "S"}  ${Math.abs(p.lon).toFixed(3)}°${p.lon >= 0 ? "E" : "W"}`; }

function MarsSphere({ route, simPoint }: { route: Coordinate[]; simPoint: Coordinate }) {
  const [west, east] = useTexture([TILE_WEST, TILE_EAST]);
  west.colorSpace = SRGBColorSpace; east.colorSpace = SRGBColorSpace;
  const { setPoint, setCursor, layers, base, destination } = useMissionStore();
  const handlePoint = (event: ThreeEvent<PointerEvent | MouseEvent>, commit: boolean) => {
    event.stopPropagation();
    const p = event.point.clone().normalize();
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, p.y))) * 180 / Math.PI;
    const lon = normalizeLon(Math.atan2(p.z, -p.x) * 180 / Math.PI - 180);
    (commit ? setPoint : setCursor)({ lat, lon });
  };
  const routeVectors = route.map((p) => new Vector3(...coordinateToVector(p, 2.035)));
  return <group rotation={[0, -Math.PI / 2, 0]}>
    <mesh onPointerMove={(e) => handlePoint(e, false)} onClick={(e) => handlePoint(e, true)}>
      <sphereGeometry args={[2, 128, 64, 0, Math.PI]} />
      <meshStandardMaterial map={west} roughness={0.96} metalness={0.02} />
    </mesh>
    <mesh scale={1.001} onPointerMove={(e) => handlePoint(e, false)} onClick={(e) => handlePoint(e, true)}>
      <sphereGeometry args={[2, 128, 64, Math.PI, Math.PI]} />
      <meshStandardMaterial map={east} roughness={0.96} side={DoubleSide} />
    </mesh>
    {layers.grid && <mesh scale={1.004}><sphereGeometry args={[2, 36, 18]} /><meshBasicMaterial color="#53b9dc" wireframe transparent opacity={0.15} /></mesh>}
    {layers.routes && <Line points={routeVectors} color="#53b9dc" lineWidth={2.2} />}
    {[{ p: base, c: "#46c69a" }, { p: destination, c: "#e98548" }].map(({ p, c }, i) => <mesh key={i} position={coordinateToVector(p, 2.07)}><sphereGeometry args={[0.045, 16, 16]} /><meshBasicMaterial color={c} /></mesh>)}
    <mesh position={coordinateToVector(simPoint, 2.09)}><sphereGeometry args={[0.035, 12, 12]} /><meshBasicMaterial color="#f3f6fc" /></mesh>
    <pointLight position={[3, 2, 4]} intensity={25} color={new Color("#f2b187")} />
    <ambientLight intensity={0.35} color="#6987a8" />
  </group>;
}

function GlobeView({ route, simPoint }: { route: Coordinate[]; simPoint: Coordinate }) {
  return <div className="globe-view"><Canvas camera={{ position: [0, 0.2, 5.8], fov: 42 }} gl={{ antialias: true }}>
    <color attach="background" args={["#050912"]} /><Stars radius={70} depth={38} count={1300} factor={2.2} fade speed={0.25} />
    <MarsSphere route={route} simPoint={simPoint} /><OrbitControls enablePan={false} minDistance={2.45} maxDistance={9} dampingFactor={0.06} enableDamping />
  </Canvas></div>;
}

function MapView({ route, simPoint }: { route: Coordinate[]; simPoint: Coordinate }) {
  const { setPoint, setCursor, base, destination, layers } = useMissionStore();
  const project = (p: Coordinate) => ({ x: (normalizeLon(p.lon) + 180) / 360 * 1000, y: (90 - p.lat) / 180 * 500 });
  const path = route.map((p, i) => `${i ? "L" : "M"}${project(p).x},${project(p).y}`).join(" ");
  const click = (e: React.MouseEvent<HTMLDivElement>, commit: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { lon: normalizeLon((e.clientX - r.left) / r.width * 360 - 180), lat: 90 - (e.clientY - r.top) / r.height * 180 };
    (commit ? setPoint : setCursor)(p);
  };
  return <div className="map-view" onMouseMove={(e) => click(e, false)} onClick={(e) => click(e, true)}>
    <div className="map-tiles"><img src={TILE_WEST} alt="Western hemisphere MOLA hillshade" /><img src={TILE_EAST} alt="Eastern hemisphere MOLA hillshade" /></div>
    <svg viewBox="0 0 1000 500" preserveAspectRatio="none">
      {layers.grid && <g className="grid-lines">{[-60,-30,0,30,60].map(lat => <line key={lat} x1="0" x2="1000" y1={(90-lat)/180*500} y2={(90-lat)/180*500} />)}{[-120,-60,0,60,120].map(lon => <line key={lon} y1="0" y2="500" x1={(lon+180)/360*1000} x2={(lon+180)/360*1000} />)}</g>}
      {layers.routes && <path d={path} className="route-path" />}
      {[{p:base,c:"#46c69a"},{p:destination,c:"#e98548"},{p:simPoint,c:"#fff"}].map(({p,c},i)=><circle key={i} cx={project(p).x} cy={project(p).y} r={i===2?4:6} fill={c} />)}
    </svg>
    <span className="map-credit">NASA Mars Trek · MGS MOLA color hillshade · 463 m/px source product</span>
  </div>;
}

function Metric({ icon: Icon, label, value, tone = "blue" }: { icon: typeof Gauge; label: string; value: string; tone?: string }) {
  return <div className={`metric ${tone}`}><Icon size={15}/><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function Range({ label, value, unit, min, max, step = 1, onChange }: { label: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <label className="range"><span>{label}<b>{value}{unit}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))}/></label>;
}

export default function MarsCommandCenter() {
  const store = useMissionStore();
  const [leftTab, setLeftTab] = useState<"plan"|"layers"|"places">("plan");
  const [bottomTab, setBottomTab] = useState<"profile"|"routes"|"sources">("profile");
  const [search, setSearch] = useState("");
  const routes = useMemo(() => (["direct","conservative","science","limited"] as Strategy[]).map(strategy => ({ strategy, points: buildRoute(store.base, store.destination, strategy) })), [store.base, store.destination]);
  const route = routes.find(r => r.strategy === store.strategy)!.points;
  const evaluation = useMemo(() => evaluateMission(route, store.config), [route, store.config]);
  const simIndex = Math.min(route.length - 1, Math.floor(store.progress * (route.length - 1)));
  const simPoint = route[simIndex] || store.base;
  useEffect(() => {
    if (!store.running) return;
    const id = window.setInterval(() => store.setProgress(Math.min(1, store.progress + 0.0025 * store.simSpeed)), 80);
    if (store.progress >= 1) store.setRunning(false);
    return () => window.clearInterval(id);
  }, [store.running, store.progress, store.simSpeed, store.setProgress, store.setRunning]);
  const timeline = Array.from({length: 13}, (_,i) => {
    const f=i/12, hours=evaluation.durationHours*f;
    return { h: Number(hours.toFixed(1)), oxygen: Math.max(0, store.config.oxygenKg - evaluation.oxygenUsedKg*f), energy: Math.max(0, store.config.energyKwh - evaluation.energyUsedKwh*f) };
  });
  const chooseLandmark = (place: Landmark) => { store.setPoint(place); setLeftTab("plan"); };
  const exportMission = async (type: "json"|"geojson"|"pdf") => {
    const payload = { schema: "mars-survival/1.0", coordinateConvention: "planetocentric latitude, east-positive longitude normalized to -180..180", mission: { base: store.base, destination: store.destination, strategy: store.strategy, config: store.config }, result: evaluation, route, scientificLimitations: ["Global geometric route only", "No route-specific DEM profile loaded", "Resource rates are editable illustrative assumptions"] };
    if (type === "pdf") { const doc = new jsPDF(); doc.setFillColor(8,13,23); doc.rect(0,0,210,297,"F"); doc.setTextColor(233,133,72); doc.setFontSize(22); doc.text("MARS SURVIVAL",18,24); doc.setTextColor(243,246,252); doc.setFontSize(11); ["Mission intelligence report",`Base: ${coords(store.base)}`,`Destination: ${coords(store.destination)}`,`Strategy: ${store.strategy}`,`Round-trip distance: ${fmt(evaluation.distanceKm)} km`,`Estimated duration: ${fmt(evaluation.durationHours)} h`,`Model result: ${evaluation.feasible?"FAVORABLE":"CONSTRAINT FAILED"}`,"",...evaluation.reasons,"","Scientific limitation: geometric global route; terrain safety not evaluated.","Sources: NASA Mars Trek WMTS, NASA PDS MOLA MEGDR, USGS Planetary Names."].forEach((line,i)=>doc.text(line,18,40+i*8)); doc.save("mars-survival-report.pdf"); return; }
    const body = type === "geojson" ? { type:"FeatureCollection", crs:{type:"name",properties:{name:"IAU Mars 2000; planetocentric; longitude east-positive"}}, features:[{type:"Feature",properties:{strategy:store.strategy,quality:"global-geometric",distance_km:evaluation.distanceKm},geometry:{type:"LineString",coordinates:route.map(p=>[p.lon,p.lat])}}] } : payload;
    const blob = new Blob([JSON.stringify(body,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`mars-survival.${type}`; a.click(); URL.revokeObjectURL(a.href);
  };
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Globe2 size={20}/></span><div><b>MARS SURVIVAL</b><small>EXPLORE FARTHER · RETURN SAFER</small></div></div>
      <div className="location"><span>ACTIVE SECTOR</span><b>{coords(store.cursor)}</b></div>
      <div className="view-switch"><button className={store.view==="globe"?"active":""} onClick={()=>store.setView("globe")}><Box size={15}/> Globe</button><button className={store.view==="map"?"active":""} onClick={()=>store.setView("map")}><Map size={15}/> Map</button></div>
      <div className="source-state"><i/> SCIENCE SOURCES ONLINE</div>
      <div className="export-menu"><Download size={16}/><select aria-label="Export mission" defaultValue="" onChange={(e)=>{if(e.target.value) exportMission(e.target.value as "json"|"geojson"|"pdf");e.target.value=""}}><option value="" disabled>Export mission</option><option value="pdf">PDF report</option><option value="json">Mission JSON</option><option value="geojson">Route GeoJSON</option></select></div>
    </header>
    <aside className="left-panel panel">
      <nav className="tabs"><button className={leftTab==="plan"?"active":""} onClick={()=>setLeftTab("plan")}><MapPin size={15}/> Plan</button><button className={leftTab==="layers"?"active":""} onClick={()=>setLeftTab("layers")}><Layers3 size={15}/> Layers</button><button className={leftTab==="places"?"active":""} onClick={()=>setLeftTab("places")}><Search size={15}/> Places</button></nav>
      {leftTab==="plan" && <div className="panel-content">
        <section><div className="section-head"><span>01</span><h3>Route definition</h3></div><div className="segmented"><button className={store.selection==="base"?"active":""} onClick={()=>store.setSelection("base")}>Set base</button><button className={store.selection==="destination"?"active":""} onClick={()=>store.setSelection("destination")}>Set target</button></div><div className="point-card base"><i/><div><span>BASE</span><b>{store.base.name || coords(store.base)}</b><small>{coords(store.base)}</small></div></div><div className="route-spine"/><div className="point-card target"><i/><div><span>DESTINATION</span><b>{store.destination.name || coords(store.destination)}</b><small>{coords(store.destination)}</small></div></div><p className="hint">Select “base” or “target”, then click anywhere on Mars.</p></section>
        <section><div className="section-head"><span>02</span><h3>Route strategy</h3></div><div className="strategy-grid">{([ ["direct","Direct","Shortest geometric arc"], ["conservative","Conservative","Illustrative detour; DEM pending"], ["science","Science","Illustrative objective detour"], ["limited","Resource","Checks configured budgets"] ] as [Strategy,string,string][]).map(([id,title,sub])=><button key={id} className={store.strategy===id?"active":""} onClick={()=>store.setStrategy(id)}><b>{title}</b><small>{sub}</small></button>)}</div></section>
        <section><div className="section-head"><span>03</span><h3>Mission constraints</h3></div><Range label="Crew" value={store.config.crew} unit="" min={1} max={6} onChange={v=>store.setConfig({crew:v})}/><Range label="Travel speed" value={store.config.speedKmh} unit=" km/h" min={1} max={15} step={0.5} onChange={v=>store.setConfig({speedKmh:v})}/><Range label="Oxygen" value={store.config.oxygenKg} unit=" kg" min={2} max={100} onChange={v=>store.setConfig({oxygenKg:v})}/><Range label="Energy" value={store.config.energyKwh} unit=" kWh" min={5} max={150} onChange={v=>store.setConfig({energyKwh:v})}/><Range label="Reserve" value={store.config.reservePercent} unit="%" min={5} max={50} onChange={v=>store.setConfig({reservePercent:v})}/></section>
      </div>}
      {leftTab==="layers" && <div className="panel-content"><div className="section-head"><span>04</span><h3>Scientific layers</h3></div>{[{id:"imagery",name:"MOLA color hillshade",meta:"NASA Mars Trek · global"},{id:"routes",name:"Mission routes",meta:"Computed great-circle geometry"},{id:"landmarks",name:"Named locations",meta:"Curated documented features"},{id:"grid",name:"Coordinate grid",meta:"Planetocentric · +East"}].map(l=><label className="layer-row" key={l.id}><div><b>{l.name}</b><small>{l.meta}</small></div><input type="checkbox" checked={store.layers[l.id]} onChange={()=>store.toggleLayer(l.id)}/><i/></label>)}<div className="warning"><AlertTriangle size={16}/><p><b>Terrain analysis unavailable</b>Route-specific elevation, slope and obstacle assessment require a DEM profile. No values are synthesized.</p></div></div>}
      {leftTab==="places" && <div className="panel-content"><div className="search"><Search size={15}/><input placeholder="Search Mars…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="places">{LANDMARKS.filter(p=>p.name!.toLowerCase().includes(search.toLowerCase())).map(p=><button key={p.id} onClick={()=>chooseLandmark(p)}><span>{p.kind}</span><b>{p.name}</b><small>{p.description}</small><em>{coords(p)}</em></button>)}</div></div>}
    </aside>
    <section className="center-stage">
      {store.view==="globe" ? <GlobeView route={route} simPoint={simPoint}/> : <MapView route={route} simPoint={simPoint}/>} 
      <div className="stage-label"><span>GLOBAL OPS / MARS 2000</span><b>{store.view==="globe"?"ORBITAL GLOBE":"EQUIRECTANGULAR MAP"}</b></div>
      <div className="quality-badge"><Database size={14}/><span>ROUTE QUALITY</span><b>GLOBAL GEOMETRIC</b></div>
      <div className="sim-controls"><button onClick={()=>store.setRunning(!store.running)}>{store.running?<Pause size={17}/>:<Play size={17}/>}</button><button onClick={store.reset}><RotateCcw size={16}/></button><div><span>MISSION PROGRESS</span><div className="progress"><i style={{width:`${store.progress*100}%`}}/></div></div><select value={store.simSpeed} onChange={e=>store.setSimSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={4}>4×</option><option value={12}>12×</option></select></div>
    </section>
    <aside className="right-panel panel"><div className="panel-title"><span>MISSION ANALYSIS</span><i className={evaluation.feasible?"ok":"bad"}>{evaluation.feasible?"FAVORABLE":"CONSTRAINT FAILED"}</i></div><div className="metric-grid"><Metric icon={Globe2} label="ROUND TRIP" value={`${fmt(evaluation.distanceKm)} km`}/><Metric icon={Timer} label="DURATION" value={`${fmt(evaluation.durationHours)} h`}/><Metric icon={Zap} label="ENERGY LEFT" value={`${fmt(evaluation.energyRemaining)} kWh`} tone={evaluation.constraints.energy?"green":"red"}/><Metric icon={Activity} label="O₂ LEFT" value={`${fmt(evaluation.oxygenRemaining)} kg`} tone={evaluation.constraints.oxygen?"green":"red"}/></div>
      <section className="analysis"><h3><CircleGauge size={16}/> Resource margins</h3>{[["Oxygen", evaluation.oxygenRemaining, store.config.oxygenKg],["Energy",evaluation.energyRemaining,store.config.energyKwh],["Time",store.config.maxHours-evaluation.durationHours,store.config.maxHours]].map(([name,left,total])=><div className="resource" key={String(name)}><span>{name}<b>{fmt(Number(left))}</b></span><div><i style={{width:`${Math.max(0,Math.min(100,Number(left)/Number(total)*100))}%`}}/></div></div>)}</section>
      <section className="analysis"><h3><ShieldCheck size={16}/> Model assessment</h3><div className={`risk ${evaluation.feasible?"favorable":"high"}`}><span>COMPOSITE STATUS</span><b>{evaluation.feasible?"FAVORABLE WITHIN MODEL":"HIGH RESOURCE RISK"}</b><small>Terrain component: DATA INSUFFICIENT</small></div><ul className="reasons">{evaluation.reasons.map(r=><li key={r}>{r}</li>)}</ul></section>
      <section className="analysis assumptions"><h3><Users size={16}/> Assumption register</h3><p>O₂ rate <b>{store.config.oxygenKgPerPersonHour} kg/person·h</b></p><p>Energy rate <b>{store.config.energyKwhPerHour} kWh/h</b></p><p>Contingency <b>{store.config.contingencyPercent}%</b></p><small>Editable planning hypotheses—not medical or operational certification.</small></section>
    </aside>
    <section className="bottom-panel panel"><nav className="bottom-tabs"><button className={bottomTab==="profile"?"active":""} onClick={()=>setBottomTab("profile")}>Resource profile</button><button className={bottomTab==="routes"?"active":""} onClick={()=>setBottomTab("routes")}>Route comparison</button><button className={bottomTab==="sources"?"active":""} onClick={()=>setBottomTab("sources")}>Scientific metadata</button></nav>
      {bottomTab==="profile" && <div className="chart-wrap"><div className="chart-legend"><span className="oxygen">Oxygen kg</span><span className="energy">Energy kWh</span><em>Elevation profile unavailable — DEM not loaded</em></div><ResponsiveContainer width="100%" height="100%"><LineChart data={timeline} margin={{top:8,right:10,bottom:0,left:-15}}><XAxis dataKey="h" stroke="#60748c" tick={{fontSize:10}}/><YAxis stroke="#60748c" tick={{fontSize:10}}/><Tooltip contentStyle={{background:"#111c2a",border:"1px solid #30445c",fontSize:11}}/><ChartLine dataKey="oxygen" stroke="#53b9dc" dot={false} strokeWidth={2}/><ChartLine dataKey="energy" stroke="#e98548" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></div>}
      {bottomTab==="routes" && <div className="route-table"><div className="table-head"><span>STRATEGY</span><span>ONE-WAY</span><span>EST. TIME</span><span>QUALITY</span><span>STATUS</span></div>{routes.map(r=>{const ev=evaluateMission(r.points,store.config);return <button key={r.strategy} className={store.strategy===r.strategy?"active":""} onClick={()=>store.setStrategy(r.strategy)}><b>{r.strategy.toUpperCase()}</b><span>{fmt(routeDistance(r.points))} km</span><span>{fmt(ev.durationHours)} h</span><span>Global geometric</span><em className={ev.feasible?"ok":"bad"}>{ev.feasible?"Pass":"Fail"}</em></button>})}</div>}
      {bottomTab==="sources" && <div className="sources">{SOURCES.map(s=><a key={s.name} href={s.url} target="_blank" rel="noreferrer"><Database size={17}/><div><b>{s.name}</b><span>{s.role}</span></div><em>{s.status}</em></a>)}<div className="convention"><b>COORDINATE CONVENTION</b><span>Mars 2000 · planetocentric latitude · east-positive longitude · UI normalized −180° to +180°</span></div></div>}
    </section>
  </main>;
}
