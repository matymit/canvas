# Core Module Refactoring Plan

**File**: `src/features/canvas/modules/store/coreModule.ts`  
**Current Size**: 1,023 lines  
**Target Size**: ~200 lines  
**Reduction**: 80%  
**Priority**: CRITICAL  
**Estimated Time**: 3-4 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-10:    Imports and dependencies
Lines 11-76:   ElementModuleSlice interface (element CRUD operations) - 65 lines
Lines 77-90:   Comments and type definitions
Lines 91-131:  SelectionModuleSlice interface (selection state) - 40 lines
Lines 132-144: Connector types and interfaces
Lines 145-196: ViewportModuleSlice interface (pan/zoom operations) - 51 lines
Lines 197-271: Additional type definitions and interfaces
Lines 272-1023: Implementation of all operations (MONOLITHIC) - 751 lines
  - Element operations: ~250 lines
  - Selection operations: ~150 lines
  - Viewport operations: ~100 lines
  - Core store setup: ~251 lines
```

### Key Issues
- ❌ Single file handles element CRUD, selection, and viewport logic
- ❌ 751 lines of implementation in one module
- ❌ Difficult to test individual concerns
- ❌ Poor code navigation and IDE performance
- ❌ Hard to understand dependencies between operations

---

## 🎯 Refactoring Strategy

### Extract Four Modules

1. **ElementOperations** (`elementOperations.ts`) - ~280 lines
   - All element CRUD: createElement, updateElement, deleteElement
   - Element queries: getElementById, getElementsByType
   - Layer management for elements

2. **SelectionOperations** (`selectionOperations.ts`) - ~180 lines
   - Selection state: setSelectedIds, selectAll, deselectAll
   - Selection queries: getSelectedElements, isSelected
   - Multi-selection coordination

3. **ViewportOperations** (`viewportOperations.ts`) - ~140 lines
   - Pan/zoom: setViewport, panBy, zoomBy
   - Viewport queries: getVisibleBounds, screenToCanvas
   - Camera transforms

4. **CoreModule** (refactored, `coreModule.ts`) - ~200 lines
   - Store setup and initialization
   - Module composition
   - Public API exports
   - Global state coordination

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "core-1-extract-element-ops",
      "description": "Extract ElementModuleSlice and implementation to elementOperations.ts",
      "target_files": [
        {
          "path": "src/features/canvas/modules/store/coreModule.ts",
          "line_range": "11-76, 272-522"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/store/elementOperations.ts",
          "content": "Extract ElementModuleSlice interface (lines 11-76) and implementation (lines 272-522)",
          "includes": [
            "createElement",
            "updateElement",
            "deleteElement",
            "getElementById",
            "getElementsByType",
            "addLayer",
            "removeLayer",
            "reorderLayers"
          ]
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "line_range": "11-76, 272-522"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "at_line": 10,
          "content": "import { createElementOperations } from './elementOperations';"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- elementOperations.test.ts",
        "Verify element CRUD works in canvas",
        "Check layer panel updates correctly"
      ],
      "success_criteria": "All element operations work identically, type-safe import/export, zero TypeScript errors",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/store/coreModule.ts && rm src/features/canvas/modules/store/elementOperations.ts"
    },
    {
      "task_id": "core-2-extract-selection-ops",
      "description": "Extract SelectionModuleSlice and implementation to selectionOperations.ts",
      "target_files": [
        {
          "path": "src/features/canvas/modules/store/coreModule.ts",
          "line_range": "91-131, 523-673"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/store/selectionOperations.ts",
          "content": "Extract SelectionModuleSlice interface (lines 91-131) and implementation (lines 523-673)",
          "includes": [
            "setSelectedIds",
            "selectAll",
            "deselectAll",
            "toggleSelection",
            "getSelectedElements",
            "isSelected",
            "getSelectionBounds"
          ]
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "line_range": "91-131, 523-673"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "at_line": 10,
          "content": "import { createSelectionOperations } from './selectionOperations';"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- selectionOperations.test.ts",
        "Verify selection works with marquee tool",
        "Check multi-select with shift/cmd key",
        "Validate selection highlighting",
        "Test selection bounds calculation"
      ],
      "success_criteria": "All selection operations work identically, multi-select preserved, selection bounds accurate",
      "dependencies": ["core-1-extract-element-ops"],
      "rollback_procedure": "git checkout src/features/canvas/modules/store/coreModule.ts && rm src/features/canvas/modules/store/selectionOperations.ts"
    },
    {
      "task_id": "core-3-extract-viewport-ops",
      "description": "Extract ViewportModuleSlice and implementation to viewportOperations.ts",
      "target_files": [
        {
          "path": "src/features/canvas/modules/store/coreModule.ts",
          "line_range": "145-196, 674-774"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/store/viewportOperations.ts",
          "content": "Extract ViewportModuleSlice interface (lines 145-196) and implementation (lines 674-774)",
          "includes": [
            "setViewport",
            "panBy",
            "zoomBy",
            "zoomToFit",
            "getVisibleBounds",
            "screenToCanvas",
            "canvasToScreen"
          ]
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "line_range": "145-196, 674-774"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "at_line": 10,
          "content": "import { createViewportOperations } from './viewportOperations';"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- viewportOperations.test.ts",
        "Verify pan tool works (space + drag)",
        "Check zoom with mouse wheel",
        "Test zoom to fit button",
        "Validate coordinate transforms (screen ↔ canvas)"
      ],
      "success_criteria": "All viewport operations work identically, pan/zoom smooth, transforms accurate",
      "dependencies": ["core-1-extract-element-ops"],
      "rollback_procedure": "git checkout src/features/canvas/modules/store/coreModule.ts && rm src/features/canvas/modules/store/viewportOperations.ts"
    },
    {
      "task_id": "core-4-refactor-core-module",
      "description": "Refactor coreModule.ts to compose extracted modules",
      "target_files": [
        {
          "path": "src/features/canvas/modules/store/coreModule.ts",
          "line_range": "1-1023 (entire file)"
        }
      ],
      "code_changes": [
        {
          "operation": "replace",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "find_pattern": "All implementation code (lines 272-1023)",
          "replace_with": "Module composition:\n- Import createElementOperations\n- Import createSelectionOperations\n- Import createViewportOperations\n- Compose store with all three\n- Export unified interface"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/store/coreModule.ts",
          "at_line": "end",
          "content": "export type CoreModuleStore = ElementOperations & SelectionOperations & ViewportOperations;"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- coreModule.test.ts",
        "npm run build",
        "Verify bundle size reduction",
        "Check tree-shaking effectiveness",
        "Full integration test suite"
      ],
      "success_criteria": "Core module imports all operations, type-safe composition, all features work, bundle size reduced",
      "dependencies": ["core-1-extract-element-ops", "core-2-extract-selection-ops", "core-3-extract-viewport-ops"],
      "rollback_procedure": "git checkout src/features/canvas/modules/store/coreModule.ts && git checkout src/features/canvas/modules/store/elementOperations.ts && git checkout src/features/canvas/modules/store/selectionOperations.ts && git checkout src/features/canvas/modules/store/viewportOperations.ts"
    },
    {
      "task_id": "core-5-update-imports",
      "description": "Update all imports across codebase to use new module structure",
      "target_files": [
        {
          "path": "src/**/*.{ts,tsx}",
          "pattern": "import.*from.*coreModule"
        }
      ],
      "code_changes": [
        {
          "operation": "find-replace",
          "pattern": "import { createElement, updateElement } from './coreModule'",
          "replace": "import { createElement, updateElement } from './elementOperations'",
          "scope": "workspace"
        },
        {
          "operation": "find-replace",
          "pattern": "import { setSelectedIds, selectAll } from './coreModule'",
          "replace": "import { setSelectedIds, selectAll } from './selectionOperations'",
          "scope": "workspace"
        },
        {
          "operation": "find-replace",
          "pattern": "import { setViewport, panBy } from './coreModule'",
          "replace": "import { setViewport, panBy } from './viewportOperations'",
          "scope": "workspace"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test",
        "grep -r 'from.*coreModule' src/ (should be minimal)",
        "Verify no broken imports",
        "Check IDE autocomplete works"
      ],
      "success_criteria": "All imports updated, type-safe, zero TypeScript errors, all tests pass",
      "dependencies": ["core-4-refactor-core-module"],
      "rollback_procedure": "git checkout src/"
    },
    {
      "task_id": "core-6-add-tests",
      "description": "Create comprehensive test suites for extracted modules",
      "target_files": [
        {
          "path": "src/features/canvas/modules/store/__tests__/elementOperations.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/modules/store/__tests__/selectionOperations.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/modules/store/__tests__/viewportOperations.test.ts",
          "status": "create"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/store/__tests__/elementOperations.test.ts",
          "content": "Test cases:\n- createElement() with all element types\n- updateElement() with partial updates\n- deleteElement() with layer cleanup\n- getElementById() returns correct element\n- getElementsByType() filters correctly\n- Layer operations (add, remove, reorder)"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/modules/store/__tests__/selectionOperations.test.ts",
          "content": "Test cases:\n- setSelectedIds() updates state\n- selectAll() selects all elements\n- deselectAll() clears selection\n- toggleSelection() with shift key\n- getSelectedElements() returns correct elements\n- isSelected() checks individual elements\n- getSelectionBounds() calculates correctly"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/modules/store/__tests__/viewportOperations.test.ts",
          "content": "Test cases:\n- setViewport() updates position/scale\n- panBy() moves viewport correctly\n- zoomBy() scales viewport\n- zoomToFit() fits all elements\n- getVisibleBounds() calculates correctly\n- screenToCanvas() transforms coordinates\n- canvasToScreen() inverse transform"
        }
      ],
      "validation_steps": [
        "npm test -- elementOperations.test.ts",
        "npm test -- selectionOperations.test.ts",
        "npm test -- viewportOperations.test.ts",
        "Check coverage: >80% for each module",
        "Verify edge cases tested"
      ],
      "success_criteria": "All tests pass, >80% coverage, edge cases covered",
      "dependencies": ["core-1-extract-element-ops", "core-2-extract-selection-ops", "core-3-extract-viewport-ops"],
      "rollback_procedure": "rm src/features/canvas/modules/store/__tests__/elementOperations.test.ts && rm src/features/canvas/modules/store/__tests__/selectionOperations.test.ts && rm src/features/canvas/modules/store/__tests__/viewportOperations.test.ts"
    },
    {
      "task_id": "core-7-performance-validation",
      "description": "Validate 60fps performance and bundle size improvements",
      "target_files": [
        {
          "path": "src/features/canvas/modules/store/coreModule.ts",
          "validation": "performance"
        }
      ],
      "code_changes": [
        {
          "operation": "validate",
          "metrics": [
            "Frame rate: 60fps during pan/zoom",
            "Element creation: <16ms",
            "Selection update: <5ms",
            "Viewport transform: <5ms",
            "Bundle size: 15-20% reduction",
            "Tree-shaking: Unused code eliminated"
          ]
        }
      ],
      "validation_steps": [
        "npm run build",
        "Check bundle analyzer for size reduction",
        "Performance profiling: Chrome DevTools",
        "Measure frame rate during operations",
        "Test with 1000+ elements on canvas",
        "Verify RAF batching still active"
      ],
      "success_criteria": "60fps maintained, bundle size reduced, no performance regressions",
      "dependencies": ["core-4-refactor-core-module", "core-5-update-imports"],
      "rollback_procedure": "N/A (validation only)"
    }
  ],
  "execution_order": [
    "core-1-extract-element-ops",
    "core-2-extract-selection-ops",
    "core-3-extract-viewport-ops",
    "core-4-refactor-core-module",
    "core-5-update-imports",
    "core-6-add-tests",
    "core-7-performance-validation"
  ],
  "critical_warnings": [
    "⚠️ Global state: window.selectionModule may need updates",
    "⚠️ Ensure all withUndo wrappers preserved",
    "⚠️ Immer patterns must be maintained in new modules",
    "⚠️ Store subscriptions: verify all subscribers still work",
    "⚠️ Undo/redo: test thoroughly after extraction",
    "⚠️ Do not break existing imports until all modules extracted"
  ]
}
```

