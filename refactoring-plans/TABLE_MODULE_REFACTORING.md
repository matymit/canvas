# Table Module Refactoring Plan

**File**: `src/features/canvas/modules/table/TableModule.ts`  
**Current Size**: 996 lines  
**Target Size**: ~250 lines  
**Reduction**: 75%  
**Priority**: CRITICAL  
**Estimated Time**: 4-5 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-40:    Imports and type definitions
Lines 41-140:  TableModule class setup and initialization
Lines 141-180: Cell resolution logic (coordinate calculations) - 39 lines
Lines 181-450: Core rendering logic (MASSIVE) - 269 lines
  - Cell rendering
  - Header rendering
  - Border rendering
  - Resize handles
Lines 451-650: Event handlers (MASSIVE) - 199 lines
  - Click handlers
  - Drag handlers
  - Resize handlers
  - Context menu handlers
Lines 651-850: Utility methods and helpers - 199 lines
Lines 851-996: Cell editor integration - 145 lines
  - Editor positioning
  - Editor lifecycle
  - Text input handling
```

### Key Issues
- ❌ 996 lines in single module
- ❌ Rendering, events, and editing all mixed together
- ❌ Cell resolution logic buried in implementation
- ❌ Hard to test individual table features
- ❌ Poor separation of concerns

---

## 🎯 Refactoring Strategy

### Extract Five Modules

1. **TableCellResolver** (`table/TableCellResolver.ts`) - ~100 lines
   - Cell coordinate calculations
   - Hit testing (point → cell mapping)
   - Cell bounds calculations

2. **TableEventHandlers** (`table/TableEventHandlers.ts`) - ~220 lines
   - Click/double-click handlers
   - Drag handlers (cells, rows, columns)
   - Resize handlers
   - Context menu logic

3. **TableEditorManager** (`table/TableEditorManager.ts`) - ~160 lines
   - Cell editor lifecycle
   - Editor positioning
   - Text input handling
   - Editor cleanup

4. **TableRenderingEngine** (`table/TableRenderingEngine.ts`) - ~290 lines
   - Cell rendering
   - Header rendering (row/column)
   - Border and grid rendering
   - Resize handle rendering

5. **TableModule** (refactored) - ~250 lines
   - Module initialization
   - Coordination between subsystems
   - Public API
   - State management

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "table-1-extract-cell-resolver",
      "description": "Extract cell resolution logic to TableCellResolver.ts",
      "target_files": [
        {
          "path": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "141-180"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/TableCellResolver.ts",
          "content": "Extract cell resolution methods:\n- getCellAtPoint(x, y) → { row, col }\n- getCellBounds(row, col) → { x, y, width, height }\n- getRowHeight(row) → number\n- getColumnWidth(col) → number\n- getTableBounds() → { x, y, width, height }"
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "141-180"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "at_line": 40,
          "content": "import { TableCellResolver } from './TableCellResolver';\nprivate cellResolver: TableCellResolver;"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- TableCellResolver.test.ts",
        "Verify cell clicking works correctly",
        "Check drag selection across cells",
        "Validate cell bounds calculations"
      ],
      "success_criteria": "Cell resolution works identically, all coordinate calculations accurate, type-safe",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/table/TableModule.ts && rm src/features/canvas/modules/table/TableCellResolver.ts"
    },
    {
      "task_id": "table-2-extract-event-handlers",
      "description": "Extract event handling logic to TableEventHandlers.ts",
      "target_files": [
        {
          "path": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "451-650"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/TableEventHandlers.ts",
          "content": "Extract event handlers:\n- handleCellClick(event)\n- handleCellDoubleClick(event)\n- handleCellDragStart(event)\n- handleCellDrag(event)\n- handleCellDragEnd(event)\n- handleResizeStart(event)\n- handleResize(event)\n- handleResizeEnd(event)\n- handleContextMenu(event)"
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "451-650"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "at_line": 40,
          "content": "import { TableEventHandlers } from './TableEventHandlers';\nprivate eventHandlers: TableEventHandlers;"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- TableEventHandlers.test.ts",
        "Verify cell click opens editor",
        "Check cell double-click behavior",
        "Test drag to select cells",
        "Validate resize handles work",
        "Check context menu appears",
        "Test row/column resize"
      ],
      "success_criteria": "All event handlers work identically, all interactions preserved, no event handler loss",
      "dependencies": ["table-1-extract-cell-resolver"],
      "rollback_procedure": "git checkout src/features/canvas/modules/table/TableModule.ts && rm src/features/canvas/modules/table/TableEventHandlers.ts"
    },
    {
      "task_id": "table-3-extract-editor-manager",
      "description": "Extract cell editor logic to TableEditorManager.ts",
      "target_files": [
        {
          "path": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "851-996"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/TableEditorManager.ts",
          "content": "Extract cell editor methods:\n- openEditor(row, col)\n- closeEditor()\n- updateEditorPosition()\n- handleEditorInput(text)\n- handleEditorKeyDown(event)\n- syncEditorToCell()\n- cleanupEditor()"
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "851-996"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "at_line": 40,
          "content": "import { TableEditorManager } from './TableEditorManager';\nprivate editorManager: TableEditorManager;"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- TableEditorManager.test.ts",
        "Verify editor opens on double-click",
        "Check editor positioning (viewport aware)",
        "Test editor input updates cell",
        "Validate Enter/Esc key handling",
        "Check editor cleanup on close",
        "Test editor with zoom/pan"
      ],
      "success_criteria": "Cell editor works identically, positioning correct, input/output preserved, cleanup works",
      "dependencies": ["table-1-extract-cell-resolver"],
      "rollback_procedure": "git checkout src/features/canvas/modules/table/TableModule.ts && rm src/features/canvas/modules/table/TableEditorManager.ts"
    },
    {
      "task_id": "table-4-extract-rendering-engine",
      "description": "Extract rendering logic to TableRenderingEngine.ts",
      "target_files": [
        {
          "path": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "181-450"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/TableRenderingEngine.ts",
          "content": "Extract rendering methods:\n- renderTable(layer, tableElement)\n- renderCells(layer, cells)\n- renderHeaders(layer, headers)\n- renderBorders(layer, borders)\n- renderResizeHandles(layer, handles)\n- renderSelection(layer, selectedCells)\n- updateCellVisuals(cell)\n- batchDraw(layer) [RAF batching]"
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "181-450"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "at_line": 40,
          "content": "import { TableRenderingEngine } from './TableRenderingEngine';\nprivate renderingEngine: TableRenderingEngine;"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- TableRenderingEngine.test.ts",
        "Verify table renders correctly",
        "Check cell content displays",
        "Validate header rendering",
        "Test border and grid lines",
        "Check resize handles visible",
        "Validate selection highlighting",
        "Measure rendering performance (60fps)",
        "Verify RAF batching active"
      ],
      "success_criteria": "Table renders identically, 60fps maintained, RAF batching preserved, all visuals correct",
      "dependencies": ["table-1-extract-cell-resolver"],
      "rollback_procedure": "git checkout src/features/canvas/modules/table/TableModule.ts && rm src/features/canvas/modules/table/TableRenderingEngine.ts"
    },
    {
      "task_id": "table-5-refactor-table-module",
      "description": "Refactor TableModule.ts to coordinate extracted subsystems",
      "target_files": [
        {
          "path": "src/features/canvas/modules/table/TableModule.ts",
          "line_range": "1-996 (entire file)"
        }
      ],
      "code_changes": [
        {
          "operation": "replace",
          "file": "src/features/canvas/modules/table/TableModule.ts",
          "find_pattern": "All implementation code (lines 141-996)",
          "replace_with": "Module coordination:\n- Initialize TableCellResolver\n- Initialize TableEventHandlers\n- Initialize TableEditorManager\n- Initialize TableRenderingEngine\n- Wire up subsystems\n- Expose public API\n- Manage lifecycle"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- TableModule.test.ts",
        "npm run build",
        "Full integration testing",
        "Check bundle size reduction",
        "Verify all table features work"
      ],
      "success_criteria": "Table module coordinates subsystems, all features work, type-safe composition, bundle size reduced",
      "dependencies": ["table-1-extract-cell-resolver", "table-2-extract-event-handlers", "table-3-extract-editor-manager", "table-4-extract-rendering-engine"],
      "rollback_procedure": "git checkout src/features/canvas/modules/table/TableModule.ts && git checkout src/features/canvas/modules/table/"
    },
    {
      "task_id": "table-6-update-imports",
      "description": "Update imports across codebase for new table structure",
      "target_files": [
        {
          "path": "src/**/*.{ts,tsx}",
          "pattern": "import.*TableModule"
        }
      ],
      "code_changes": [
        {
          "operation": "validate",
          "scope": "workspace",
          "action": "Ensure all imports of TableModule still work with refactored structure"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test",
        "grep -r 'TableModule' src/ (verify imports)",
        "Check IDE autocomplete",
        "Verify no broken imports"
      ],
      "success_criteria": "All imports work, type-safe, zero errors, all tests pass",
      "dependencies": ["table-5-refactor-table-module"],
      "rollback_procedure": "git checkout src/"
    },
    {
      "task_id": "table-7-add-tests",
      "description": "Create comprehensive test suites for table subsystems",
      "target_files": [
        {
          "path": "src/features/canvas/modules/table/__tests__/TableCellResolver.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/modules/table/__tests__/TableEventHandlers.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/modules/table/__tests__/TableEditorManager.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/modules/table/__tests__/TableRenderingEngine.test.ts",
          "status": "create"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/__tests__/TableCellResolver.test.ts",
          "content": "Test cases:\n- getCellAtPoint() with various coordinates\n- getCellBounds() for all cells\n- getRowHeight() with different row indices\n- getColumnWidth() with different column indices\n- Edge cases: negative coords, out of bounds"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/__tests__/TableEventHandlers.test.ts",
          "content": "Test cases:\n- Cell click opens editor\n- Cell double-click behavior\n- Drag to select cells\n- Resize handle dragging\n- Context menu opening\n- Row/column resize\n- Event propagation"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/__tests__/TableEditorManager.test.ts",
          "content": "Test cases:\n- openEditor() creates editor\n- closeEditor() cleans up\n- updateEditorPosition() with viewport changes\n- handleEditorInput() updates cell\n- handleEditorKeyDown() (Enter, Esc)\n- syncEditorToCell() syncs state\n- cleanupEditor() removes DOM"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/modules/table/__tests__/TableRenderingEngine.test.ts",
          "content": "Test cases:\n- renderTable() creates all shapes\n- renderCells() renders cell content\n- renderHeaders() renders headers\n- renderBorders() draws grid\n- renderResizeHandles() shows handles\n- renderSelection() highlights cells\n- batchDraw() uses RAF\n- Performance: 60fps with 100+ cells"
        }
      ],
      "validation_steps": [
        "npm test -- TableCellResolver.test.ts",
        "npm test -- TableEventHandlers.test.ts",
        "npm test -- TableEditorManager.test.ts",
        "npm test -- TableRenderingEngine.test.ts",
        "Check coverage: >80% for each module",
        "Verify edge cases tested"
      ],
      "success_criteria": "All tests pass, >80% coverage per module, edge cases covered",
      "dependencies": ["table-1-extract-cell-resolver", "table-2-extract-event-handlers", "table-3-extract-editor-manager", "table-4-extract-rendering-engine"],
      "rollback_procedure": "rm src/features/canvas/modules/table/__tests__/*.test.ts"
    },
    {
      "task_id": "table-8-performance-validation",
      "description": "Validate table performance with refactored structure",
      "target_files": [
        {
          "path": "src/features/canvas/modules/table/TableModule.ts",
          "validation": "performance"
        }
      ],
      "code_changes": [
        {
          "operation": "validate",
          "metrics": [
            "Frame rate: 60fps during cell editing",
            "Cell rendering: <16ms per frame",
            "Editor open: <50ms",
            "Resize operation: <5ms per frame",
            "RAF batching: Active",
            "Bundle size: Reduced by 15-20%"
          ]
        }
      ],
      "validation_steps": [
        "npm run build",
        "Bundle analyzer: Check size reduction",
        "Performance profiling: Chrome DevTools",
        "Test with large table (50x50 cells)",
        "Measure cell edit latency",
        "Verify RAF batching with DevTools",
        "Check memory usage (no leaks)"
      ],
      "success_criteria": "60fps maintained, all operations fast, bundle size reduced, no memory leaks",
      "dependencies": ["table-5-refactor-table-module", "table-6-update-imports"],
      "rollback_procedure": "N/A (validation only)"
    }
  ],
  "execution_order": [
    "table-1-extract-cell-resolver",
    "table-2-extract-event-handlers",
    "table-3-extract-editor-manager",
    "table-4-extract-rendering-engine",
    "table-5-refactor-table-module",
    "table-6-update-imports",
    "table-7-add-tests",
    "table-8-performance-validation"
  ],
  "critical_warnings": [
    "⚠️ Cell editor: Ensure positioning works with viewport transforms",
    "⚠️ Event handlers: Preserve all click/drag/resize behaviors",
    "⚠️ RAF batching: Must be preserved in rendering engine",
    "⚠️ Context menu: Verify right-click still works",
    "⚠️ Undo/redo: Test cell edits with undo system",
    "⚠️ Performance: 60fps critical for large tables (50x50+)"
  ]
}
```

