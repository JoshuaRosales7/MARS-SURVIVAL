"use client";

import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars, useTexture } from "@react-three/drei";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending, BackSide, CatmullRomCurve3, Color, DoubleSide, Group,
  Mesh, Quaternion, SRGBColorSpace, Vector3,
} from "three";
import { LANDMARKS } from "@/data/mars";
import { coordinateToVector, normalizeLon, type Coordinate } from "@/lib/mars";
import { useMissionStore } from "@/lib/store";

const TILE_BASE = process.env.NEXT_PUBLIC_MARS_TILE_BASE || "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm";
const TILE_WEST = `${TILE_BASE}/0/0/0.jpg`;
const TILE_EAST = `${TILE_BASE}/0/0/1.jpg`;

const ATMOSPHERE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = pow(max(0.0, 0.72 - dot(vNormal, viewDirection)), 2.7);
    float horizon = smoothstep(0.0, 0.85, rim);
    gl_FragColor = vec4(glowColor, horizon * 0.72);
  }
`;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function Atmosphere() {
  return <mesh scale={1.11} renderOrder={-1}>
    <sphereGeometry args={[2, 96, 64]} />
    <shaderMaterial
      vertexShader={ATMOSPHERE_VERTEX}
      fragmentShader={ATMOSPHERE_FRAGMENT}
      uniforms={{ glowColor: { value: new Color("#c86f56") } }}
      side={BackSide}
      blending={AdditiveBlending}
      transparent
      depthWrite={false}
    />
  </mesh>;
}

function SurfaceBeacon({ point, color, label }: { point: Coordinate; color: string; label: string }) {
  const surface = useMemo(() => new Vector3(...coordinateToVector(point, 2.055)), [point]);
  const orientation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), surface.clone().normalize()), [surface]);
  return <group position={surface} quaternion={orientation}>
    <mesh position={[0, .12, 0]}>
      <cylinderGeometry args={[.007, .018, .24, 10]} />
      <meshBasicMaterial color={color} transparent opacity={.7} blending={AdditiveBlending} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.068, .009, 10, 36]} />
      <meshBasicMaterial color={color} transparent opacity={.9} />
    </mesh>
    <mesh position={[0, .24, 0]}>
      <octahedronGeometry args={[.038, 0]} />
      <meshBasicMaterial color={color} />
    </mesh>
    <Html position={[0, .31, 0]} center sprite distanceFactor={7.5} style={{ pointerEvents: "none" }}>
      <div className="orbital-label" style={{ "--beacon-color": color } as React.CSSProperties}><span>{label}</span><b>{point.name || "PUNTO PERSONALIZADO"}</b></div>
    </Html>
  </group>;
}

function LandmarkSignals() {
  return <>{LANDMARKS.map((point, index) => {
    const start = new Vector3(...coordinateToVector(point, 2.035));
    const end = new Vector3(...coordinateToVector(point, 2.13 + index % 3 * .015));
    return <group key={point.id}>
      <Line points={[start, end]} color="#c4a174" lineWidth={.7} transparent opacity={.3} />
      <mesh position={end}><sphereGeometry args={[.012, 8, 8]} /><meshBasicMaterial color="#c4a174" /></mesh>
    </group>;
  })}</>;
}

function RoutePulse({ curve, offset, color }: { curve: CatmullRomCurve3; offset: number; color: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const fraction = (clock.elapsedTime * .075 + offset) % 1;
    ref.current.position.copy(curve.getPointAt(fraction));
    const scale = .75 + Math.sin(clock.elapsedTime * 5 + offset * 8) * .2;
    ref.current.scale.setScalar(scale);
  });
  return <mesh ref={ref}>
    <sphereGeometry args={[.027, 12, 12]} />
    <meshBasicMaterial color={color} blending={AdditiveBlending} />
  </mesh>;
}

function AdvancedRoute({ route, feasible }: { route: Coordinate[]; feasible: boolean }) {
  const color = feasible ? "#96aaac" : "#cb6c60";
  const points = useMemo(() => route.map(point => new Vector3(...coordinateToVector(point, 2.07))), [route]);
  const curve = useMemo(() => new CatmullRomCurve3(points, false, "centripetal", .35), [points]);
  return <group>
    <Line points={points} color={color} lineWidth={8} transparent opacity={.08} depthWrite={false} />
    <Line points={points} color={color} lineWidth={2.2} transparent opacity={.95} />
    {[0, .25, .5, .75].map(offset => <RoutePulse key={offset} curve={curve} offset={offset} color={color} />)}
  </group>;
}

function TelemetryVehicle({ point, feasible }: { point: Coordinate; feasible: boolean }) {
  const ref = useRef<Group>(null);
  const position = useMemo(() => new Vector3(...coordinateToVector(point, 2.115)), [point]);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 1.5;
  });
  return <group position={position}>
    <group ref={ref}>
      <mesh><icosahedronGeometry args={[.04, 1]} /><meshBasicMaterial color="#eeeae4" /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.075, .006, 8, 40]} /><meshBasicMaterial color={feasible ? "#809d8e" : "#cf655c"} transparent opacity={.8} /></mesh>
    </group>
    <pointLight intensity={1.1} distance={.7} color={feasible ? "#809d8e" : "#cf655c"} />
  </group>;
}

function OrbitalContext() {
  const moons = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (moons.current) moons.current.rotation.y = clock.elapsedTime * .055;
  });
  const equator = useMemo(() => Array.from({ length: 129 }, (_, i) => {
    const angle = i / 128 * Math.PI * 2;
    return new Vector3(Math.cos(angle) * 2.72, 0, Math.sin(angle) * 2.72);
  }), []);
  const polar = useMemo(() => equator.map(point => new Vector3(point.x, point.z, point.y)), [equator]);
  return <group>
    <Line points={equator} color="#91a7aa" lineWidth={.65} transparent opacity={.11} />
    <Line points={polar} color="#9c92a6" lineWidth={.5} transparent opacity={.08} />
    <group ref={moons} rotation={[.2, 0, .08]}>
      <mesh position={[2.72, 0, 0]}><dodecahedronGeometry args={[.048, 0]} /><meshStandardMaterial color="#b9a99d" roughness={1} /></mesh>
      <mesh position={[-3.15, .18, 0]}><dodecahedronGeometry args={[.032, 0]} /><meshStandardMaterial color="#887d76" roughness={1} /></mesh>
    </group>
  </group>;
}

function MarsSystem({ route, simPoint, feasible }: { route: Coordinate[]; simPoint: Coordinate; feasible: boolean }) {
  const [west, east] = useTexture([TILE_WEST, TILE_EAST]);
  west.colorSpace = SRGBColorSpace;
  east.colorSpace = SRGBColorSpace;
  west.anisotropy = east.anisotropy = 8;
  const { setPoint, setCursor, layers, base, destination } = useMissionStore();
  const handlePoint = (event: ThreeEvent<PointerEvent | MouseEvent>, commit: boolean) => {
    event.stopPropagation();
    const p = event.point.clone().normalize();
    const lat = 90 - Math.acos(clamp(p.y, -1, 1)) * 180 / Math.PI;
    const lon = normalizeLon(Math.atan2(p.z, -p.x) * 180 / Math.PI - 180);
    (commit ? setPoint : setCursor)({ lat, lon });
  };

  return <group rotation={[0, -Math.PI / 2, 0]}>
    <mesh onPointerMove={event => handlePoint(event, false)} onClick={event => handlePoint(event, true)}>
      <sphereGeometry args={[2, 160, 96, 0, Math.PI]} />
      <meshStandardMaterial map={layers.imagery ? west : null} color={layers.imagery ? "#ffffff" : "#a54c2f"} roughness={.88} metalness={.03} />
    </mesh>
    <mesh scale={1.001} onPointerMove={event => handlePoint(event, false)} onClick={event => handlePoint(event, true)}>
      <sphereGeometry args={[2, 160, 96, Math.PI, Math.PI]} />
      <meshStandardMaterial map={layers.imagery ? east : null} color={layers.imagery ? "#ffffff" : "#a54c2f"} roughness={.88} metalness={.03} side={DoubleSide} />
    </mesh>
    {layers.atmosphere && <Atmosphere />}
    {layers.grid && <mesh scale={1.004}><sphereGeometry args={[2, 36, 18]} /><meshBasicMaterial color="#91a7aa" wireframe transparent opacity={.1} /></mesh>}
    {layers.routes && <AdvancedRoute route={route} feasible={feasible} />}
    {layers.landmarks && <LandmarkSignals />}
    {layers.telemetry && <><SurfaceBeacon point={base} color="#809d8e" label="BASE" /><SurfaceBeacon point={destination} color="#ce7657" label="OBJETIVO" /><TelemetryVehicle point={simPoint} feasible={feasible} /></>}
    {layers.orbits && <OrbitalContext />}
  </group>;
}

export default function AdvancedMarsGlobe({ route, simPoint, feasible, cinematic }: { route: Coordinate[]; simPoint: Coordinate; feasible: boolean; cinematic: boolean }) {
  return <div className="globe-view advanced-globe">
    <Canvas
      camera={{ position: [0, .25, 5.65], fov: 40, near: .1, far: 180 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#0b0d0f"]} />
      <fog attach="fog" args={["#0b0d0f", 20, 72]} />
      <Stars radius={76} depth={44} count={1600} factor={1.8} saturation={.12} fade speed={.18} />
      <MarsSystem route={route} simPoint={simPoint} feasible={feasible} />
      <directionalLight position={[5, 2.5, 4]} intensity={2.9} color="#e6cbb7" />
      <pointLight position={[-4, -1.5, -2]} intensity={.24} color="#68767d" />
      <ambientLight intensity={.22} color="#747e83" />
      <OrbitControls autoRotate={cinematic} autoRotateSpeed={.42} enablePan={false} minDistance={2.5} maxDistance={8.5} dampingFactor={.055} enableDamping />
    </Canvas>
    <div className="scanlines" />
  </div>;
}
