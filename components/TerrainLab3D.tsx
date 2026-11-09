"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Html, Line, OrbitControls, useTexture } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import { Color, DoubleSide, Group, Mesh, SRGBColorSpace, Vector3 } from "three";
import { normalizeLon, routeDistance, type Coordinate } from "@/lib/mars";
import { LANDMARKS } from "@/data/mars";
import { useMissionStore } from "@/lib/store";

const COLOR_TEXTURE = "/data/mars-mola-topography.jpg";
const HEIGHT_TEXTURE = "/data/mars-mola-heightmap.png";
const MAP_WIDTH = 14;
const MAP_HEIGHT = 7;

type CameraPreset = "oblique" | "top" | "low" | "route";

function coordinateToTerrain(point: Coordinate, elevation: number) {
  return new Vector3(
    normalizeLon(point.lon) / 180 * MAP_WIDTH / 2,
    elevation,
    -point.lat / 90 * MAP_HEIGHT / 2,
  );
}

function terrainToCoordinate(point: Vector3): Coordinate {
  return {
    lat: Math.max(-90, Math.min(90, -point.z / (MAP_HEIGHT / 2) * 90)),
    lon: normalizeLon(point.x / (MAP_WIDTH / 2) * 180),
  };
}

function TerrainSurface({ exaggeration, contours, colorized, onHover, onSelect }: {
  exaggeration: number;
  contours: boolean;
  colorized: boolean;
  onHover: (point: Coordinate) => void;
  onSelect: (point: Coordinate) => void;
}) {
  const lastHover = useRef(0);
  const [colorMap, heightMap] = useTexture([COLOR_TEXTURE, HEIGHT_TEXTURE]);
  colorMap.colorSpace = SRGBColorSpace;
  colorMap.anisotropy = 12;
  heightMap.anisotropy = 8;
  const scale = .92 * exaggeration;
  const bias = -.46 * exaggeration;

  return <group>
    <mesh position={[0, bias - .16, 0]} receiveShadow>
      <boxGeometry args={[MAP_WIDTH + .12, .32, MAP_HEIGHT + .12]} />
      <meshStandardMaterial color="#171413" roughness={1} />
    </mesh>
    <mesh
      castShadow
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        const now = performance.now();
        if (now - lastHover.current < 45) return;
        lastHover.current = now;
        onHover(terrainToCoordinate(event.point));
      }}
      onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(terrainToCoordinate(event.point)); }}
    >
      <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT, 384, 192]} />
      <meshStandardMaterial
        map={colorized ? colorMap : null}
        color={colorized ? "#ffffff" : "#986048"}
        displacementMap={heightMap}
        displacementScale={scale}
        displacementBias={bias}
        roughness={.9}
        metalness={.01}
        side={DoubleSide}
      />
    </mesh>
    {contours && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .006, 0]}>
      <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT, 160, 80]} />
      <meshStandardMaterial
        color="#f2deca"
        displacementMap={heightMap}
        displacementScale={scale}
        displacementBias={bias}
        wireframe
        transparent
        opacity={.055}
        depthWrite={false}
        roughness={1}
      />
    </mesh>}
  </group>;
}

function LandmarkLayer({ elevation, onSelect }: { elevation: number; onSelect: (point: Coordinate) => void }) {
  return <group>{LANDMARKS.map(landmark => {
    const position = coordinateToTerrain(landmark, elevation);
    return <group key={landmark.id} position={position}>
      <mesh onClick={event => { event.stopPropagation(); onSelect(landmark); }}>
        <cylinderGeometry args={[.018, .032, .16, 10]} />
        <meshBasicMaterial color="#e7be91" />
      </mesh>
      <mesh position={[0, .1, 0]}><sphereGeometry args={[.038, 12, 8]} /><meshBasicMaterial color="#f1c28e" /></mesh>
      <Html position={[0, .19, 0]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
        <div className="terrain-landmark-label"><b>{landmark.name}</b><span>{landmark.kind}</span></div>
      </Html>
    </group>;
  })}</group>;
}

function GeographicGrid({ elevation }: { elevation: number }) {
  const lines = useMemo(() => {
    const result: { points: Vector3[]; major: boolean }[] = [];
    for (let lat = -75; lat <= 75; lat += 15) {
      result.push({
        points: [coordinateToTerrain({ lat, lon: -180 }, elevation), coordinateToTerrain({ lat, lon: 179.999 }, elevation)],
        major: lat % 45 === 0,
      });
    }
    for (let lon = -165; lon <= 165; lon += 15) {
      result.push({
        points: [coordinateToTerrain({ lat: -90, lon }, elevation), coordinateToTerrain({ lat: 90, lon }, elevation)],
        major: lon % 45 === 0,
      });
    }
    return result;
  }, [elevation]);
  return <group>{lines.map((line, index) => <Line key={index} points={line.points} color="#f1e8dc" lineWidth={line.major ? .8 : .45} transparent opacity={line.major ? .28 : .12} depthWrite={false} />)}</group>;
}

function TerrainMarker({ point, color, elevation }: { point: Coordinate; color: string; elevation: number }) {
  const position = coordinateToTerrain(point, elevation);
  return <group position={position}>
    <mesh position={[0, .16, 0]}><cylinderGeometry args={[.012, .03, .32, 10]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[0, .34, 0]}><octahedronGeometry args={[.06, 0]} /><meshBasicMaterial color={color} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.1, .15, 32]} /><meshBasicMaterial color={color} transparent opacity={.9} side={DoubleSide} /></mesh>
  </group>;
}