---

## 📋 Validation Checklist

### Functional Tests
- [ ] Cell clicking selects cell
- [ ] Cell double-click opens editor
- [ ] Cell editor input updates cell text
- [ ] Enter key closes editor and saves
- [ ] Esc key closes editor and cancels
- [ ] Drag to select multiple cells
- [ ] Context menu on right-click
- [ ] Row resize (drag row border)
- [ ] Column resize (drag column border)
- [ ] Table resize handles
- [ ] Cell content rendering
- [ ] Header rendering (row/column labels)
- [ ] Border and grid rendering
- [ ] Selection highlighting

### Performance Tests
- [ ] 60fps during cell editing
- [ ] 60fps during resize operations
- [ ] Large table (50x50) renders smoothly
- [ ] Cell editor opens <50ms
- [ ] RAF batching active (DevTools verification)
- [ ] No memory leaks (heap profiling)

### Quality Tests
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 new warnings
- [ ] Test coverage: >80% per module
- [ ] Bundle size: 15-20% reduction
- [ ] Tree-shaking effective
- [ ] Documentation updated

---

## 🎯 Success Metrics

**Before Refactoring:**
- File size: 996 lines
- Single module handles all table logic
- Hard to test individual features
- Mixed concerns (rendering, events, editing)

**After Refactoring:**
- Core module: ~250 lines
- 4 focused subsystems (~770 total lines, better organized)
- Each subsystem testable independently
- Clear separation of concerns
- Better code navigation and IDE performance

**Overall Impact:**
- 75% reduction in main module size
- 5 focused, testable modules
- Improved maintainability
- Better performance (tree-shaking, code splitting)

---

## 🚀 Next Steps After Completion

1. Apply pattern to MarqueeSelectionTool.tsx
2. Use rendering engine pattern for other renderers
3. Document table architecture
4. Update CANVAS_MASTER_BLUEPRINT.md

---

**This refactoring makes TableModule.ts maintainable, testable, and performant while establishing the pattern for complex renderer refactorings.**
