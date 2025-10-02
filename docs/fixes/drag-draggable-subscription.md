# Drag Functionality Bug – Root Cause and Fix

**Date:** October 1, 2025  
**Status:** ✅ Fixed

---

## 🐛 Bug Description

After refactoring `StickyNoteModule`, `TableModuleAdapter`, and `MindmapRendererAdapter`, users could no longer drag sticky notes, tables, or mindmap nodes once they were added to the canvas.

**Affected Modules:**
- StickyNoteModule
- TableModuleAdapter
- MindmapRendererAdapter

---

## 🔍 Root Cause Analysis

The modules relied on store subscriptions that only tracked element maps and ignored tool changes:

```ts
// BEFORE (BROKEN)
ctx.store.subscribe(
  (state) => {
    const elements = new Map();
    for (const [id, element] of state.elements.entries()) {
      if (element.type === "sticky-note") {
        elements.set(id, element);
      }
    }
    return elements; // Only returns elements, NOT selectedTool
  },
  (elements) => this.reconcile(elements)
);
```

### Why This Broke Draggable State
1. Creation: elements were rendered with `draggable: !isPanToolActive()` – correct at creation time.
2. Tool switches (e.g., select ↔ pan) changed `state.ui.selectedTool`, but subscriptions never fired because the selector only returned the element map.
3. As a result, `reconcile()` never reran when the tool changed, leaving `draggable` stuck at its creation-time value.

**Implications:**
- Elements created while the pan tool was active stayed non-draggable indefinitely.
- Switching back to the select tool did not restore draggability until a manual reconciling action occurred.

---

## ✅ The Fix

Include `selectedTool` in the subscription selector so tool changes trigger reconciliation.

```ts
// AFTER (FIXED)
ctx.store.subscribe(
  (state) => {
    const stickyNotes = new Map();
    for (const [id, element] of state.elements.entries()) {
      if (element.type === "sticky-note") {
        stickyNotes.set(id, { ...element });
      }
    }
    // CRITICAL FIX: include selectedTool so draggable updates track tool changes
    return { stickyNotes, selectedTool: state.ui?.selectedTool };
  },
  ({ stickyNotes }) => this.renderingEngine?.reconcile(stickyNotes),
  {
    fireImmediately: true,
    equalityFn: (a, b) => {
      if (a.selectedTool !== b.selectedTool) return false;
      // …existing sticky note map comparison
    },
  },
);
```

The same change was applied to `TableModuleAdapter` and `MindmapRendererAdapter` (selector shape + equality function updates).

---

## 🎯 Result
- Tool switches now trigger `reconcile()` and refresh `draggable`.
- Elements correctly disable dragging when the pan tool is active and re-enable when returning to select.
- Undo/redo flows remain intact and RAF batching is preserved.

---

## 🧪 Validation

### Manual
1. Create sticky note.
2. Verify it drags while the select tool is active.
3. Switch to pan tool → element no longer drags.
4. Switch back to select → element drags again.
5. Repeat for tables and mindmap nodes.

### Console Snippet
```js
// Inspect draggable state as tools change
const stage = window.__DEBUG_STAGE__;
const stickyNotes = stage.find('[nodeType=sticky-note]');

const log = () => stickyNotes.forEach((n) => {
  console.log({
    id: n.id(),
    draggable: n.draggable(),
    tool: window.__STORE__.getState().ui.selectedTool,
  });
});

log();
window.__STORE__.getState().ui.setSelectedTool('pan');
setTimeout(log, 100);
```

---

## 📊 Impact Snapshot
- **Files touched:** `StickyNoteModule.ts`, `TableModuleAdapter.ts`, `MindmapRendererAdapter.ts`
- **Lines changed:** ~30
- **Type errors introduced:** 0
- **Performance:** Unchanged (still RAF batched)
```}