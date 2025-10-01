# Marquee Live Drag Synchronization Fix

**Date:** October 1, 2025  
**Branch:** `main`

## Summary

Connectors with free endpoints and mindmap subtrees now move in lockstep with marquee selections. Previously, those elements remained frozen during the drag gesture and only snapped into place after releasing the pointer, causing jarring visual pops and edge stretching.

## Symptoms

1. Draw a marquee around a rectangle, a free-end connector, and a mindmap cluster.
2. Begin dragging the selection.
3. Rectangles move immediately, but:
   - Connector lines stay anchored and “teleport” into place only when the drag ends.
   - Mindmap children lag behind the parent and snap on release.
4. Branch edges appear elastic or detached during the drag.

## Root Causes

- **Connector gaps**: The drag hook only cached top-level node positions. Connector Konva groups and path shapes never received live deltas; reroutes were deferred to the completion path.
- **Mindmap gaps**: Mindmap descendants were captured for persistence but not moved during the pointer-move phase, so only the parent node moved live.
- **State residue**: Connector baseline maps were not cleared before reselection, leading to stale Konva node references when the renderer rebuilt after store commits.

## Technical Fix

### 1. Baseline Capture Enhancements

- Record connector baselines (`position`, cloned `from`/`to` endpoints, resolved Konva group + `.connector-shape`) during `initiateDrag`.
- Collect active mindmap parent IDs and populate `mindmapDescendantBaselines` with the stored `x/y` coordinates for each descendant.

### 2. Live Pointer-Move Updates

- For each pointer move, compute `dragDelta` and:
  - Update Konva connector groups or the `.connector-shape` points using cached baselines (point endpoints use direct coordinate offsets).
  - Invoke `mindmapSelectionManager.moveMindmapDescendants()` with the delta and baselines so every descendant node and connecting edge shifts in sync.
- Batch redraw the main layer to reflect the live updates without hitting the store.

### 3. Commit Path Cohesion

- Assemble store patches for all moved nodes (parents + descendants) and apply them via `updateElements(..., { pushHistory: true })` for undo support.
- Send connector deltas back to `connectorSelectionManager.moveSelectedConnectors()` so the manager owns the final store updates + history tagging.
- Schedule `mindmapSelectionManager.scheduleReroute()` for active parents to refresh branch routing once the store settles.

### 4. Cleanup Hygiene

- Clear `selectedNodes`, `selectedConnectorIds`, connector baselines, and mindmap caches **before** reselection so fresh Konva nodes are captured on the next frame.

## Files Impacted

- `src/features/canvas/components/tools/navigation/hooks/useMarqueeDrag.ts`
- `src/features/canvas/components/tools/navigation/hooks/useMarqueeState.ts`
- `src/features/canvas/components/tools/navigation/MarqueeSelectionTool.tsx`

> Existing connector and mindmap managers now receive richer baseline data but did not require code changes for this fix.

## Validation

- `npm run type-check`
- Manual drag QA with mixed selections (shapes + connectors + mindmap subtrees) across zoom levels.

## Prevention Checklist

- Always capture Konva node references for non-standard geometries (connectors, complex groups) in `initiateDrag`.
- Keep live drag logic store-free; update only Konva visuals until commit.
- Ensure dependent structures (descendants, anchors) receive the same delta during live updates.
- Flush drag caches before reselection to avoid stale references.
- Pair live visuals with post-commit reroute/schedule calls for deterministic final layouts.
