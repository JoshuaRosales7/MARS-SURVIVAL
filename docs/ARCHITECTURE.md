# Architecture and model contract

The Next.js static client owns exploration and an offline-capable deterministic mission model. Zustand keeps base, target, strategy, resources, layers and simulation state synchronized across every panel. React Three Fiber renders the globe; the 2D view projects the same state into an equirectangular map. Both use the two level-zero WMTS tiles documented by NASA Mars Trek.

`AdvancedMarsGlobe` isolates the orbital presentation layer from the mission model. Its atmosphere, moons, orbital guides, animated telemetry and beacons are explicitly visual context; they do not upgrade route quality or imply measured terrain. The renderer uses bounded device pixel ratio, high-performance WebGL preferences and independently switchable layers. Terrain remains a smooth reference sphere until a traceable numeric DEM is connected.

`TerrainLab3D` consumes the deterministic model in `lib/terrain.ts` to preview the complete terrain workflow without external data. The same route always produces the same conceptual height field, profile, slope and roughness classes. These values are UI-development proxies and are never passed into mission feasibility or exposed as MOLA measurements. The module boundary is intentional: a future DEM sampler can replace `sampleConceptualTerrain` while preserving the scene, profile and risk-overlay contracts.

The optional FastAPI service supplies validated planning contracts. Global routes use a spherical Mars reference radius of 3,389.5 km and haversine distance with wrapped longitude deltas. `api.main.astar` is deliberately limited to bounded local cost grids; a production hierarchy should first solve a coarse global graph and refine only selected corridors with MOLA and local DEMs.

## Quality states

1. `global-geometric`: distance and great-circle geometry only; no terrain safety claim.
2. `mola-evaluated`: reserved for routes sampled against a configured MOLA numeric DEM.
3. `high-resolution-dem`: reserved for explicitly identified CTX/HiRISE or equivalent DEM coverage.

Only state 1 is emitted today. Missing numeric topography is a typed error, never a zero elevation.

## Risk and survival semantics

Resource consumption is calculated from duration, crew, editable rates and contingency. A route passes only if oxygen, energy and water remain above the chosen reserve, radiation stays below the configured scenario limit, and time remains below the maximum. Radiation is a constant editable exposure-rate scenario, not a weather forecast. “Favorable within model” is not “safe”: terrain stays `insufficient-data` until a traceable DEM profile exists.
