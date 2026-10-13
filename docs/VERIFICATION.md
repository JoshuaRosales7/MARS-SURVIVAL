# Verification record

This file records commands actually executed for the current checkout. Do not infer unlisted test results.

## Automated cases

- Great-circle identity, antimeridian and pole behavior.
- Longitude normalization and stable interpolation.
- Round-trip accounting, minimum oxygen and maximum-time failure.
- API health, honest missing-DEM behavior, impossible missions.
- Local A* avoids blocked grid cells.

## Manual review targets

- Rotate and zoom the 3D globe.
- Select a base and destination in both 2D and 3D.
- Compare strategies; change resource constraints and observe recalculation.
- Start, pause, accelerate and reset the deterministic simulation.
- Export PDF, JSON and GeoJSON.

Execution results are added after dependency installation and build validation.

## Results — 2026-10-12

- `npm test`: **passed**, 8/8 Vitest cases.
- `npm run build`: **passed**, Next.js production compilation, strict type checking and static export.
- Local readiness request to `http://127.0.0.1:3100`: **HTTP 200**, generated page contained the Mars Survival title.
- Python API tests: **not executed** because neither Python nor Docker is installed in this environment. Test files are included but their status is unverified.
- Browser-driven visual QA: **not executed** because this session has no browser-control capability. The responsive layout was reviewed statically and HTTP readiness was verified.

## Environment note

The first `npm install` attempts stalled and left partial child processes in this Windows environment. The partial `node_modules` directory was removed after validating its exact workspace path; `npm install --ignore-scripts --no-audit --no-fund` then completed successfully with 212 packages.
