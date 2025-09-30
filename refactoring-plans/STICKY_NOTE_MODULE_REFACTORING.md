# Sticky Note Module Refactoring Plan

**File**: `src/features/canvas/modules/sticky-note/StickyNoteModule.ts`  
**Current Size**: 929 lines  
**Target Size**: ~250 lines  
**Reduction**: 73%  
**Priority**: HIGH  
**Estimated Time**: 3-4 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-50:    Imports and module setup
Lines 51-150:  Core rendering logic - 99 lines
Lines 151-300: Resize handling - 149 lines
Lines 301-500: Event handlers - 199 lines
Lines 501-700: Text editor integration - 199 lines
Lines 701-929: Utility methods and cleanup - 228 lines
```

### Key Issues
- ❌ 929 lines in single module
- ❌ Rendering, resize, events, and editing all mixed
- ❌ Hard to test individual sticky note features
- ❌ Poor code organization

---

## 🎯 Refactoring Strategy

### Extract Four Modules

1. **StickyResizeHandler** (`sticky-note/StickyResizeHandler.ts`) - ~180 lines
2. **StickyEventHandlers** (`sticky-note/StickyEventHandlers.ts`) - ~220 lines
3. **StickyTextEditor** (`sticky-note/StickyTextEditor.ts`) - ~220 lines
4. **StickyNoteModule** (refactored) - ~250 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "sticky-1-extract-resize",
      "description": "Extract resize handling to StickyResizeHandler.ts",
      "target_files": [{"path": "src/features/canvas/modules/sticky-note/StickyNoteModule.ts", "line_range": "151-300"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/sticky-note/StickyResizeHandler.ts",
          "content": "Extract resize methods:\n- handleResizeStart()\n- handleResize()\n- handleResizeEnd()\n- calculateNewSize()\n- applyMinMaxConstraints()\n- updateStickyDimensions()"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- StickyResizeHandler.test.ts", "Verify sticky resize works"],
      "success_criteria": "Resize works identically, constraints applied, type-safe",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/sticky-note/StickyNoteModule.ts && rm src/features/canvas/modules/sticky-note/StickyResizeHandler.ts"
    },
    {
      "task_id": "sticky-2-extract-events",
      "description": "Extract event handlers to StickyEventHandlers.ts",
      "target_files": [{"path": "src/features/canvas/modules/sticky-note/StickyNoteModule.ts", "line_range": "301-500"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/sticky-note/StickyEventHandlers.ts",
          "content": "Extract event handlers:\n- handleClick()\n- handleDoubleClick()\n- handleDragStart()\n- handleDrag()\n- handleDragEnd()\n- handleColorChange()\n- handleDelete()"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- StickyEventHandlers.test.ts", "Verify all interactions work"],
      "success_criteria": "All events work identically, no handler loss",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/sticky-note/StickyNoteModule.ts && rm src/features/canvas/modules/sticky-note/StickyEventHandlers.ts"
    },
    {
      "task_id": "sticky-3-extract-editor",
      "description": "Extract text editor to StickyTextEditor.ts",
      "target_files": [{"path": "src/features/canvas/modules/sticky-note/StickyNoteModule.ts", "line_range": "501-700"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/sticky-note/StickyTextEditor.ts",
          "content": "Extract text editor:\n- openEditor()\n- closeEditor()\n- updateEditorPosition()\n- handleEditorInput()\n- syncEditorToSticky()\n- cleanupEditor()"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- StickyTextEditor.test.ts", "Verify editor works"],
      "success_criteria": "Editor works identically, positioning correct",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/sticky-note/StickyNoteModule.ts && rm src/features/canvas/modules/sticky-note/StickyTextEditor.ts"
    },
    {
      "task_id": "sticky-4-refactor-module",
      "description": "Refactor StickyNoteModule to compose subsystems",
      "target_files": [{"path": "src/features/canvas/modules/sticky-note/StickyNoteModule.ts", "line_range": "1-929"}],
      "code_changes": [
        {
          "operation": "replace",
          "find_pattern": "All implementation (lines 151-929)",
          "replace_with": "Compose: StickyResizeHandler, StickyEventHandlers, StickyTextEditor"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test", "npm run build"],
      "success_criteria": "Module coordinates subsystems, all features work",
      "dependencies": ["sticky-1-extract-resize", "sticky-2-extract-events", "sticky-3-extract-editor"],
      "rollback_procedure": "git checkout src/features/canvas/modules/sticky-note/"
    },
    {
      "task_id": "sticky-5-add-tests",
      "description": "Create test suites for subsystems",
      "target_files": [
        {"path": "src/features/canvas/modules/sticky-note/__tests__/StickyResizeHandler.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/sticky-note/__tests__/StickyEventHandlers.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/sticky-note/__tests__/StickyTextEditor.test.ts", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/sticky-note/__tests__/StickyResizeHandler.test.ts", "content": "Test resize operations"},
        {"operation": "create", "file": "src/features/canvas/modules/sticky-note/__tests__/StickyEventHandlers.test.ts", "content": "Test event handlers"},
        {"operation": "create", "file": "src/features/canvas/modules/sticky-note/__tests__/StickyTextEditor.test.ts", "content": "Test text editor"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["sticky-1-extract-resize", "sticky-2-extract-events", "sticky-3-extract-editor"],
      "rollback_procedure": "rm src/features/canvas/modules/sticky-note/__tests__/*.test.ts"
    },
    {
      "task_id": "sticky-6-performance-validation",
      "description": "Validate sticky note performance",
      "target_files": [{"path": "src/features/canvas/modules/sticky-note/StickyNoteModule.ts", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["60fps during resize", "Editor open <50ms", "No memory leaks"]}
      ],
      "validation_steps": ["Performance profiling", "Test with 50+ sticky notes"],
      "success_criteria": "60fps maintained, fast operations",
      "dependencies": ["sticky-4-refactor-module"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["sticky-1-extract-resize", "sticky-2-extract-events", "sticky-3-extract-editor", "sticky-4-refactor-module", "sticky-5-add-tests", "sticky-6-performance-validation"],
  "critical_warnings": ["⚠️ Text editor positioning with viewport", "⚠️ Resize constraints must be preserved", "⚠️ Color picker integration", "⚠️ Undo/redo for all operations"]
}
```

---

## 📋 Validation Checklist

- [ ] Sticky note creation
- [ ] Resize operations (all corners/edges)
- [ ] Text editing (double-click)
- [ ] Color changes
- [ ] Drag and drop
- [ ] Delete operations
- [ ] 60fps during resize
- [ ] Editor positioning correct
- [ ] Undo/redo works

---

## 🎯 Success Metrics

**Before**: 929 lines, all in one module  
**After**: ~250 line core + 4 focused modules (~680 total)  
**Impact**: 73% core reduction, better testability

---

**Establishes pattern for note-based element refactoring.**