---

## 📋 Validation Checklist

### Functional Tests
- [ ] Element creation (all types: rectangle, circle, sticky note, etc.)
- [ ] Element updates (position, size, style, text)
- [ ] Element deletion (single and batch)
- [ ] Element queries (by ID, by type, all elements)
- [ ] Layer operations (add, remove, reorder, visibility)
- [ ] Selection (single, multi, all, deselect)
- [ ] Selection bounds calculation
- [ ] Viewport pan (mouse drag, space+drag, touch)
- [ ] Viewport zoom (mouse wheel, pinch, zoom buttons)
- [ ] Viewport fit (zoom to fit all elements)
- [ ] Coordinate transforms (screen ↔ canvas)

### Performance Tests
- [ ] 60fps during pan operations
- [ ] 60fps during zoom operations
- [ ] Element creation <16ms
- [ ] Selection update <5ms
- [ ] RAF batching active
- [ ] No memory leaks (Chrome DevTools)

### Quality Tests
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 new warnings
- [ ] Test coverage: >80% per module
- [ ] Bundle size: 15-20% reduction
- [ ] Tree-shaking: Unused code removed
- [ ] Documentation updated

---

## 🎯 Success Metrics

**Before Refactoring:**
- File size: 1,023 lines
- Single module handles all operations
- Hard to test individual concerns
- Poor code navigation

**After Refactoring:**
- File size: ~200 lines (core module)
- 4 focused modules (~800 total lines, but better organized)
- Each module testable independently
- Clear separation of concerns
- Better tree-shaking and code splitting

**Overall Impact:**
- 80% reduction in core module size
- 4 focused, testable modules
- Improved maintainability
- Better IDE performance
- Foundation for remaining refactorings

---

## 🚀 Next Steps After Completion

1. Use pattern for TableModule.ts refactoring
2. Apply to MarqueeSelectionTool.tsx hook extraction
3. Document pattern in CANVAS_MASTER_BLUEPRINT.md
4. Update architectural documentation

---

**This refactoring establishes the pattern for all subsequent large file refactorings and provides immediate maintainability improvements.**
