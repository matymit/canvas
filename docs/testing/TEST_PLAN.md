# Canvas Test Plan: Shapes Text Editing, Rendering, and System Behavior

This test plan covers unit, integration, end-to-end, performance, visual regression, accessibility, security/IPC, and nonfunctional budgets.

## Unit tests

1) Geometry and layout (computeShapeInnerBox)
- rectangle: padding removed from width/height, inner box centered, non-negative
- ellipse: inner box uses W/√2, H/√2, minus padding; centered and non-negative
- triangle: inner box from bounding box minus padding; tip avoidance offset; non-negative

2) Text measurement and autosize
- single-line vs multi-line measurement; lineHeight behaviour
- autosize feeds overlay growth; shape vertical auto-grow never oscillates (monotonic increments)
- truncation/wrap decisions don’t regress overlay sizing

3) History batching
- beginBatch/endBatch; nested depth increments/decrements
- pushHistory flags; coalescing for rapid typing within a batch
- atomic preview→commit→auto-select grouped in a single undo step

4) Resize normalization
- image/table resize converts scale into width/height
- table colWidths/rowHeights scale proportionally with clamp

5) SmartGuides math
- grid-first rounding
- fine alignment delta & thresholds
- guide hide/show logic across drag frames

6) Performance helpers
- RafBatcher dedupes layer.batchDraw per frame
- KonvaNodePool acquire/release with reset/dispose and bounded capacity

## Integration tests

1) Tool flows
- rectangle, ellipse, triangle, text, sticky, image, connector, table, mindmap
- preview appears on Preview layer, commit to Main, auto-select, tool auto-switch to Select

2) Shape text overlay
- on commit, overlay opens centered; caret centered; typing expands overlay smoothly
- element height grows in small steps when content exceeds interior

3) Renderer registry
- modules mount after layer creation; subscribe to relevant subsets
- reconcile nodes and batchDraw main
- sticky color updates reflect instantly; no default color leakage

4) Transformer lifecycle
- one overlay Transformer attached on selection
- transformstart begins history batch; transformend writes normalized geometry (scales→1); ends batch

5) Drag with snapping
- grid rounding then SmartGuides; overlay guides on Overlay layer during drag; cleared on end

6) Persistence
- create scene; save via Tauri IPC; reload; Maps/Sets rehydrate; element order preserved; UI sane

## End‑to‑end tests (Playwright + Tauri)
- toolbar selection; stage pointer events; image pickers
- DOM overlay editor appears at correct screen coords (stage→page transform)
- commit on Enter/blur; cancel on Escape
- undo/redo restores geometry/content/selection; pan/zoom UX (space-pan, MMB pan, wheel zoom focus, fit-to-content)

## Performance & memory
- FPS under stress ~60fps with RAF batching, listening=false where safe; highlighter z-policy; overlay always on top
- HiDPI/DPR: crisp when moving between monitors due to per-layer DPR
- Drag optimization: optional temp-layer moves reduce redraw cost; measure layer draw counts & frame times

## Visual regression
- baselines: idle, hover/selected with Transformer, post-transform (scale/rotate normalized), guides during drag; overlay handles visible above content; highlighter beneath handles
- guide lines: clean show/hide, no ghosting after drag ends
- stability: use screenshots.css to hide volatile overlays and disable animations; update snapshots with named files only

## Accessibility & keyboard
- keyboard-only: roving selection; Enter to edit; Esc cancel; Tab traversal; arrow nudge; live-region announcements
- semantics: canvas container role, labeled toolbars, aria-activedescendant for virtual focus

## Security/IPC & packaging
- IPC payload validation; least-privilege capability scoping; error paths; WebView treated untrusted
- Release matrix: signed builds; macOS notarization; smoke test launch→create→persist→undo/redo→quit

## Nonfunctional acceptance
- Budgets: cold/warm start, memory ceiling for large N, interaction latency, FPS thresholds (fail build on regression)
- Build hygiene: chunk budgets, tree shaking, bundle size monitoring

## Specific tests for new shape text behavior
- Auto‑open editor after rectangle/ellipse/triangle commit; centered in inner box; correct font/lineHeight/min size
- Centered caret on focus and after delete-to-empty
- Circle text: overlay + Konva use the shared 70 % inscribed square, always centered (20 px / 1.25); resize is manual and transformer keeps the circle 1:1
- Renderer sync: after commit or changes, Konva.Text stays center/middle aligned with stageScale padding updates; main batchDraw called
- Triangle bounds: inner-box approximation avoids tip; optional clipFunc clips overflow if enabled

## Harness tips
- Unit: headless pure TS for math/slices/serialization; mock store adapters; avoid Konva instantiation
- Integration: spin Konva Stage in jsdom/canvas or Electron-like harness; assert layer child counts, node attrs, batched draws
- E2E: Playwright Tauri runner; native file pickers; capture exported PNGs for visual diffs
