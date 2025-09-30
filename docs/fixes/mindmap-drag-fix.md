# Mindmap Drag Fix Documentation

**Date:** September 30, 2025  
**Commit:** 74f31b2  
**Issue:** Mindmap nodes could be selected but not dragged; when dragged, only parent moved, not children

## Problem Analysis

### Symptoms
1. User clicks mindmap node → node gets selected (transformer appears)
2. User tries to drag → nothing happens OR only parent node moves
3. Child nodes stay in original position while parent moves
4. Edges get disconnected from nodes

### Root Cause

**Primary Issue: persistentSelection Not Syncing**

In `MarqueeSelectionTool.tsx`, the drag system works in two phases:
1. **Phase 1 (first click):** Select element, show transformer
2. **Phase 2 (second click):** If element is in `persistentSelection`, prepare for drag

The bug was at line ~470:
```typescript
// OLD CODE (BROKEN):
marqueeRef.current.persistentSelection = [];  // ❌ Clear selection
setSelection([targetElementId]);              // Select in store
return;                                       // Exit
// persistentSelection is [], NOT synced with store!
```

**Result:** Every subsequent click saw `persistentSelection = []`, so it treated the element as "not selected" and just re-selected it instead of preparing for drag.

**Secondary Issue: Descendants Not Included in Drag**

Even when drag worked, only the parent node was being updated. The descendant nodes were never:
- Captured in base position tracking
- Moved during live drag (onPointerMove)
- Committed to store during final update (onPointerUp)

## Solution

### Fix 1: Sync persistentSelection After Selection

**File:** `src/features/canvas/components/tools/navigation/MarqueeSelectionTool.tsx`  
**Location:** Line ~470

```typescript
// NEW CODE (FIXED):
setSelection([targetElementId]);              // Select in store
marqueeRef.current.persistentSelection = [targetElementId];  // ✅ Sync!
return;
```

**Why It Works:**
- Now `persistentSelection` stays synced with store selection
- Second click recognizes element is selected
- Enters drag preparation phase instead of re-selecting

### Fix 2: Capture Descendant Base Positions

**File:** `MarqueeSelectionTool.tsx`  
**Location:** Lines ~310-330, inside "starting drag on selected element" block

```typescript
// Capture base positions for mindmap descendants
const mindmapRenderer = typeof window !== "undefined" ? (window as any).mindmapRenderer : null;
if (mindmapRenderer) {
  selectedNodes.forEach((node) => {
    const elementId = node.getAttr("elementId") || node.id();
    const element = elements.get(elementId);
    
    if (element?.type === "mindmap-node") {
      const descendants = mindmapRenderer.getAllDescendants?.(elementId);
      if (descendants && descendants.size > 0) {
        descendants.forEach((descendantId: string) => {
          const descendantGroup = mindmapRenderer.nodeGroups?.get(descendantId);
          const descendantElement = elements.get(descendantId);
          
          if (descendantGroup && descendantElement) {
            const descendantPos = { x: descendantElement.x, y: descendantElement.y };
            marqueeRef.current.basePositions.set(descendantId, descendantPos);
          }
        });
      }
    }
  });
}
```

**Why It Works:**
- Uses `mindmapRenderer.getAllDescendants()` to find all child nodes
- Captures initial position of each descendant
- Stores in same `basePositions` map used for parent

### Fix 3: Move Descendants During Live Drag

**File:** `MarqueeSelectionTool.tsx`  
**Location:** Lines ~630-680, inside `onPointerMove` handler

```typescript
// Handle mindmap nodes - move descendants along with parent
if (element?.type === "mindmap-node") {
  const mindmapRenderer = typeof window !== "undefined" ? (window as any).mindmapRenderer : null;
  if (mindmapRenderer) {
    const descendants = mindmapRenderer.getAllDescendants?.(elementId);
    if (descendants && descendants.size > 0) {
      // Move all descendants
      descendants.forEach((descendantId: string) => {
        const descendantGroup = mindmapRenderer.nodeGroups?.get(descendantId);
        const descendantBasePos = marqueeRef.current.basePositions.get(descendantId);
        
        if (descendantGroup && descendantBasePos) {
          descendantGroup.position({
            x: descendantBasePos.x + dragDelta.dx,
            y: descendantBasePos.y + dragDelta.dy,
          });
        }

        // Update store for descendant (without history - live drag)
        const descendantElement = store.elements?.get(descendantId);
        if (descendantElement && store.updateElement) {
          const descendantStoreBasePos = marqueeRef.current.basePositions.get(descendantId);
          if (descendantStoreBasePos) {
            store.updateElement(descendantId, {
              x: descendantStoreBasePos.x + dragDelta.dx,
              y: descendantStoreBasePos.y + dragDelta.dy,
            }, { pushHistory: false });
            movedElementIds.add(descendantId);
          }
        }
      });

      // Update edges for live visual feedback
      if (mindmapRenderer.updateConnectedEdgesForNode) {
        const allNodes = new Set([elementId, ...Array.from(descendants)]);
        allNodes.forEach((nodeId: string) => {
          mindmapRenderer.updateConnectedEdgesForNode(nodeId);
        });
      }
    }
  }
}
```

**Why It Works:**
- Detects when dragged element is a mindmap node
- Moves each descendant by the same delta as parent
- Updates both Konva visual nodes AND store data
- Updates edges for smooth visual feedback

### Fix 4: Commit Descendants in Final Update

**File:** `MarqueeSelectionTool.tsx`  
**Location:** Lines ~815-860, inside `onPointerUp` handler