function TerrainRoute({ route, progress, elevation }: { route: Coordinate[]; progress: number; elevation: number }) {
  const points = useMemo(() => route.map(point => coordinateToTerrain(point, elevation)), [route, elevation]);
  const vehicle = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!vehicle.current) return;
    const target = points[Math.min(points.length - 1, Math.floor(progress * (points.length - 1)))];
    vehicle.current.position.lerp(target, .14);
    const pulse = 1 + Math.sin(clock.elapsedTime * 4.5) * .14;
    vehicle.current.scale.setScalar(pulse);
  });
  return <group>
    <Line points={points} color="#101414" lineWidth={9} transparent opacity={.4} depthWrite={false} />
    <Line points={points} color="#eef5ef" lineWidth={3.2} />
    <Line points={points} color="#70d4b8" lineWidth={1.1} dashed dashScale={26} dashSize={.42} gapSize={.5} />
    <TerrainMarker point={route[0]} color="#76d0a4" elevation={elevation} />
    <TerrainMarker point={route.at(-1)!} color="#ff8363" elevation={elevation} />
    <mesh ref={vehicle} position={points[0]}>
      <icosahedronGeometry args={[.065, 1]} />
      <meshBasicMaterial color="#ffffff" />
      <pointLight color="#9ae4cf" intensity={1.7} distance={1.2} />
    </mesh>
  </group>;
}

function CameraRig({ preset, routeTarget }: { preset: CameraPreset; routeTarget: Vector3 }) {
  const { camera } = useThree();
  const previous = useRef(preset);
  const moving = useRef(false);
  const positions = useMemo<Record<CameraPreset, Vector3>>(() => ({
    oblique: new Vector3(0, 6.6, 8.7),
    top: new Vector3(0, 11.7, .01),
    low: new Vector3(0, 2.8, 6.6),
    route: routeTarget.clone().add(new Vector3(0, 3.2, 4.4)),
  }), [routeTarget]);
  useFrame((_, delta) => {
    if (previous.current !== preset) { previous.current = preset; moving.current = true; }
    if (!moving.current) return;
    camera.position.lerp(positions[preset], 1 - Math.exp(-delta * 4.5));
    camera.lookAt(preset === "route" ? routeTarget : new Vector3(0, 0, 0));
    if (camera.position.distanceTo(positions[preset]) < .03) moving.current = false;
  });
  return null;
}

function GlobalTerrainScene({ route, progress, exaggeration, grid, contours, colorized, landmarks, preset, onHover, onSelect }: {
  route: Coordinate[];
  progress: number;
  exaggeration: number;
  grid: boolean;
  contours: boolean;
  colorized: boolean;
  landmarks: boolean;
  preset: CameraPreset;
  onHover: (point: Coordinate) => void;
  onSelect: (point: Coordinate) => void;
}) {
  const overlayElevation = exaggeration * .51 + .035;
  const routeTarget = useMemo(() => coordinateToTerrain(route[Math.floor(route.length / 2)] || route[0], 0), [route]);
  const orbitTarget = preset === "route" ? routeTarget : new Vector3(0, 0, 0);
  return <>
    <TerrainSurface exaggeration={exaggeration} contours={contours} colorized={colorized} onHover={onHover} onSelect={onSelect} />
    {grid && <GeographicGrid elevation={overlayElevation} />}
    {landmarks && <LandmarkLayer elevation={overlayElevation + .025} onSelect={onSelect} />}
    <TerrainRoute route={route} progress={progress} elevation={overlayElevation + .015} />
    <directionalLight position={[-5, 8, 5]} intensity={3.4} color="#f5d0b2" castShadow />
    <hemisphereLight intensity={.58} color="#afc0cb" groundColor="#321c17" />
    <ambientLight intensity={.18} color="#7d8589" />
    <CameraRig preset={preset} routeTarget={routeTarget} />
    <OrbitControls target={orbitTarget} enableDamping dampingFactor={.065} enablePan panSpeed={.65} minDistance={3.4} maxDistance={19} maxPolarAngle={Math.PI / 2.01} />
    <AdaptiveDpr pixelated />
  </>;
}

