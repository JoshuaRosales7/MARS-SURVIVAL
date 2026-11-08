"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferAttribute, Color, DoubleSide, Group, Mesh, PlaneGeometry, Vector3 } from "three";
import { buildConceptualTerrain, sampleConceptualTerrain, type TerrainPoint } from "@/lib/terrain";
import type { Coordinate } from "@/lib/mars";

function terrainColor(point: ReturnType<typeof sampleConceptualTerrain>, riskOverlay: boolean) {
  if (riskOverlay) {
    if (point.risk === "high") return new Color("#bf665d");
    if (point.risk === "medium") return new Color("#b99663");
    return new Color("#71877c");
  }
  const normalized = Math.max(0, Math.min(1, (point.elevationM + 430) / 850));
  return new Color("#422b25").lerp(new Color("#a7664e"), normalized).lerp(new Color("#c5a98f"), Math.max(0, normalized - .72) * 1.7);
}

function TerrainMesh({ seed, lengthKm, widthKm, exaggeration, riskOverlay, contours }: { seed: number; lengthKm: number; widthKm: number; exaggeration: number; riskOverlay: boolean; contours: boolean }) {
  const geometry = useMemo(() => {
    const result = new PlaneGeometry(10, 6, 96, 58);
    result.rotateX(-Math.PI / 2);
    const positions = result.attributes.position;
    const colors: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      const sample = sampleConceptualTerrain(x, z, seed, lengthKm, widthKm);
      positions.setY(i, sample.elevationM / 820 * exaggeration);
      const color = terrainColor(sample, riskOverlay);
      colors.push(color.r, color.g, color.b);
    }
    result.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    result.computeVertexNormals();
    return result;
  }, [seed, lengthKm, widthKm, exaggeration, riskOverlay]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group>
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={.94} metalness={.02} side={DoubleSide} />
    </mesh>
    {contours && <mesh geometry={geometry} position={[0, .012, 0]}>
      <meshBasicMaterial color="#d6c1ad" wireframe transparent opacity={.075} depthWrite={false} />
    </mesh>}
  </group>;
}

function TerrainBeacon({ point, color, exaggeration }: { point: TerrainPoint; color: string; exaggeration: number }) {
  const y = point.elevationM / 820 * exaggeration;
  return <group position={[point.worldX, y, point.worldZ]}>
    <mesh position={[0, .22, 0]}><cylinderGeometry args={[.012, .035, .44, 10]} /><meshBasicMaterial color={color} transparent opacity={.8} /></mesh>
    <mesh position={[0, .48, 0]}><octahedronGeometry args={[.075, 0]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
}

function TerrainVehicle({ profile, progress, exaggeration }: { profile: TerrainPoint[]; progress: number; exaggeration: number }) {
  const ref = useRef<Group>(null);
  const point = profile[Math.min(profile.length - 1, Math.floor(progress * (profile.length - 1)))];
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.elapsedTime * 1.8; });
  return <group position={[point.worldX, point.elevationM / 820 * exaggeration + .1, point.worldZ]}>
    <group ref={ref}><mesh><icosahedronGeometry args={[.09, 1]} /><meshBasicMaterial color="#eee9e2" /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.17, .012, 8, 36]} /><meshBasicMaterial color="#9aabad" /></mesh></group>
    <pointLight color="#9aabad" intensity={1.25} distance={1.2} />
  </group>;
}

function CorridorScene({ route, progress, exaggeration, riskOverlay, contours }: { route: Coordinate[]; progress: number; exaggeration: number; riskOverlay: boolean; contours: boolean }) {
  const model = useMemo(() => buildConceptualTerrain(route), [route]);
  const routePoints = useMemo(() => model.profile.map(point => new Vector3(point.worldX, point.elevationM / 820 * exaggeration + .045, point.worldZ)), [model, exaggeration]);
  return <>
    <color attach="background" args={["#101214"]} />
    <fog attach="fog" args={["#101214", 9, 22]} />
    <TerrainMesh seed={model.seed} lengthKm={model.lengthKm} widthKm={model.widthKm} exaggeration={exaggeration} riskOverlay={riskOverlay} contours={contours} />
    <Line points={routePoints} color="#91a7aa" lineWidth={6} transparent opacity={.1} />
    <Line points={routePoints} color="#d7dedc" lineWidth={2} />
    <TerrainBeacon point={model.profile[0]} color="#809d8e" exaggeration={exaggeration} />
    <TerrainBeacon point={model.profile.at(-1)!} color="#ce7657" exaggeration={exaggeration} />
    <TerrainVehicle profile={model.profile} progress={progress} exaggeration={exaggeration} />
    <directionalLight position={[5, 8, 4]} intensity={3.1} color="#ead4c1" castShadow />
    <ambientLight intensity={.35} color="#6f7880" />
    <gridHelper args={[10, 20, "#3d4649", "#252b2e"]} position={[0, -.72 * exaggeration, 0]} />
    <OrbitControls target={[0, 0, 0]} enableDamping dampingFactor={.06} minDistance={5.5} maxDistance={16} minPolarAngle={.35} maxPolarAngle={Math.PI / 2.05} />
  </>;
}

export default function TerrainLab3D({ route, progress }: { route: Coordinate[]; progress: number }) {
  const [exaggeration, setExaggeration] = useState(1.6);
  const [riskOverlay, setRiskOverlay] = useState(false);
  const [contours, setContours] = useState(true);
  const model = useMemo(() => buildConceptualTerrain(route), [route]);
  return <div className="terrain-lab-view">
    <Canvas camera={{ position: [6.7, 5.4, 7.8], fov: 42, near: .1, far: 80 }} dpr={[1, 1.55]} shadows gl={{ antialias: true, powerPreference: "high-performance" }}>
      <CorridorScene route={route} progress={progress} exaggeration={exaggeration} riskOverlay={riskOverlay} contours={contours} />
    </Canvas>
    <div className="terrain-lab-controls">
      <span>TERRAIN LAB / PROXY CONCEPTUAL</span>
      <label>EXAGERACIÓN <b>{exaggeration.toFixed(1)}×</b><input type="range" min="0.5" max="3.5" step="0.1" value={exaggeration} onChange={event => setExaggeration(Number(event.target.value))}/></label>
      <button className={riskOverlay ? "active" : ""} onClick={()=>setRiskOverlay(value=>!value)}>RIESGO</button>
      <button className={contours ? "active" : ""} onClick={()=>setContours(value=>!value)}>MALLA</button>
    </div>
    <div className="terrain-stats">
      <div><span>CORREDOR</span><b>{model.lengthKm.toFixed(1)} km</b></div>
      <div><span>RELIEVE PROXY</span><b>{(model.stats.maxElevationM-model.stats.minElevationM).toFixed(0)} m</b></div>
      <div><span>PENDIENTE MÁX.</span><b>{model.stats.maxSlopeDeg.toFixed(1)}°</b></div>
      <div><span>TRAMO CRÍTICO</span><b>{model.stats.highRiskPercent.toFixed(0)}%</b></div>
    </div>
    <div className="terrain-disclaimer"><strong>MODELO CONCEPTUAL</strong> La geometría es reproducible pero no procede de un DEM. No usar para navegación; conecta MOLA/HRSC para métricas físicas.</div>
  </div>;
}
