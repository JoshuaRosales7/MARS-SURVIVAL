"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  PlaneGeometry,
  Points,
  Vector3,
} from "three";
import { buildConceptualTerrain, sampleConceptualTerrain, type TerrainPoint } from "@/lib/terrain";
import type { Coordinate } from "@/lib/mars";

type CameraPreset = "perspective" | "top" | "surface";

function terrainColor(point: ReturnType<typeof sampleConceptualTerrain>, riskOverlay: boolean) {
  if (riskOverlay) {
    if (point.risk === "high") return new Color("#e1604f");
    if (point.risk === "medium") return new Color("#d6a45f");
    return new Color("#526f64");
  }
  const height = MathUtils.clamp((point.elevationM + 460) / 920, 0, 1);
  const lowland = new Color("#35231f");
  const basalt = new Color("#694033");
  const regolith = new Color("#a96549");
  const ridge = new Color("#d0a276");
  const color = height < .38
    ? lowland.clone().lerp(basalt, height / .38)
    : basalt.clone().lerp(regolith, (height - .38) / .42);
  if (height > .8) color.lerp(ridge, (height - .8) / .2);
  color.multiplyScalar(1 - Math.min(.22, point.roughness * .16 + point.slopeDeg / 190));
  return color;
}

function TerrainMesh({ seed, lengthKm, widthKm, exaggeration, riskOverlay, contours }: {
  seed: number; lengthKm: number; widthKm: number; exaggeration: number; riskOverlay: boolean; contours: boolean;
}) {
  const geometry = useMemo(() => {
    const result = new PlaneGeometry(10, 6, 144, 86);
    result.rotateX(-Math.PI / 2);
    const positions = result.attributes.position;
    const colors: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const sample = sampleConceptualTerrain(x, z, seed, lengthKm, widthKm);
      positions.setY(i, sample.elevationM / 820 * exaggeration);
      const color = terrainColor(sample, riskOverlay);
      colors.push(color.r, color.g, color.b);
    }
    result.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    result.computeVertexNormals();
    result.computeBoundingSphere();
    return result;
  }, [seed, lengthKm, widthKm, exaggeration, riskOverlay]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const baseY = -.88 * exaggeration;

  return <group>
    <mesh position={[0, baseY - .16, 0]} receiveShadow>
      <boxGeometry args={[10.12, .32, 6.12]} />
      <meshStandardMaterial color="#211916" roughness={1} metalness={0} />
    </mesh>
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={.88} metalness={.015} side={DoubleSide} />
    </mesh>
    {contours && <mesh geometry={geometry} position={[0, .008, 0]}>
      <shaderMaterial
        transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2}
        uniforms={{ lineColor: { value: new Color("#efd4b5") }, spacing: { value: 17 / exaggeration } }}
        vertexShader={`
          varying float vHeight;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vHeight = world.y;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={`
          uniform vec3 lineColor;
          uniform float spacing;
          varying float vHeight;
          void main() {
            float cycle = fract(vHeight * spacing);
            float band = min(cycle, 1.0 - cycle);
            float alpha = 1.0 - smoothstep(0.0, 0.055, band);
            gl_FragColor = vec4(lineColor, alpha * 0.24);
          }
        `}
      />
    </mesh>}
  </group>;
}

function TerrainBeacon({ point, color, exaggeration }: { point: TerrainPoint; color: string; exaggeration: number }) {
  const y = point.elevationM / 820 * exaggeration;
  return <group position={[point.worldX, y, point.worldZ]}>
    <mesh position={[0, .24, 0]} castShadow>
      <cylinderGeometry args={[.012, .028, .48, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.55} />
    </mesh>
    <mesh position={[0, .5, 0]}>
      <octahedronGeometry args={[.082, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .018, 0]}>
      <ringGeometry args={[.12, .17, 32]} />
      <meshBasicMaterial color={color} transparent opacity={.78} side={DoubleSide} />
    </mesh>
  </group>;
}

function TerrainVehicle({ profile, progress, exaggeration }: { profile: TerrainPoint[]; progress: number; exaggeration: number }) {
  const rover = useRef<Group>(null);
  const wheelRefs = useRef<Group[]>([]);
  const index = Math.min(profile.length - 1, Math.floor(progress * (profile.length - 1)));
  const point = profile[index];
  const next = profile[Math.min(profile.length - 1, index + 1)];
  const yaw = Math.atan2(next.worldX - point.worldX, next.worldZ - point.worldZ);

  useFrame(({ clock }, delta) => {
    if (rover.current) rover.current.position.y = Math.sin(clock.elapsedTime * 2.1) * .006;
    wheelRefs.current.forEach(wheel => { wheel.rotation.x += delta * 1.8; });
  });

  return <group position={[point.worldX, point.elevationM / 820 * exaggeration + .13, point.worldZ]} rotation={[0, yaw, 0]}>
    <group ref={rover} scale={.78}>
      <mesh castShadow position={[0, .08, 0]}>
        <boxGeometry args={[.34, .13, .45]} />
        <meshStandardMaterial color="#d8d3c8" roughness={.62} metalness={.35} />
      </mesh>
      <mesh castShadow position={[0, .19, -.04]}>
        <boxGeometry args={[.25, .09, .25]} />
        <meshStandardMaterial color="#756e63" roughness={.55} metalness={.45} />
      </mesh>
      <mesh position={[0, .26, -.04]}>
        <boxGeometry args={[.29, .018, .28]} />
        <meshStandardMaterial color="#273d4c" emissive="#163041" emissiveIntensity={.2} metalness={.5} roughness={.3} />
      </mesh>
      {([[-.2, 0, -.16], [.2, 0, -.16], [-.2, 0, .16], [.2, 0, .16]] as [number, number, number][]).map((position, wheelIndex) =>
        <group key={wheelIndex} position={position} ref={node => { if (node) wheelRefs.current[wheelIndex] = node; }}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[.085, .085, .055, 14]} />
            <meshStandardMaterial color="#252526" roughness={.95} />
          </mesh>
        </group>
      )}
      <mesh position={[0, .36, -.09]}>
        <cylinderGeometry args={[.008, .008, .2, 8]} />
        <meshStandardMaterial color="#a8a29a" metalness={.8} roughness={.25} />
      </mesh>
      <mesh position={[0, .47, -.09]} rotation={[0, 0, -.45]}>
        <boxGeometry args={[.16, .018, .11]} />
        <meshStandardMaterial color="#c9c3b7" metalness={.6} roughness={.35} />
      </mesh>
      <pointLight position={[0, .15, .32]} color="#e9d7b7" intensity={1.6} distance={1.8} />
    </group>
  </group>;
}

function RiskMarkers({ profile, exaggeration, visible }: { profile: TerrainPoint[]; exaggeration: number; visible: boolean }) {
  if (!visible) return null;
  return <group>
    {profile.filter((point, index) => point.risk === "high" && index % 5 === 0).slice(0, 12).map(point =>
      <group key={point.fraction} position={[point.worldX, point.elevationM / 820 * exaggeration + .035, point.worldZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[.09, .145, 24]} />
          <meshBasicMaterial color="#ff6c58" transparent opacity={.78} side={DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, .1, 0]}><coneGeometry args={[.035, .13, 8]} /><meshBasicMaterial color="#ff7764" /></mesh>
      </group>
    )}
  </group>;
}

function DustField({ seed }: { seed: number }) {
  const ref = useRef<Points>(null);
  const positions = useMemo(() => {
    let state = seed || 1;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
    const data = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i++) {
      data[i * 3] = (random() - .5) * 14;
      data[i * 3 + 1] = random() * 4.5 - .5;
      data[i * 3 + 2] = (random() - .5) * 10;
    }
    return data;
  }, [seed]);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * .004; });
  return <points ref={ref}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color="#c89a75" size={.018} transparent opacity={.34} depthWrite={false} blending={AdditiveBlending} />
  </points>;
}

function CameraRig({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();
  const previousPreset = useRef(preset);
  const moving = useRef(false);
  const destinations = useMemo<Record<CameraPreset, Vector3>>(() => ({
    perspective: new Vector3(6.7, 5.4, 7.8),
    top: new Vector3(0, 11.8, .02),
    surface: new Vector3(-5.6, 1.45, 3.5),
  }), []);
  useFrame((_, delta) => {
    if (previousPreset.current !== preset) { previousPreset.current = preset; moving.current = true; }
    if (moving.current) {
      camera.position.lerp(destinations[preset], 1 - Math.exp(-delta * 4.8));
      camera.lookAt(0, preset === "surface" ? -.05 : 0, 0);
      if (camera.position.distanceTo(destinations[preset]) < .025) moving.current = false;
    }
  });
  return null;
}

function CorridorScene({ route, progress, exaggeration, riskOverlay, contours, cameraPreset }: {
  route: Coordinate[]; progress: number; exaggeration: number; riskOverlay: boolean; contours: boolean; cameraPreset: CameraPreset;
}) {
  const model = useMemo(() => buildConceptualTerrain(route), [route]);
  const routePoints = useMemo(() => model.profile.map(point => new Vector3(point.worldX, point.elevationM / 820 * exaggeration + .052, point.worldZ)), [model, exaggeration]);
  const corridorLeft = useMemo(() => routePoints.map(point => point.clone().add(new Vector3(0, -.012, -.18))), [routePoints]);
  const corridorRight = useMemo(() => routePoints.map(point => point.clone().add(new Vector3(0, -.012, .18))), [routePoints]);

  return <>
    <color attach="background" args={["#0d0e0f"]} />
    <fog attach="fog" args={["#171312", 8.5, 24]} />
    <mesh scale={35}><sphereGeometry args={[1, 32, 16]} /><meshBasicMaterial color="#17110f" side={BackSide} /></mesh>
    <DustField seed={model.seed} />
    <TerrainMesh seed={model.seed} lengthKm={model.lengthKm} widthKm={model.widthKm} exaggeration={exaggeration} riskOverlay={riskOverlay} contours={contours} />
    <Line points={corridorLeft} color="#bda98f" lineWidth={1} transparent opacity={.32} dashed dashScale={16} dashSize={.45} gapSize={.38} />
    <Line points={corridorRight} color="#bda98f" lineWidth={1} transparent opacity={.32} dashed dashScale={16} dashSize={.45} gapSize={.38} />
    <Line points={routePoints} color="#101517" lineWidth={9} transparent opacity={.35} />
    <Line points={routePoints} color="#dce7e1" lineWidth={3.2} />
    <Line points={routePoints} color="#91b9b0" lineWidth={1.1} transparent opacity={.9} dashed dashScale={28} dashSize={.42} gapSize={.5} />
    <RiskMarkers profile={model.profile} exaggeration={exaggeration} visible={riskOverlay} />
    <TerrainBeacon point={model.profile[0]} color="#75b89b" exaggeration={exaggeration} />
    <TerrainBeacon point={model.profile.at(-1)!} color="#f18461" exaggeration={exaggeration} />
    <TerrainVehicle profile={model.profile} progress={progress} exaggeration={exaggeration} />
    <directionalLight position={[-5, 8, 3]} intensity={3.8} color="#f3caa6" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={6} shadow-camera-bottom={-6} />
    <hemisphereLight intensity={.62} color="#b6c4ce" groundColor="#3d2118" />
    <ambientLight intensity={.18} color="#758087" />
    <CameraRig preset={cameraPreset} />
    <OrbitControls target={[0, 0, 0]} enableDamping dampingFactor={.065} minDistance={3.5} maxDistance={18} minPolarAngle={.08} maxPolarAngle={Math.PI / 2.03} enablePan panSpeed={.55} />
    <AdaptiveDpr pixelated />
  </>;
}

export default function TerrainLab3D({ route, progress }: { route: Coordinate[]; progress: number }) {
  const [exaggeration, setExaggeration] = useState(1.8);
  const [riskOverlay, setRiskOverlay] = useState(false);
  const [contours, setContours] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("perspective");
  const model = useMemo(() => buildConceptualTerrain(route), [route]);
  const currentPoint = model.profile[Math.min(model.profile.length - 1, Math.floor(progress * (model.profile.length - 1)))];

  return <div className="terrain-lab-view">
    <Canvas camera={{ position: [6.7, 5.4, 7.8], fov: 40, near: .08, far: 90 }} dpr={[1, 1.75]} shadows gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}>
      <CorridorScene route={route} progress={progress} exaggeration={exaggeration} riskOverlay={riskOverlay} contours={contours} cameraPreset={cameraPreset} />
    </Canvas>
    <div className="terrain-vignette" />
    <div className="terrain-compass" aria-hidden="true"><i /><b>N</b><span>ORIENTACIÓN LIBRE</span></div>
    <div className="terrain-scale" aria-hidden="true"><i /><span>{Math.max(1, model.lengthKm / 5).toFixed(0)} km</span></div>
    <div className="terrain-view-presets" role="group" aria-label="Ángulo de cámara">
      <span>CÁMARA</span>
      {(["perspective", "top", "surface"] as CameraPreset[]).map(preset => <button key={preset} className={cameraPreset === preset ? "active" : ""} onClick={() => setCameraPreset(preset)} aria-pressed={cameraPreset === preset}>{preset === "perspective" ? "3D" : preset === "top" ? "Cenital" : "Rasante"}</button>)}
    </div>
    <div className="terrain-lab-controls">
      <span>CAPAS DEL TERRENO</span>
      <label>RELIEVE <b>{exaggeration.toFixed(1)}×</b><input type="range" min="0.7" max="3.2" step="0.1" value={exaggeration} onChange={event => setExaggeration(Number(event.target.value))} /></label>
      <button className={riskOverlay ? "active risk" : ""} onClick={() => setRiskOverlay(value => !value)} aria-pressed={riskOverlay}>RIESGO</button>
      <button className={contours ? "active" : ""} onClick={() => setContours(value => !value)} aria-pressed={contours}>CURVAS</button>
    </div>
    <div className="terrain-stats">
      <div><span>PROGRESO</span><b>{(progress * 100).toFixed(0)}%</b></div>
      <div><span>ALTURA ACTUAL</span><b>{currentPoint.elevationM.toFixed(0)} m</b></div>
      <div><span>PENDIENTE MÁX.</span><b>{model.stats.maxSlopeDeg.toFixed(1)}°</b></div>
      <div><span>TRAMO CRÍTICO</span><b>{model.stats.highRiskPercent.toFixed(0)}%</b></div>
    </div>
    <div className="terrain-disclaimer"><strong>MODELO CONCEPTUAL</strong> Relieve reproducible para explorar la ruta. Conecta MOLA/HRSC para elevación física y navegación.</div>
  </div>;
}
