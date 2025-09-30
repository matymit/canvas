# Marquee Selection Tool Refactoring Plan

**File**: `src/features/canvas/tools/selection/MarqueeSelectionTool.tsx`  
**Current Size**: 953 lines  
**Target Size**: ~200 lines  
**Reduction**: 79%  
**Priority**: CRITICAL  
**Estimated Time**: 3-4 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-22:    Imports and dependencies
Lines 23-40:   Utility functions (18 lines)
Lines 41-953:  MarqueeSelectionTool component (912 lines)
  - State setup: ~50 lines
  - Event handlers: ~400 lines
    - Mouse down/move/up
    - Selection logic
    - Connector dragging
    - Transform coordination
  - Selection logic: ~150 lines
  - Connector drag logic: ~200 lines
  - Transform logic: ~150 lines
  - Render logic: ~100 lines
```

### Key Issues
- ❌ 912-line React component (massive)
- ❌ Multiple responsibilities mixed together
- ❌ Hard to test individual features
- ❌ Poor code reusability
- ❌ Difficult to understand control flow

---

## 🎯 Refactoring Strategy

### Extract Five Custom Hooks

1. **useMarqueeUtils** (`hooks/useMarqueeUtils.ts`) - ~50 lines
   - Utility functions
   - Helper calculations
   - Common logic

2. **useMarqueeSelection** (`hooks/useMarqueeSelection.ts`) - ~200 lines
   - Selection state management
   - Selection rectangle calculation
   - Element intersection detection
   - Multi-select coordination

3. **useMarqueeDrag** (`hooks/useMarqueeDrag.ts`) - ~200 lines
   - Drag state management
   - Mouse event handling
   - Drag bounds calculation
   - Snap-to-grid logic

4. **useConnectorDrag** (`hooks/useConnectorDrag.ts`) - ~220 lines
   - Connector-specific dragging
   - Port detection
   - Connection logic
   - Visual feedback

5. **MarqueeSelectionTool** (refactored) - ~200 lines
   - Hook composition
   - Main component logic
   - Rendering
   - Lifecycle management

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "marquee-1-extract-utils",
      "description": "Extract utility functions to useMarqueeUtils hook",
      "target_files": [
        {
          "path": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "line_range": "23-40"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/useMarqueeUtils.ts",
          "content": "Extract utility functions:\n- calculateSelectionBounds(start, end)\n- isPointInRect(point, rect)\n- getElementsInBounds(elements, bounds)\n- snapToGrid(point, gridSize)\n- normalizeRect(rect)"
        },
        {
          "operation": "delete",
          "file": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "line_range": "23-40"
        },
        {
          "operation": "insert",
          "file": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "at_line": 22,
          "content": "import { useMarqueeUtils } from './hooks/useMarqueeUtils';"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- useMarqueeUtils.test.ts",
        "Verify utility functions work correctly",
        "Check bounds calculations accurate"
      ],
      "success_criteria": "Utils extracted, type-safe, all calculations work correctly",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/tools/selection/MarqueeSelectionTool.tsx && rm src/features/canvas/tools/selection/hooks/useMarqueeUtils.ts"
    },
    {
      "task_id": "marquee-2-extract-selection",
      "description": "Extract selection logic to useMarqueeSelection hook",
      "target_files": [
        {
          "path": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "line_range": "Selection logic (~200 lines within main component)"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/useMarqueeSelection.ts",
          "content": "Extract selection hook:\n- State: selectionRect, isSelecting\n- Methods:\n  - startSelection(point)\n  - updateSelection(point)\n  - endSelection()\n  - getIntersectingElements()\n  - applySelection(elements, mode: 'set' | 'add' | 'remove')\n  - clearSelection()\n- Return: { selectionRect, isSelecting, startSelection, updateSelection, endSelection }"
        },
        {
          "operation": "replace",
          "file": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "find_pattern": "Selection logic block (~200 lines)",
          "replace_with": "const { selectionRect, isSelecting, startSelection, updateSelection, endSelection } = useMarqueeSelection();"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- useMarqueeSelection.test.ts",
        "Verify marquee selection works",
        "Check multi-select with shift key",
        "Test deselect with cmd+click",
        "Validate selection rectangle rendering"
      ],
      "success_criteria": "Selection hook works identically, all selection modes preserved, type-safe",
      "dependencies": ["marquee-1-extract-utils"],
      "rollback_procedure": "git checkout src/features/canvas/tools/selection/MarqueeSelectionTool.tsx && rm src/features/canvas/tools/selection/hooks/useMarqueeSelection.ts"
    },
    {
      "task_id": "marquee-3-extract-drag",
      "description": "Extract drag logic to useMarqueeDrag hook",
      "target_files": [
        {
          "path": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "line_range": "Drag logic (~200 lines within main component)"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/useMarqueeDrag.ts",
          "content": "Extract drag hook:\n- State: isDragging, dragStart, dragOffset\n- Methods:\n  - startDrag(point, elements)\n  - updateDrag(point)\n  - endDrag()\n  - getDragBounds()\n  - applySnapping(point)\n  - updateElementPositions(offset)\n- Return: { isDragging, startDrag, updateDrag, endDrag }"
        },
        {
          "operation": "replace",
          "file": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "find_pattern": "Drag logic block (~200 lines)",
          "replace_with": "const { isDragging, startDrag, updateDrag, endDrag } = useMarqueeDrag();"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- useMarqueeDrag.test.ts",
        "Verify element dragging works",
        "Check snap-to-grid functionality",
        "Test multi-element drag",
        "Validate drag bounds constraints",
        "Check undo/redo for drag operations"
      ],
      "success_criteria": "Drag hook works identically, snapping preserved, multi-drag works, undo/redo functional",
      "dependencies": ["marquee-1-extract-utils"],
      "rollback_procedure": "git checkout src/features/canvas/tools/selection/MarqueeSelectionTool.tsx && rm src/features/canvas/tools/selection/hooks/useMarqueeDrag.ts"
    },
    {
      "task_id": "marquee-4-extract-connector-drag",
      "description": "Extract connector drag logic to useConnectorDrag hook",
      "target_files": [
        {
          "path": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "line_range": "Connector drag logic (~220 lines within main component)"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/useConnectorDrag.ts",
          "content": "Extract connector drag hook:\n- State: isConnectorDragging, hoveredPort, tempConnector\n- Methods:\n  - startConnectorDrag(connector, endpoint: 'start' | 'end')\n  - updateConnectorDrag(point)\n  - endConnectorDrag()\n  - detectHoveredPort(point) → Port | null\n  - createTempConnector()\n  - updateTempConnector(point)\n  - connectToPort(port)\n  - renderDragFeedback()\n- Return: { isConnectorDragging, startConnectorDrag, updateConnectorDrag, endConnectorDrag }"
        },
        {
          "operation": "replace",
          "file": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "find_pattern": "Connector drag logic block (~220 lines)",
          "replace_with": "const { isConnectorDragging, startConnectorDrag, updateConnectorDrag, endConnectorDrag } = useConnectorDrag();"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- useConnectorDrag.test.ts",
        "Verify connector dragging works",
        "Check port hover detection",
        "Test connector endpoint dragging",
        "Validate connection to ports",
        "Check visual feedback during drag",
        "Test undo/redo for connector changes"
      ],
      "success_criteria": "Connector drag works identically, port detection accurate, visual feedback preserved, undo/redo functional",
      "dependencies": ["marquee-1-extract-utils"],
      "rollback_procedure": "git checkout src/features/canvas/tools/selection/MarqueeSelectionTool.tsx && rm src/features/canvas/tools/selection/hooks/useConnectorDrag.ts"
    },
    {
      "task_id": "marquee-5-refactor-component",
      "description": "Refactor MarqueeSelectionTool to compose extracted hooks",
      "target_files": [
        {
          "path": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "line_range": "1-953 (entire file)"
        }
      ],
      "code_changes": [
        {
          "operation": "replace",
          "file": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "find_pattern": "All hook logic (lines 41-953)",
          "replace_with": "Component composition:\n- Use useMarqueeUtils()\n- Use useMarqueeSelection()\n- Use useMarqueeDrag()\n- Use useConnectorDrag()\n- Coordinate hooks\n- Handle main event flow\n- Render UI"
        }
      ],
      "validation_steps": [
        "npm run type-check",
        "npm test -- MarqueeSelectionTool.test.tsx",
        "npm run build",
        "Full integration testing",
        "Verify all selection modes work",
        "Check all drag operations",
        "Test connector dragging",
        "Validate performance (60fps)"
      ],
      "success_criteria": "Component coordinates hooks correctly, all features work, type-safe, 60fps maintained",
      "dependencies": ["marquee-1-extract-utils", "marquee-2-extract-selection", "marquee-3-extract-drag", "marquee-4-extract-connector-drag"],
      "rollback_procedure": "git checkout src/features/canvas/tools/selection/MarqueeSelectionTool.tsx && git checkout src/features/canvas/tools/selection/hooks/"
    },
    {
      "task_id": "marquee-6-add-tests",
      "description": "Create comprehensive test suites for extracted hooks",
      "target_files": [
        {
          "path": "src/features/canvas/tools/selection/hooks/__tests__/useMarqueeUtils.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/tools/selection/hooks/__tests__/useMarqueeSelection.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/tools/selection/hooks/__tests__/useMarqueeDrag.test.ts",
          "status": "create"
        },
        {
          "path": "src/features/canvas/tools/selection/hooks/__tests__/useConnectorDrag.test.ts",
          "status": "create"
        }
      ],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/__tests__/useMarqueeUtils.test.ts",
          "content": "Test cases:\n- calculateSelectionBounds() with various points\n- isPointInRect() edge cases\n- getElementsInBounds() with different element types\n- snapToGrid() with different grid sizes\n- normalizeRect() handles negative dimensions"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/__tests__/useMarqueeSelection.test.ts",
          "content": "Test cases:\n- startSelection() initializes state\n- updateSelection() updates rectangle\n- endSelection() finalizes selection\n- getIntersectingElements() finds correct elements\n- applySelection() with 'set' | 'add' | 'remove' modes\n- clearSelection() clears state"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/__tests__/useMarqueeDrag.test.ts",
          "content": "Test cases:\n- startDrag() with single element\n- startDrag() with multiple elements\n- updateDrag() updates positions\n- endDrag() commits changes\n- applySnapping() with grid\n- getDragBounds() calculates correctly\n- undo/redo works"
        },
        {
          "operation": "create",
          "file": "src/features/canvas/tools/selection/hooks/__tests__/useConnectorDrag.test.ts",
          "content": "Test cases:\n- startConnectorDrag() with 'start' endpoint\n- startConnectorDrag() with 'end' endpoint\n- updateConnectorDrag() updates temp connector\n- endConnectorDrag() commits connection\n- detectHoveredPort() finds correct port\n- connectToPort() creates connection\n- undo/redo works"
        }
      ],
      "validation_steps": [
        "npm test -- useMarqueeUtils.test.ts",
        "npm test -- useMarqueeSelection.test.ts",
        "npm test -- useMarqueeDrag.test.ts",
        "npm test -- useConnectorDrag.test.ts",
        "Check coverage: >80% for each hook",
        "Verify edge cases tested"
      ],
      "success_criteria": "All tests pass, >80% coverage per hook, edge cases covered",
      "dependencies": ["marquee-1-extract-utils", "marquee-2-extract-selection", "marquee-3-extract-drag", "marquee-4-extract-connector-drag"],
      "rollback_procedure": "rm src/features/canvas/tools/selection/hooks/__tests__/*.test.ts"
    },
    {
      "task_id": "marquee-7-performance-validation",
      "description": "Validate marquee tool performance with refactored hooks",
      "target_files": [
        {
          "path": "src/features/canvas/tools/selection/MarqueeSelectionTool.tsx",
          "validation": "performance"
        }
      ],
      "code_changes": [
        {
          "operation": "validate",
          "metrics": [
            "Frame rate: 60fps during selection",
            "Frame rate: 60fps during drag",
            "Frame rate: 60fps during connector drag",
            "Selection update: <5ms",
            "Drag update: <5ms",
            "Port detection: <5ms",
            "Re-render count: Minimized with React.memo"
          ]
        }
      ],
      "validation_steps": [
        "npm run build",
        "Bundle analyzer: Check size reduction",
        "Performance profiling: React DevTools",
        "Measure frame rate during operations",
        "Test with 100+ elements selected",
        "Verify no unnecessary re-renders",
        "Check memory usage (no leaks)"
      ],
      "success_criteria": "60fps maintained, all operations fast, no unnecessary re-renders, bundle size reduced",
      "dependencies": ["marquee-5-refactor-component"],
      "rollback_procedure": "N/A (validation only)"
    }
  ],
  "execution_order": [
    "marquee-1-extract-utils",
    "marquee-2-extract-selection",
    "marquee-3-extract-drag",
    "marquee-4-extract-connector-drag",
    "marquee-5-refactor-component",
    "marquee-6-add-tests",
    "marquee-7-performance-validation"
  ],
  "critical_warnings": [
    "⚠️ React hooks rules: Ensure all hooks follow Rules of Hooks",
    "⚠️ Event handlers: Preserve all mouse event behaviors",
    "⚠️ State synchronization: Hooks must coordinate correctly",
    "⚠️ Re-render loops: Use React.memo and useMemo appropriately",
    "⚠️ Undo/redo: Test drag/connector operations with undo system",
    "⚠️ Performance: 60fps critical during drag operations"
  ]
}
```

