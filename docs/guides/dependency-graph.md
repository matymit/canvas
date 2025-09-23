## Dependency Graph: Generate, Visualize, and Analyze

This guide explains how to generate a dependency graph for the codebase, render SVG diagrams, and compute metrics for hotspots and cycles. It uses dependency-cruiser and a WASM Graphviz renderer, so no system Graphviz is required.

### Prerequisites
- Node and npm installed
- Dev deps installed (scripts will install as needed): `dependency-cruiser`, `@hpcc-js/wasm`

### Artifacts
- Full `src`:
  - `.dependency-cache/depcruise-src.json` – JSON graph
  - `.dependency-cache/depcruise-src.dot` – Graphviz DOT
  - `.dependency-cache/depcruise-src.svg` – SVG diagram
  - `.dependency-cache/depcruise-src.metrics.txt` – In/Out/Total degree + SCCs
  - `.dependency-cache/src-edges.tsv` – Edge list (filtered to local/aliased)
- Canvas feature only (`src/features/canvas`): matching files with `-canvas` in the name

### One-command runs
- Full repo:
```bash
npm run deps:all:src
```
- Canvas feature only:
```bash
npm run deps:all:canvas
```

### Make targets
```bash
make deps-all-src      # full repo graph + metrics + focused view
make deps-all-canvas   # canvas feature graph + metrics + focused view
```

### Focused graphs
The pipeline also produces a focused graph using filtered edges:
- `.dependency-cache/depcruise-src-focused.{dot,svg}`
- `.dependency-cache/depcruise-canvas-focused.{dot,svg}`

### How it works
- `dependency-cruiser` scans modules and outputs JSON/DOT
- `scripts/deps-render.mjs` renders DOT to SVG via `@hpcc-js/wasm`
- `scripts/deps-metrics.mjs` computes degrees and SCCs
- `scripts/deps-edges.mjs` extracts filtered edges
- `scripts/edges-to-dot.mjs` builds focused DOT from edges

### Troubleshooting
- If paths/aliases don’t resolve, check `tsconfig.json` paths and `.dependency-cruiser.cjs` config
- Ensure `.dependency-cache` exists and is writable
- For very large graphs, prefer the focused graphs


