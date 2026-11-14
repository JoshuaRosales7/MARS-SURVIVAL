# Contributing to RedReturn

Thank you for improving RedReturn. The project welcomes contributions to the mission experience, 3D visualization, geodesy, resource model, ARES copilot, FastAPI service, tests, and documentation.

## Development setup

```powershell
npm.cmd install
npm.cmd run dev
```

For the optional API:

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -r api\requirements.txt
.venv\Scripts\python -m uvicorn api.main:app --reload --port 8000
```

## Before opening a pull request

```powershell
npm.cmd test
npm.cmd run build
.venv\Scripts\python -m pytest api\test_main.py
```

Keep pull requests focused. Explain the mission problem, the implemented behavior, scientific-data dependencies, and how the change was verified.

## Scientific integrity rules

1. Do not present visual detail as measured terrain.
2. New datasets must document provenance, resolution, coverage, coordinate convention, and quality state.
3. Missing data must remain explicit. Never replace unavailable elevation or telemetry with zero.
4. Generated AI language must not override deterministic calculations.
5. Do not claim medical, navigational, or operational certification.
6. Maintain planetocentric latitude and east-positive longitude unless a conversion is explicit.

## Code expectations

- Prefer typed, testable calculations outside React components.
- Keep browser-only visualization separate from scientific model contracts.
- Add regression tests for geodesy, constraints, risk semantics, or API contracts.
- Preserve accessible labels and keyboard focus for interactive controls.
- Avoid committing secrets, generated build directories, virtual environments, or downloaded planetary rasters.

## Commit and pull-request guidance

Use an imperative, outcome-oriented commit title, for example:

```text
Add DEM-backed slope sampling for local corridors
```

Use the pull-request template and attach screenshots for interface changes.