---

## 📋 Validation Checklist

### Functional Tests
- [ ] Marquee selection (drag to select)
- [ ] Multi-select with shift key
- [ ] Deselect with cmd/ctrl+click
- [ ] Element dragging (single)
- [ ] Element dragging (multi-select)
- [ ] Snap-to-grid during drag
- [ ] Connector endpoint dragging
- [ ] Port hover detection
- [ ] Connector connection to port
- [ ] Selection rectangle rendering
- [ ] Drag feedback visuals
- [ ] Undo/redo for all operations

### Performance Tests
- [ ] 60fps during selection
- [ ] 60fps during drag
- [ ] 60fps during connector drag
- [ ] No unnecessary re-renders (React DevTools)
- [ ] Fast port detection (<5ms)
- [ ] Smooth with 100+ elements

### Quality Tests
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 new warnings
- [ ] Test coverage: >80% per hook
- [ ] Bundle size: 15-20% reduction
- [ ] Documentation updated

---

## 🎯 Success Metrics

**Before Refactoring:**
- Component: 953 lines (912-line component)
- All logic in single component
- Hard to test individual features
- Difficult to reuse logic

**After Refactoring:**
- Component: ~200 lines
- 5 focused, reusable hooks (~670 total lines)
- Each hook testable independently
- Clear separation of concerns
- Better code reusability

**Overall Impact:**
- 79% reduction in component size
- 5 reusable custom hooks
- Improved testability
- Better performance (memoization)

---

## 🚀 Next Steps After Completion

1. Apply hook pattern to FigJamCanvas.tsx
2. Reuse hooks in other selection tools
3. Document custom hook patterns
4. Update React architecture guide

---

**This refactoring establishes the custom hook pattern for complex React components and provides reusable selection/drag logic.**
