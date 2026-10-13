# Mars Survival

**Explore Farther. Return Safer.** A working educational mission-planning increment for the NASA Space Apps Challenge: global Mars exploration, transparent route geometry, round-trip resource evaluation and deterministic simulation.

## What works

- Interactive 3D Mars globe with NASA Mars Trek MGS/MOLA WMTS imagery, rotation, zoom and point selection.
- Full-planet 2D equirectangular view, coordinate grid, markers and computed routes.
- Great-circle distance and interpolation with antimeridian/polar handling.
- Four visible planning strategies. The global product is honestly labelled `global-geometric`; strategies that require terrain data are not claimed as terrain-safe.
- Round-trip oxygen, energy, time, reserve and contingency model with editable assumptions.
- Deterministic simulation controls and calculated resource charts.
- JSON, GeoJSON (with Mars coordinate convention metadata), and PDF mission exports.
- Typed FastAPI contracts for health, regions, layers, terrain status, route planning/comparison, mission evaluation/simulation, science locations and dataset status.
- Local A* implementation for bounded cost grids, ready for numeric DEM integration.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. The static frontend works independently. To run the optional API (Python 3.11+):

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -r api\requirements.txt
.venv\Scripts\python -m uvicorn api.main:app --reload --port 8000
```

API documentation is at `http://localhost:8000/docs`.

## Verify

```powershell
npm.cmd test
npm.cmd run build
.venv\Scripts\python -m pytest api\test_main.py
```

## Scientific provenance

- [NASA Mars Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars): global MGS MOLA color hillshade basemap. The documented global layer uses Mars equirectangular `EPSG:104905` and identifies the source product as 463 m/pixel.
- [NASA PDS MOLA MEGDR](https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MGS-M-MOLA-5-MEGDR-L3-V1.0): authoritative gridded MOLA topography archive; catalogued but not downloaded or mounted in this increment.
- [USGS planetary coordinate guidance](https://planetarynames.wr.usgs.gov/TargetCoordinates): the application uses planetocentric latitude and east-positive longitude, normalized in the UI to −180°…+180°.

## Scientific limits

This is an educational and experimental planner, not certified navigation, medical guidance, or operational mission software. The current route engine computes global surface geometry; it does **not** evaluate route-specific elevation, slope, rock fields, regolith trafficability, radiation, current weather, or communications. The UI and API return `insufficient-data`/`501` instead of fabricating a DEM profile. Resource rates are visible, editable assumptions.

## Roadmap / not yet implemented

- Mount and sample a numeric MOLA MEGDR raster with cache and tile pyramids.
- Hierarchical global graph plus local raster A*/Dijkstra refinement against slope/roughness.
- CTX/HiRISE coverage discovery and high-resolution DEM refinement.
- Camera fly-to for catalog locations, terrain-follow mode, offline tile cache and cancelable backend jobs.
- Saved mission library and server-side map snapshot composition.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/VERIFICATION.md](docs/VERIFICATION.md).
