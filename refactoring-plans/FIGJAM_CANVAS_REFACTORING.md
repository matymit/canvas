# FigJam Canvas Refactoring Plan

**File**: `src/app/FigJamCanvas.tsx`  
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

### Extract Four Custom Hooks

1. **useCanvasStage** (`hooks/useCanvasStage.ts`) - ~220 lines
2. **useCanvasEvents** (`hooks/useCanvasEvents.ts`) - ~220 lines
3. **useCanvasRenderers** (`hooks/useCanvasRenderers.ts`) - ~220 lines
4. **FigJamCanvas** (refactored) - ~150 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "figjam-1-extract-stage",
      "description": "Extract stage setup to useCanvasStage hook",
      "target_files": [{"path": "src/app/FigJamCanvas.tsx", "line_range": "51-200"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/app/hooks/useCanvasStage.ts",
          "content": "Extract stage hook:\n- initializeStage()\n- createLayers() [4 layers: background, main, preview, overlay]\n- setupViewport()\n- handleResize()\n- cleanupStage()\n- Return: { stageRef, containerRef, layers }"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- useCanvasStage.test.ts", "Verify stage initializes"],
      "success_criteria": "Stage setup works identically, 4-layer pipeline preserved",
      "dependencies": [],
      "rollback_procedure": "git checkout src/app/FigJamCanvas.tsx && rm src/app/hooks/useCanvasStage.ts"
    },
    {
      "task_id": "figjam-2-extract-events",
      "description": "Extract event handlers to useCanvasEvents hook",
      "target_files": [{"path": "src/app/FigJamCanvas.tsx", "line_range": "201-400"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/app/hooks/useCanvasEvents.ts",
          "content": "Extract events hook:\n- handleMouseDown()\n- handleMouseMove()\n- handleMouseUp()\n- handleWheel()\n- handleKeyDown()\n- handleKeyUp()\n- Return: { eventHandlers }"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- useCanvasEvents.test.ts", "Verify all interactions"],
      "success_criteria": "All event handlers work identically, no handler loss",
      "dependencies": [],
      "rollback_procedure": "git checkout src/app/FigJamCanvas.tsx && rm src/app/hooks/useCanvasEvents.ts"
    },
    {
      "task_id": "figjam-3-extract-renderers",
      "description": "Extract rendering coordination to useCanvasRenderers hook",
      "target_files": [{"path": "src/app/FigJamCanvas.tsx", "line_range": "401-600"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/app/hooks/useCanvasRenderers.ts",
          "content": "Extract renderers hook:\n- renderElements()\n- renderConnectors()\n- renderSelection()\n- renderGrid()\n- coordinateRendering() [RAF batching]\n- Return: { render, requestRender }"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- useCanvasRenderers.test.ts", "Verify rendering works"],
      "success_criteria": "Rendering works identically, RAF batching preserved, 60fps maintained",
      "dependencies": [],
      "rollback_procedure": "git checkout src/app/FigJamCanvas.tsx && rm src/app/hooks/useCanvasRenderers.ts"
    },
    {
      "task_id": "figjam-4-refactor-component",
      "description": "Refactor FigJamCanvas to compose hooks",
      "target_files": [{"path": "src/app/FigJamCanvas.tsx", "line_range": "1-902"}],
      "code_changes": [
        {
          "operation": "replace",
          "find_pattern": "All hook logic (lines 51-902)",
          "replace_with": "Compose hooks:\n- const { stageRef, containerRef, layers } = useCanvasStage()\n- const { eventHandlers } = useCanvasEvents(stageRef)\n- const { render, requestRender } = useCanvasRenderers(layers)\n- Wire up hooks\n- Render JSX"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- FigJamCanvas.test.tsx", "npm run build"],
      "success_criteria": "Component coordinates hooks, all features work, 60fps maintained",
      "dependencies": ["figjam-1-extract-stage", "figjam-2-extract-events", "figjam-3-extract-renderers"],
      "rollback_procedure": "git checkout src/app/FigJamCanvas.tsx && git checkout src/app/hooks/"
    },
    {
      "task_id": "figjam-5-add-tests",
      "description": "Create test suites for hooks",
      "target_files": [
        {"path": "src/app/hooks/__tests__/useCanvasStage.test.ts", "status": "create"},
        {"path": "src/app/hooks/__tests__/useCanvasEvents.test.ts", "status": "create"},
        {"path": "src/app/hooks/__tests__/useCanvasRenderers.test.ts", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/app/hooks/__tests__/useCanvasStage.test.ts", "content": "Test stage setup"},
        {"operation": "create", "file": "src/app/hooks/__tests__/useCanvasEvents.test.ts", "content": "Test event handlers"},
        {"operation": "create", "file": "src/app/hooks/__tests__/useCanvasRenderers.test.ts", "content": "Test rendering"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["figjam-1-extract-stage", "figjam-2-extract-events", "figjam-3-extract-renderers"],
      "rollback_procedure": "rm src/app/hooks/__tests__/*.test.ts"
    },
    {
      "task_id": "figjam-6-performance-validation",
      "description": "Validate canvas performance",
      "target_files": [{"path": "src/app/FigJamCanvas.tsx", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["60fps during all operations", "RAF batching active", "No memory leaks"]}
      ],
      "validation_steps": ["Performance profiling", "Test with 1000+ elements"],
      "success_criteria": "60fps maintained, RAF batching works",
      "dependencies": ["figjam-4-refactor-component"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["figjam-1-extract-stage", "figjam-2-extract-events", "figjam-3-extract-renderers", "figjam-4-refactor-component", "figjam-5-add-tests", "figjam-6-performance-validation"],
  "critical_warnings": ["⚠️ Four-layer pipeline: background/main/preview/overlay must be preserved", "⚠️ RAF batching critical for 60fps", "⚠️ Event handler ordering important", "⚠️ Stage cleanup must happen correctly"]
}
```

---

## 📋 Validation Checklist

- [ ] Stage initializes correctly
- [ ] 4-layer pipeline preserved
- [ ] All event handlers work
- [ ] Rendering works (all element types)
- [ ] 60fps maintained
- [ ] RAF batching active
- [ ] Pan/zoom works
- [ ] Undo/redo works

---

## 🎯 Success Metrics

**Before**: 902 lines, monolithic component  
**After**: ~150 line component + 4 hooks (~660 total)  
**Impact**: 83% component reduction, reusable hooks

---

**Establishes pattern for main canvas component refactoring.**
