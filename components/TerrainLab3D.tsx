"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, Line, OrbitControls, Stars, useTexture } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BackSide,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";
import { coordinateToVector, routeDistance, type Coordinate } from "@/lib/mars";

const MOLA_TEXTURE = "/data/mars-mola-topography.jpg";
const MARS_RADIUS = 2.35;

function Atmosphere() {
  return <mesh scale={1.055}>
    <sphereGeometry args={[MARS_RADIUS, 128, 80]} />
    <shaderMaterial
      transparent
      depthWrite={false}
      side={BackSide}
      blending={AdditiveBlending}
      uniforms={{ glow: { value: new Color("#d87959") } }}
      vertexShader={`
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `}
      fragmentShader={`
        uniform vec3 glow;
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float rim = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.1);
          gl_FragColor = vec4(glow, rim * 0.46);
        }
      `}
    />
  </mesh>;
}

function GeographicGrid() {
  const lines = useMemo(() => {
    const result: Vector3[][] = [];
    for (let lat = -75; lat <= 75; lat += 15) {
      result.push(Array.from({ length: 145 }, (_, index) => new Vector3(...coordinateToVector({ lat, lon: -180 + index * 2.5 }, MARS_RADIUS + .012))));
    }
    for (let lon = -180; lon < 180; lon += 15) {
      result.push(Array.from({ length: 97 }, (_, index) => new Vector3(...coordinateToVector({ lat: -90 + index * 1.875, lon }, MARS_RADIUS + .012))));
    }
    return result;
  }, []);
  return <group>{lines.map((points, index) => <Line key={index} points={points} color="#d6d0c7" lineWidth={.45} transparent opacity={index % 6 === 0 ? .2 : .08} depthWrite={false} />)}</group>;
}

function SurfaceMarker({ point, color }: { point: Coordinate; color: string }) {
  const position = useMemo(() => new Vector3(...coordinateToVector(point, MARS_RADIUS + .025)), [point]);
  const orientation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), position.clone().normalize()), [position]);
  return <group position={position} quaternion={orientation}>
    <mesh position={[0, .12, 0]}><cylinderGeometry args={[.008, .02, .24, 10]} /><meshBasicMaterial color={color} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.07, .009, 10, 36]} /><meshBasicMaterial color={color} transparent opacity={.9} /></mesh>
    <mesh position={[0, .25, 0]}><octahedronGeometry args={[.045, 0]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
}

function MissionRoute({ route, progress }: { route: Coordinate[]; progress: number }) {
  const points = useMemo(() => route.map(point => new Vector3(...coordinateToVector(point, MARS_RADIUS + .045))), [route]);
  const curve = useMemo(() => new CatmullRomCurve3(points, false, "centripetal", .4), [points]);
  const vehicle = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!vehicle.current) return;
    vehicle.current.position.copy(curve.getPointAt(Math.max(0, Math.min(1, progress))));
    const pulse = 1 + Math.sin(clock.elapsedTime * 4.5) * .16;
    vehicle.current.scale.setScalar(pulse);
  });
  return <group>
    <Line points={points} color="#101414" lineWidth={8} transparent opacity={.35} depthWrite={false} />
    <Line points={points} color="#edf4ec" lineWidth={3} transparent opacity={.96} />
    <Line points={points} color="#7ad6bd" lineWidth={1.15} dashed dashScale={26} dashSize={.45} gapSize={.48} />
    <SurfaceMarker point={route[0]} color="#7bd1a8" />
    <SurfaceMarker point={route.at(-1)!} color="#ff8667" />
    <mesh ref={vehicle}>
      <icosahedronGeometry args={[.052, 1]} />
      <meshBasicMaterial color="#ffffff" />
      <pointLight intensity={1.8} distance={.7} color="#9ce5d3" />
    </mesh>
  </group>;
}

function MolaPlanet({ route, progress, relief, grid, autoRotate }: {
  route: Coordinate[];
  progress: number;
  relief: boolean;
  grid: boolean;
  autoRotate: boolean;
}) {
  const texture = useTexture(MOLA_TEXTURE);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 12;

  return <>
    <group rotation={[0, -Math.PI / 2, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[MARS_RADIUS, 256, 160]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={relief ? texture : null}
          bumpScale={relief ? .075 : 0}
          roughness={.92}
          metalness={.015}
        />
      </mesh>
      {grid && <GeographicGrid />}
      <MissionRoute route={route} progress={progress} />
      <Atmosphere />
    </group>
    <directionalLight position={[5, 3.2, 4.5]} intensity={3.25} color="#f5d1b4" castShadow />
    <pointLight position={[-4, -1, -3]} intensity={.3} color="#758b9b" />
    <ambientLight intensity={.24} color="#8c969b" />
    <OrbitControls autoRotate={autoRotate} autoRotateSpeed={.34} enableDamping dampingFactor={.06} enablePan={false} minDistance={3.05} maxDistance={9.5} />
  </>;
}

export default function TerrainLab3D({ route, progress }: { route: Coordinate[]; progress: number }) {
  const [relief, setRelief] = useState(true);
  const [grid, setGrid] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const distanceKm = routeDistance(route);

  return <div className="terrain-lab-view terrain-global-view">
    <Canvas camera={{ position: [0, .12, 6.15], fov: 43, near: .08, far: 100 }} dpr={[1, 1.7]} shadows gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
      <color attach="background" args={["#090b0d"]} />
      <fog attach="fog" args={["#090b0d", 18, 70]} />
      <Stars radius={70} depth={40} count={1300} factor={1.6} saturation={.08} fade speed={.12} />
      <MolaPlanet route={route} progress={progress} relief={relief} grid={grid} autoRotate={autoRotate} />
      <AdaptiveDpr pixelated />
    </Canvas>

    <div className="terrain-vignette" />
    <div className="global-terrain-title">
      <span>TOPOGRAFÍA PLANETARIA</span>
      <b>MARTE COMPLETO · MOLA</b>
      <small>Arrastra para rotar · rueda para acercar</small>
    </div>

    <div className="global-terrain-controls" role="group" aria-label="Capas del terreno global">
      <button className={relief ? "active" : ""} onClick={() => setRelief(value => !value)} aria-pressed={relief}><i />Relieve 3D</button>
      <button className={grid ? "active" : ""} onClick={() => setGrid(value => !value)} aria-pressed={grid}><i />Coordenadas</button>
      <button className={autoRotate ? "active" : ""} onClick={() => setAutoRotate(value => !value)} aria-pressed={autoRotate}><i />Rotación</button>
    </div>

    <div className="global-terrain-stats">
      <div><span>COBERTURA</span><b>100% global</b></div>
      <div><span>RESOLUCIÓN BASE</span><b>463 m/px</b></div>
      <div><span>INSTRUMENTO</span><b>MGS · MOLA</b></div>
      <div><span>RUTA ACTIVA</span><b>{distanceKm.toFixed(0)} km</b></div>
    </div>

    <div className="mola-elevation-legend" aria-label="Escala de elevación MOLA">
      <span>−8 km</span><i /><span>+14 km</span>
      <small>ELEVACIÓN MOLA</small>
    </div>

    <a className="global-terrain-source" href="https://svs.gsfc.nasa.gov/4436/" target="_blank" rel="noreferrer">NASA/GSFC · MOLA GLOBAL ↗</a>
  </div>;
}