```typescript
} else if (element.type === "mindmap-node") {
  // Handle mindmap nodes - commit parent and all descendants
  if (basePos) {
    elementUpdates.push({
      id: elementId,
      patch: {
        x: basePos.x + finalDelta.dx,
        y: basePos.y + finalDelta.dy,
      },
    });

    // Add all descendants to the update batch
    const mindmapRenderer = typeof window !== "undefined" ? (window as any).mindmapRenderer : null;
    if (mindmapRenderer) {
      const descendants = mindmapRenderer.getAllDescendants?.(elementId);
      if (descendants && descendants.size > 0) {
        descendants.forEach((descendantId: string) => {
          const descendantBasePos = marqueeRef.current.basePositions.get(descendantId);
          if (descendantBasePos) {
            elementUpdates.push({
              id: descendantId,
              patch: {
                x: descendantBasePos.x + finalDelta.dx,
                y: descendantBasePos.y + finalDelta.dy,
              },
            });
          }
        });
      }
    }
  }
}
```

**Why It Works:**
- Adds parent node to `elementUpdates` batch
- Adds ALL descendant nodes to same batch
- `store.updateElements(elementUpdates, { pushHistory: true })` commits all in one transaction
- Single undo operation reverts entire mindmap movement

## Testing

### Manual Test Steps
1. Add mindmap to canvas using mindmap tool
2. Click root node → transformer appears ✅
3. Click root node again and drag → entire mindmap moves together ✅
4. Release → all nodes committed to store ✅
5. Undo → entire mindmap returns to original position ✅
6. Drag again → smooth movement with live edge updates ✅

### Expected Behavior
- **First click:** Select node, show transformer
- **Second click + drag:** Move entire subtree (parent + children) in unison
- **During drag:** Edges stay connected and update smoothly
- **After release:** All positions persisted to store
- **Undo:** Single undo operation reverts all nodes

## Why This Happens Again

This bug pattern occurs when:

1. **State Sync Failure:** Component-local ref state (`marqueeRef.current.persistentSelection`) gets out of sync with external state (Zustand store `selectedElementIds`)
   - **Prevention:** Always sync refs immediately after store updates
   - **Detection:** Add assertions or console logs checking ref === store

2. **Partial Updates:** Parent element gets updated but related/dependent elements (children, edges, connectors) are forgotten
   - **Prevention:** Use helper functions like `getAllDescendants()` to collect related elements
   - **Detection:** Visual testing - if edges disconnect or children lag, descendants aren't being moved

3. **Missing Handler:** Logic added to one phase (live drag) but not another (final commit)
   - **Prevention:** Grep for all update phases: `onPointerMove`, `onPointerUp`, commit blocks, undo handlers
   - **Detection:** Works during drag but reverts on release = missing final commit logic

## Architecture Notes

### MarqueeSelectionTool is the Drag Authority

**Key Discovery:** Even though `TransformLifecycleCoordinator` and `SelectionModule` have drag handlers, MarqueeSelectionTool **disables** `draggable` on all selected nodes and handles dragging manually via pointer events.

```typescript
// Line ~304 in MarqueeSelectionTool
node.draggable(false);  // Prevents Konva's internal drag system
```

**Why:** MarqueeSelectionTool needs full control for:
- Marquee box selection
- Multi-element drag
- Custom drag behavior (connectors, mindmap nodes)

**Implication:** Any fix for element dragging MUST be in MarqueeSelectionTool, not just SelectionModule or transformer managers.

### Mindmap Hierarchy

Mindmap nodes form a parent-child tree:
- Root node has `parentId: null`
- Child nodes have `parentId: <parent-uuid>`
- `MindmapRenderer.getAllDescendants(nodeId)` recursively collects all children

**Critical:** Descendants are NOT automatically selected when parent is selected. They must be explicitly included in drag operations.

## Related Files

### Modified
- `src/features/canvas/components/tools/navigation/MarqueeSelectionTool.tsx` (main fix)
- `src/features/canvas/renderer/modules/SelectionModule.ts` (debug logs, unused prep code)
- `src/features/canvas/renderer/modules/selection/managers/MindmapSelectionManager.ts` (unused prep code)

### Related (for future reference)
- `src/features/canvas/renderer/modules/MindmapRenderer.ts` - has working drag handlers (lines 355-465) but are bypassed by MarqueeSelectionTool
- `src/features/canvas/renderer/modules/selection/controllers/TransformLifecycleCoordinator.ts` - attaches drag handlers to transformer nodes
- `src/features/canvas/managers/TransformerManager.ts` - forces `draggable(true)` on attached nodes

## Prevention Checklist

When implementing drag functionality for hierarchical elements:

- [ ] Identify ALL phases: selection, drag start, live drag, drag end, undo
- [ ] Capture base positions for parent AND all related elements
- [ ] Update positions during live drag for parent AND all related elements  
- [ ] Commit final positions for parent AND all related elements
- [ ] Verify undo/redo includes all related elements in single transaction
- [ ] Check if MarqueeSelectionTool disables native drag - if yes, fix MUST be there
- [ ] Test: visual (edges stay connected), functional (all move together), persistence (undo works)

## Additional Context

This fix was discovered through:
1. Sequential thinking to analyze console logs
2. Realizing `persistentSelection` was always `[]` in logs
3. Tracing MarqueeSelectionTool's selection logic
4. Understanding MarqueeSelectionTool disables native Konva drag
5. Examining connector handling as a pattern for hierarchical elements
