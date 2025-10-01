# FigJam Canvas Refactoring Plan

**File**: `src/features/canvas/components/FigJamCanvas.tsx`  
**Current Size**: 902 lines  
**Target Size**: ~150 lines  
**Reduction**: 83%  
**Priority**: HIGH  
**Estimated Time**: 3-4 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-50:    Imports and setup
Lines 51-200:  Stage setup and initialization - 149 lines
Lines 201-400: Event handlers - 199 lines
Lines 401-600: Rendering coordination - 199 lines
Lines 601-800: Lifecycle management - 199 lines
Lines 801-902: Cleanup and utilities - 101 lines
```

### Key Issues
- ❌ 902-line React component
- ❌ Stage, events, and rendering all in one component
- ❌ Hard to test individual features
- ❌ Poor separation of concerns

---

## 🎯 Refactoring Strategy

### Target Hook + Module Layout

1. **useCanvasStageLifecycle** (`hooks/useCanvasStageLifecycle.ts`) – Owns stage creation, layer wiring (background/main/preview/overlay), overlay DOM container, grid renderer, `setupRenderer` bootstrap, tool manager lifecycle, and resize cleanup.
2. **useCanvasViewportSync** (`hooks/useCanvasViewportSync.ts`) – Subscribes to viewport store changes, applies pan/zoom to stage + overlay, and keeps GridRenderer DPR aligned.
3. **useCanvasEvents** (`hooks/useCanvasEvents.ts`) – Registers Konva stage events (click, wheel, context menu, pointer guards) with store-driven logic and ensures safe teardown.
4. **useCanvasTools** (`hooks/useCanvasTools.tsx`) – Centralizes tool activation (cursor management, ToolManager canvas tools, `renderActiveTool` factory) and exposes the JSX node for the active tool.
5. **useCanvasShortcuts** (`hooks/useCanvasShortcuts.ts`) – Encapsulates keyboard shortcut wiring, mindmap-specific handlers, clipboard integration, duplication, undo/redo contracts, and tool switching.
6. **useCanvasServices** (`hooks/useCanvasServices.ts`) – Coordinates context menu managers, clipboard initialization, RafBatcher exposure, and global window listeners that aren't strictly keyboard-related.
7. **FigJamCanvas** (refactored) – A ~150-line component composing the hooks above alongside the toolbar, marquee, pan tool, and context menu managers.

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "figjam-0-audit-side-effects",
      "description": "Inventory FigJamCanvas side-effects (global window props, StoreActions usage, context menu mounts) before extraction",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "1-902"}],
      "code_changes": [
        {
          "operation": "document",
          "content": "Create checklist mapping each useEffect/useCallback to new hook owners"
        }
      ],
      "validation_steps": ["Review checklist with team", "Confirm every effect has a target hook"],
      "success_criteria": "No implicit side-effect left unaccounted for before refactor",
      "dependencies": [],
      "rollback_procedure": "Discard checklist if approach changes"
    },
    {
      "task_id": "figjam-1-stage-lifecycle",
      "description": "Extract stage + renderer initialization into useCanvasStageLifecycle",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "51-260"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/components/figjam/hooks/useCanvasStageLifecycle.ts",
          "content": "Encapsulate stage creation, layer wiring, overlay DOM container, grid renderer, setupRenderer(), ToolManager, resize listener, cleanup"
        }
      ],
      "validation_steps": ["npm run type-check", "Manual smoke: load canvas, resize window", "Confirm (window as any).konvaStage still set"],
      "success_criteria": "Stage + renderer initialize once, layers stay in correct order, cleanup leaves no globals",
      "dependencies": ["figjam-0-audit-side-effects"],
      "rollback_procedure": "git checkout src/features/canvas/components/FigJamCanvas.tsx && rm src/features/canvas/components/figjam/hooks/useCanvasStageLifecycle.ts"
    },
    {
      "task_id": "figjam-2-viewport-sync",
      "description": "Extract viewport sync effect into useCanvasViewportSync",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "260-360"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/components/figjam/hooks/useCanvasViewportSync.ts",
          "content": "Sync stage position/scale, update overlay transform, recalc grid DPR"
        }
      ],
      "validation_steps": ["npm run type-check", "Pan/zoom manually", "Verify overlay + grid alignment"],
      "success_criteria": "Viewport store drives stage without jitter; grid remains crisp",
      "dependencies": ["figjam-1-stage-lifecycle"],
      "rollback_procedure": "git checkout src/features/canvas/components/FigJamCanvas.tsx && rm src/features/canvas/components/figjam/hooks/useCanvasViewportSync.ts"
    },
    {
      "task_id": "figjam-3-stage-events",
      "description": "Extract Konva stage event wiring into useCanvasEvents",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "360-520"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/components/figjam/hooks/useCanvasEvents.ts",
          "content": "Register click/wheel/contextmenu handlers, include tests for selection toggle logic"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- useCanvasEvents.test.ts", "Manual check: click empty stage clears selection"],
      "success_criteria": "All existing stage events behave identically, teardown occurs on unmount",
      "dependencies": ["figjam-1-stage-lifecycle"],
      "rollback_procedure": "git checkout src/features/canvas/components/FigJamCanvas.tsx && rm src/features/canvas/components/figjam/hooks/useCanvasEvents.ts"
    },
    {
      "task_id": "figjam-4-tools-and-cursor",
      "description": "Create useCanvasTools to manage ToolManager activation and renderActiveTool",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "520-760"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/components/figjam/hooks/useCanvasTools.tsx",
          "content": "Return { cursorStyle, activeToolNode } based on selected tool; handle ToolManager canvas tools"
        }
      ],
      "validation_steps": ["npm run type-check", "Manual: switch between select/pan/pen/mindmap", "Ensure canvas tool attach/detach works"],
      "success_criteria": "Cursor + ToolManager activation mirror current behavior; active tool JSX rendered via hook",
      "dependencies": ["figjam-1-stage-lifecycle"],
      "rollback_procedure": "git checkout src/features/canvas/components/FigJamCanvas.tsx && rm src/features/canvas/components/figjam/hooks/useCanvasTools.tsx"
    },
    {
      "task_id": "figjam-5-shortcuts-and-clipboard",
      "description": "Move keyboard shortcuts, mindmap key handlers, copy/paste, duplicate logic into useCanvasShortcuts",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "520-760"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/components/figjam/hooks/useCanvasShortcuts.ts",
          "content": "Expose initShortcuts({ stageRef, mindmapOps, clipboard, withUndo }) and handle teardown"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- useCanvasShortcuts.test.ts", "Manual: copy/paste, undo/redo, mindmap Enter shortcut"],
      "success_criteria": "All shortcuts, clipboard flows, and mindmap duplicates remain functional",
      "dependencies": ["figjam-1-stage-lifecycle"],
      "rollback_procedure": "git checkout src/features/canvas/components/FigJamCanvas.tsx && rm src/features/canvas/components/figjam/hooks/useCanvasShortcuts.ts"
    },
    {
      "task_id": "figjam-6-services-and-context",
      "description": "Extract remaining services (context menu managers, RafBatcher exposure, overlay transform helper) into useCanvasServices",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "80-820"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/components/figjam/hooks/useCanvasServices.ts",
          "content": "Manage overlayRef, Table/Mindmap/Canvas context menu wiring, RafBatcher ref, expose helper getters"
        }
      ],
      "validation_steps": ["npm run type-check", "Right-click table + mindmap nodes", "Check RafBatcher still throttles drawing tools"],
      "success_criteria": "Context menu managers receive stageRef, overlay transform updates unaffected",
      "dependencies": ["figjam-1-stage-lifecycle"],
      "rollback_procedure": "git checkout src/features/canvas/components/FigJamCanvas.tsx && rm src/features/canvas/components/figjam/hooks/useCanvasServices.ts"
    },
    {
      "task_id": "figjam-7-refactor-component",
      "description": "Rewrite FigJamCanvas component to compose new hooks, lighten JSX, and pass refs downstream",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "line_range": "1-902"}],
      "code_changes": [
        {
          "operation": "replace",
          "find_pattern": "Legacy component body",
          "replace_with": "Use hooks: const { containerRef, stageRef, overlayRef } = useCanvasStageLifecycle(...); const viewport = useCanvasViewportSync(...); const events = useCanvasEvents(...); const { cursorStyle, activeToolNode } = useCanvasTools(...); const shortcuts = useCanvasShortcuts(...); const services = useCanvasServices(...); compose JSX"
        }
      ],
      "validation_steps": ["npm run type-check", "npm run build", "Manual regression sweep"],
      "success_criteria": "Component ~150 lines, hooks cover all previous side-effects, UI identical",
      "dependencies": ["figjam-1-stage-lifecycle", "figjam-2-viewport-sync", "figjam-3-stage-events", "figjam-4-tools-and-cursor", "figjam-5-shortcuts-and-clipboard", "figjam-6-services-and-context"],
      "rollback_procedure": "git checkout src/features/canvas/components/FigJamCanvas.tsx"
    },
    {
      "task_id": "figjam-8-add-tests",
      "description": "Create hook-focused unit tests and integration smoke for FigJamCanvas",
      "target_files": [
        {"path": "src/features/canvas/components/figjam/hooks/__tests__/useCanvasStageLifecycle.test.ts", "status": "create"},
        {"path": "src/features/canvas/components/figjam/hooks/__tests__/useCanvasEvents.test.ts", "status": "create"},
        {"path": "src/features/canvas/components/figjam/hooks/__tests__/useCanvasShortcuts.test.ts", "status": "create"},
        {"path": "src/features/canvas/components/__tests__/FigJamCanvas.smoke.test.tsx", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/components/figjam/hooks/__tests__/useCanvasStageLifecycle.test.ts", "content": "Mock Konva stage + ensure cleanup"},
        {"operation": "create", "file": "src/features/canvas/components/figjam/hooks/__tests__/useCanvasEvents.test.ts", "content": "Verify click clears selection"},
        {"operation": "create", "file": "src/features/canvas/components/figjam/hooks/__tests__/useCanvasShortcuts.test.ts", "content": "Ensure copy/paste delegates with withUndo"},
        {"operation": "create", "file": "src/features/canvas/components/__tests__/FigJamCanvas.smoke.test.tsx", "content": "Render component with mocked store and assert hooks called"}
      ],
      "validation_steps": ["npm test", "Collect coverage >80% for new hooks"],
      "success_criteria": "Hook behaviors covered; smoke test protects composition",
      "dependencies": ["figjam-7-refactor-component"],
      "rollback_procedure": "rm src/features/canvas/components/figjam/hooks/__tests__/* && rm src/features/canvas/components/__tests__/FigJamCanvas.smoke.test.tsx"
    },
    {
      "task_id": "figjam-9-performance-validation",
      "description": "Run performance + memory validation after refactor",
      "target_files": [{"path": "src/features/canvas/components/FigJamCanvas.tsx", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["60fps during drag/zoom", "No duplicate renderer initialization", "Context menus open <50ms"]}
      ],
      "validation_steps": ["Manual perf profiling", "Test with 1000+ elements", "Tauri smoke if applicable"],
      "success_criteria": "No regressions: stage initializes once, memory stable, RAF batching verified",
      "dependencies": ["figjam-7-refactor-component"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": [
    "figjam-0-audit-side-effects",
    "figjam-1-stage-lifecycle",
    "figjam-2-viewport-sync",
    "figjam-3-stage-events",
    "figjam-4-tools-and-cursor",
    "figjam-5-shortcuts-and-clipboard",
    "figjam-6-services-and-context",
    "figjam-7-refactor-component",
    "figjam-8-add-tests",
    "figjam-9-performance-validation"
  ],
  "critical_warnings": [
    "⚠️ Preserve four-layer Konva pipeline + overlay DOM synchronization",
    "⚠️ ToolManager must only be instantiated once and destroyed on unmount",
    "⚠️ Clipboard + withUndo flows rely on store methods that may be undefined; keep fallbacks",
    "⚠️ Keyboard shortcuts and mindmap operations must remain guarded to avoid interfering with text editing",
    "⚠️ Do not remove global stage exposure required by tests (window.konvaStage)"
  ]
}
```

