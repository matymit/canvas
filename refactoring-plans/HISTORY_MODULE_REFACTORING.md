# History Module Refactoring Plan

**File**: `src/features/canvas/modules/history/historyModule.ts`  
**Current Size**: 861 lines  
**Target Size**: ~400 lines  
**Reduction**: 53%  
**Priority**: MEDIUM  
**Estimated Time**: 2-3 days

---

## 📊 Current Structure Analysis

```
Lines 1-150:   Type definitions and interfaces - 149 lines
Lines 151-350: Utility functions - 199 lines
Lines 351-650: History implementation - 299 lines
Lines 651-861: Memory management - 210 lines
```

---

## 🎯 Refactoring Strategy

1. **HistoryTypes** (`history/types.ts`) - ~150 lines
2. **HistoryUtils** (`history/utils.ts`) - ~200 lines
3. **HistoryMemoryManager** (`history/memoryManager.ts`) - ~220 lines
4. **historyModule** (refactored) - ~400 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "history-1-extract-types",
      "description": "Extract type definitions to types.ts",
      "target_files": [{"path": "src/features/canvas/modules/history/historyModule.ts", "line_range": "1-150"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/history/types.ts", "content": "Extract types:\n- HistoryEntry\n- HistoryState\n- UndoableAction\n- RedoableAction"}
      ],
      "validation_steps": ["npm run type-check"],
      "success_criteria": "Types extracted, imports work",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/history/historyModule.ts && rm src/features/canvas/modules/history/types.ts"
    },
    {
      "task_id": "history-2-extract-utils",
      "description": "Extract utility functions to utils.ts",
      "target_files": [{"path": "src/features/canvas/modules/history/historyModule.ts", "line_range": "151-350"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/history/utils.ts", "content": "Extract utils:\n- createHistoryEntry()\n- serializeState()\n- deserializeState()\n- calculateStateDiff()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- historyUtils.test.ts"],
      "success_criteria": "Utils work identically, all functions pure",
      "dependencies": ["history-1-extract-types"],
      "rollback_procedure": "git checkout src/features/canvas/modules/history/historyModule.ts && rm src/features/canvas/modules/history/utils.ts"
    },
    {
      "task_id": "history-3-extract-memory",
      "description": "Extract memory management to memoryManager.ts",
      "target_files": [{"path": "src/features/canvas/modules/history/historyModule.ts", "line_range": "651-861"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/history/memoryManager.ts", "content": "Extract memory manager:\n- pruneHistory()\n- compressEntries()\n- calculateMemoryUsage()\n- enforceHistoryLimit()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- memoryManager.test.ts"],
      "success_criteria": "Memory management works, limits enforced",
      "dependencies": ["history-1-extract-types"],
      "rollback_procedure": "git checkout src/features/canvas/modules/history/historyModule.ts && rm src/features/canvas/modules/history/memoryManager.ts"
    },
    {
      "task_id": "history-4-refactor-module",
      "description": "Refactor historyModule to use extracted components",
      "target_files": [{"path": "src/features/canvas/modules/history/historyModule.ts", "line_range": "1-861"}],
      "code_changes": [
        {"operation": "replace", "find_pattern": "All implementation", "replace_with": "Compose: types, utils, memoryManager"}
      ],
      "validation_steps": ["npm run type-check", "npm test", "npm run build"],
      "success_criteria": "Undo/redo works identically, memory limits enforced",
      "dependencies": ["history-1-extract-types", "history-2-extract-utils", "history-3-extract-memory"],
      "rollback_procedure": "git checkout src/features/canvas/modules/history/"
    },
    {
      "task_id": "history-5-add-tests",
      "description": "Create test suites",
      "target_files": [
        {"path": "src/features/canvas/modules/history/__tests__/utils.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/history/__tests__/memoryManager.test.ts", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/history/__tests__/utils.test.ts", "content": "Test utils"},
        {"operation": "create", "file": "src/features/canvas/modules/history/__tests__/memoryManager.test.ts", "content": "Test memory"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["history-2-extract-utils", "history-3-extract-memory"],
      "rollback_procedure": "rm src/features/canvas/modules/history/__tests__/*.test.ts"
    },
    {
      "task_id": "history-6-validation",
      "description": "Validate history performance",
      "target_files": [{"path": "src/features/canvas/modules/history/historyModule.ts", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["Undo <10ms", "Redo <10ms", "Memory limit enforced"]}
      ],
      "validation_steps": ["Performance profiling", "Test large history stack"],
      "success_criteria": "Fast undo/redo, memory managed",
      "dependencies": ["history-4-refactor-module"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["history-1-extract-types", "history-2-extract-utils", "history-3-extract-memory", "history-4-refactor-module", "history-5-add-tests", "history-6-validation"],
  "critical_warnings": ["⚠️ Undo/redo must work identically", "⚠️ Memory limits critical (prevent leaks)", "⚠️ State serialization must be accurate"]
}
```

---

## 🎯 Success Metrics

**Before**: 861 lines, all in one module  
**After**: ~400 line core + 3 modules (~570 total)  
**Impact**: 53% core reduction, better organization

---