export default function TerrainLab3D({ route, progress }: { route: Coordinate[]; progress: number }) {
  const [exaggeration, setExaggeration] = useState(1.25);
  const [grid, setGrid] = useState(true);
  const [contours, setContours] = useState(false);
  const [colorized, setColorized] = useState(true);
  const [landmarks, setLandmarks] = useState(true);
  const [preset, setPreset] = useState<CameraPreset>("oblique");
  const distanceKm = routeDistance(route);
  const { cursor, selection, setCursor, setPoint } = useMissionStore();

  return <div className="terrain-lab-view terrain-global-view terrain-flat-view">
    <Canvas camera={{ position: [0, 6.6, 8.7], fov: 43, near: .08, far: 100 }} dpr={[1, 1.65]} shadows gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
      <color attach="background" args={["#0a0c0d"]} />
      <fog attach="fog" args={["#0a0c0d", 16, 38]} />
      <GlobalTerrainScene
        route={route}
        progress={progress}
        exaggeration={exaggeration}
        grid={grid}
        contours={contours}
        colorized={colorized}
        landmarks={landmarks}
        preset={preset}
        onHover={setCursor}
        onSelect={setPoint}
      />
    </Canvas>

    <div className="terrain-vignette" />
    <div className="global-terrain-title">
      <span>SUPERFICIE EQUIRECTANGULAR · 360° × 180°</span>
      <b>TERRENO GLOBAL 3D DE MARTE</b>
      <small>Arrastra para inclinar · rueda para acercar · botón derecho para desplazar</small>
    </div>

    <div className="terrain-camera-presets" role="group" aria-label="Vista del terreno">
      {(["oblique", "top", "low", "route"] as CameraPreset[]).map(value => <button key={value} className={preset === value ? "active" : ""} onClick={() => setPreset(value)} aria-pressed={preset === value}>{value === "oblique" ? "3D" : value === "top" ? "Cenital" : value === "low" ? "Rasante" : "Ruta"}</button>)}
    </div>

    <div className="global-terrain-controls terrain-surface-controls">
      <label>RELIEVE <b>{exaggeration.toFixed(2)}×</b><input type="range" min=".35" max="2.4" step=".05" value={exaggeration} onChange={event => setExaggeration(Number(event.target.value))} /></label>
      <button className={grid ? "active" : ""} onClick={() => setGrid(value => !value)} aria-pressed={grid}><i />Coordenadas</button>
      <button className={contours ? "active" : ""} onClick={() => setContours(value => !value)} aria-pressed={contours}><i />Malla</button>
    </div>

    <div className="terrain-layer-controls" role="group" aria-label="Capas científicas">
      <button className={colorized ? "active" : ""} onClick={() => setColorized(value => !value)} aria-pressed={colorized}><i />Color MOLA</button>
      <button className={landmarks ? "active" : ""} onClick={() => setLandmarks(value => !value)} aria-pressed={landmarks}><i />Lugares</button>
    </div>

    <div className="terrain-coordinate-hud">
      <span>COORDENADA DEL CURSOR</span>
      <b>{Math.abs(cursor.lat).toFixed(3)}°{cursor.lat >= 0 ? "N" : "S"} · {Math.abs(cursor.lon).toFixed(3)}°{cursor.lon >= 0 ? "E" : "O"}</b>
      <small>Clic para fijar {selection === "base" ? "la base" : "el destino"}</small>
    </div>

    <div className="global-terrain-stats">
      <div><span>COBERTURA</span><b>Marte completo</b></div>
      <div><span>DEM FUENTE</span><b>463 m/px</b></div>
      <div><span>ALTIMETRÍA</span><b>MGS · MOLA</b></div>
      <div><span>RUTA ACTIVA</span><b>{distanceKm.toFixed(0)} km</b></div>
    </div>

    <div className="mola-elevation-legend" aria-label="Escala de elevación MOLA"><span>−8 km</span><i /><span>+14 km</span><small>ELEVACIÓN MOLA</small></div>
    <a className="global-terrain-source" href="https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m" target="_blank" rel="noreferrer">USGS / NASA · DEM MOLA ↗</a>
  </div>;
}