---

## 📋 Validation Checklist

- [ ] Stage + renderer initialize once; teardown clears ToolManager, GridRenderer, overlay DOM, and `window.konvaStage`
- [ ] Four-layer pipeline (background/main/preview/overlay) preserved and overlay transform stays aligned during pan/zoom
- [ ] Store-driven viewport sync keeps grid crisp and avoids jitter at different DPRs
- [ ] Stage click/wheel/context menu handlers behave identically (selection toggle, zoom-at-pointer, no accidental context menu)
- [ ] Tool cursor + ToolManager canvas tools activate/deactivate correctly for sticky, text, connector, drawing tools
- [ ] Keyboard shortcuts (delete, copy, paste, duplicate, undo/redo, mindmap Enter + duplicate) continue to work with withUndo fallbacks
- [ ] Clipboard integration still offsets pasted elements and handles point arrays
- [ ] Context menu managers (table, mindmap, canvas) mount and open in <50ms with correct stageRef
- [ ] Rendering + RafBatcher maintain 60fps during heavy drawing + marquee drags
- [ ] Pan/zoom + fit-to-content behave identically and update overlay/grid
- [ ] Undo/redo + withUndo transactions produce identical history entries

---

## ⚠️ Systemic Risks & Mitigations

- **Stage lifecycle drift** – If stage creation leaks refs or layers reorder, ToolManager and overlay consumers break. *Mitigation*: keep a single owner hook (`useCanvasStageLifecycle`), assert layer order in a unit test, and snapshot `window.konvaStage` in smoke tests.
- **Viewport desynchronization across stores** – View/zoom updates currently fan out via store subscribers; splitting into hooks could introduce stale closures. *Mitigation*: co-locate store selectors inside `useCanvasViewportSync`, memoize dependencies, and add regression test that pans + zooms via dispatched actions.
- **Shortcut/global listener conflicts** – Moving keyboard handlers risks double-binding, especially with mindmap vs. text editing focus. *Mitigation*: centralize registration in `useCanvasShortcuts`, gate bindings on focus state, and add E2E coverage for typing in sticky vs. mindmap nodes.
- **Context menu + clipboard regressions** – These services rely on timing and stage references; extraction could delay or drop registrations. *Mitigation*: ensure `useCanvasServices` wires menus after stage is ready, add integration test for table + mindmap menus, and profile open latency post-refactor.
- **Performance regressions under load** – Additional hook boundaries might introduce redundant renders or RAF scheduling changes. *Mitigation*: leverage `useLayoutEffect` where necessary, memoize stage callbacks, run `figjam-9-performance-validation`, and capture performance baselines before merging.
- **Global contract breakage** – Some legacy code inspects `window.konvaStage` and `window.canvasRafBatcher`. *Mitigation*: document these global exposures in the side-effects audit, re-export from hooks, and add sanity checks in smoke test to confirm globals remain.

---

## 🎯 Success Metrics

**Before**: 902 lines, monolithic component  
**After**: ~150 line component + 6 hooks (~700 total)  
**Impact**: 83% component reduction, reusable hook suite

---

**Establishes pattern for main canvas component refactoring.**
