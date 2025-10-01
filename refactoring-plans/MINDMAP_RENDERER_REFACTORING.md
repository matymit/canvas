# Mindmap Renderer Refactoring Plan

**File**: `src/features/canvas/modules/mindmap/MindmapRenderer.ts`  
**Current Size**: 925 lines  
**Target Size**: ~150 lines  
**Reduction**: 84%  
**Priority**: HIGH  
**Estimated Time**: 4-5 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-50:    Imports and setup
Lines 51-250:  Node rendering logic - 199 lines
Lines 251-450: Edge rendering logic - 199 lines
Lines 451-650: Event handlers - 199 lines
Lines 651-850: Layout engine - 199 lines
Lines 851-925: Utility methods - 74 lines
```

### Key Issues
- ❌ 925 lines in single renderer
- ❌ Node/edge rendering, events, layout all mixed
- ❌ Hard to test individual mindmap features
- ❌ Poor performance with large mindmaps

---

## 🎯 Refactoring Strategy

### Extract Five Modules

1. **MindmapNodeRenderer** (`mindmap/MindmapNodeRenderer.ts`) - ~220 lines
2. **MindmapEdgeRenderer** (`mindmap/MindmapEdgeRenderer.ts`) - ~220 lines
3. **MindmapEventHandlers** (`mindmap/MindmapEventHandlers.ts`) - ~220 lines
4. **MindmapLayoutEngine** (`mindmap/MindmapLayoutEngine.ts`) - ~220 lines
5. **MindmapRenderer** (refactored) - ~150 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "mindmap-1-extract-node-renderer",
      "description": "Extract node rendering to MindmapNodeRenderer.ts",
      "target_files": [{"path": "src/features/canvas/modules/mindmap/MindmapRenderer.ts", "line_range": "51-250"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/mindmap/MindmapNodeRenderer.ts",
          "content": "Extract node rendering:\n- renderNode()\n- renderNodeShape()\n- renderNodeText()\n- renderNodeIcon()\n- updateNodeVisuals()\n- batchDraw() [RAF]"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- MindmapNodeRenderer.test.ts", "Verify nodes render"],
      "success_criteria": "Nodes render identically, 60fps maintained",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/mindmap/MindmapRenderer.ts && rm src/features/canvas/modules/mindmap/MindmapNodeRenderer.ts"
    },
    {
      "task_id": "mindmap-2-extract-edge-renderer",
      "description": "Extract edge rendering to MindmapEdgeRenderer.ts",
      "target_files": [{"path": "src/features/canvas/modules/mindmap/MindmapRenderer.ts", "line_range": "251-450"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/mindmap/MindmapEdgeRenderer.ts",
          "content": "Extract edge rendering:\n- renderEdge()\n- renderEdgePath()\n- renderEdgeArrow()\n- updateEdgeVisuals()\n- batchDraw() [RAF]"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- MindmapEdgeRenderer.test.ts", "Verify edges render"],
      "success_criteria": "Edges render identically, curved paths correct",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/mindmap/MindmapRenderer.ts && rm src/features/canvas/modules/mindmap/MindmapEdgeRenderer.ts"
    },
    {
      "task_id": "mindmap-3-extract-event-handlers",
      "description": "Extract event handlers to MindmapEventHandlers.ts",
      "target_files": [{"path": "src/features/canvas/modules/mindmap/MindmapRenderer.ts", "line_range": "451-650"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/mindmap/MindmapEventHandlers.ts",
          "content": "Extract event handlers:\n- handleNodeClick()\n- handleNodeDrag()\n- handleEdgeClick()\n- handleNodeExpand()\n- handleNodeCollapse()\n- handleNodeAdd()"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- MindmapEventHandlers.test.ts", "Verify interactions"],
      "success_criteria": "All interactions work, expand/collapse preserved",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/mindmap/MindmapRenderer.ts && rm src/features/canvas/modules/mindmap/MindmapEventHandlers.ts"
    },
    {
      "task_id": "mindmap-4-extract-layout-engine",
      "description": "Extract layout engine to MindmapLayoutEngine.ts",
      "target_files": [{"path": "src/features/canvas/modules/mindmap/MindmapRenderer.ts", "line_range": "651-850"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/mindmap/MindmapLayoutEngine.ts",
          "content": "Extract layout engine:\n- calculateLayout()\n- positionNodes()\n- calculateNodePosition()\n- handleAutoLayout()\n- applyLayoutAnimation()"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- MindmapLayoutEngine.test.ts", "Verify layout"],
      "success_criteria": "Auto-layout works, node positioning correct",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/mindmap/MindmapRenderer.ts && rm src/features/canvas/modules/mindmap/MindmapLayoutEngine.ts"
    },
    {
      "task_id": "mindmap-5-refactor-renderer",
      "description": "Refactor MindmapRenderer to coordinate subsystems",
      "target_files": [{"path": "src/features/canvas/modules/mindmap/MindmapRenderer.ts", "line_range": "1-925"}],
      "code_changes": [
        {
          "operation": "replace",
          "find_pattern": "All implementation (lines 51-925)",
          "replace_with": "Compose: NodeRenderer, EdgeRenderer, EventHandlers, LayoutEngine"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test", "npm run build"],
      "success_criteria": "Renderer coordinates subsystems, all features work",
      "dependencies": ["mindmap-1-extract-node-renderer", "mindmap-2-extract-edge-renderer", "mindmap-3-extract-event-handlers", "mindmap-4-extract-layout-engine"],
      "rollback_procedure": "git checkout src/features/canvas/modules/mindmap/"
    },
    {
      "task_id": "mindmap-6-add-tests",
      "description": "Create test suites for subsystems",
      "target_files": [
        {"path": "src/features/canvas/modules/mindmap/__tests__/MindmapNodeRenderer.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/mindmap/__tests__/MindmapEdgeRenderer.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/mindmap/__tests__/MindmapEventHandlers.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/mindmap/__tests__/MindmapLayoutEngine.test.ts", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/mindmap/__tests__/MindmapNodeRenderer.test.ts", "content": "Test node rendering"},
        {"operation": "create", "file": "src/features/canvas/modules/mindmap/__tests__/MindmapEdgeRenderer.test.ts", "content": "Test edge rendering"},
        {"operation": "create", "file": "src/features/canvas/modules/mindmap/__tests__/MindmapEventHandlers.test.ts", "content": "Test event handling"},
        {"operation": "create", "file": "src/features/canvas/modules/mindmap/__tests__/MindmapLayoutEngine.test.ts", "content": "Test layout engine"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["mindmap-1-extract-node-renderer", "mindmap-2-extract-edge-renderer", "mindmap-3-extract-event-handlers", "mindmap-4-extract-layout-engine"],
      "rollback_procedure": "rm src/features/canvas/modules/mindmap/__tests__/*.test.ts"
    },
    {
      "task_id": "mindmap-7-performance-validation",
      "description": "Validate mindmap performance",
      "target_files": [{"path": "src/features/canvas/modules/mindmap/MindmapRenderer.ts", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["60fps with 100+ nodes", "Layout calculation <100ms", "RAF batching active"]}
      ],
      "validation_steps": ["Performance profiling", "Test large mindmaps"],
      "success_criteria": "60fps maintained, fast layout",
      "dependencies": ["mindmap-5-refactor-renderer"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["mindmap-1-extract-node-renderer", "mindmap-2-extract-edge-renderer", "mindmap-3-extract-event-handlers", "mindmap-4-extract-layout-engine", "mindmap-5-refactor-renderer", "mindmap-6-add-tests", "mindmap-7-performance-validation"],
  "critical_warnings": ["⚠️ Auto-layout algorithm must be preserved", "⚠️ Edge curve calculations critical", "⚠️ Expand/collapse animation timing", "⚠️ RAF batching for performance"]
}
```

---

## 📋 Validation Checklist

- [ ] Node rendering (all types)
- [ ] Edge rendering (curved paths)
- [ ] Auto-layout works
- [ ] Node expand/collapse
- [ ] Node drag repositioning
- [ ] Edge click detection
- [ ] 60fps with 100+ nodes
- [ ] Layout animation smooth
- [ ] Undo/redo works

---

## 🎯 Success Metrics

**Before**: 925 lines, all in one renderer  
**After**: ~150 line core + 5 focused modules (~880 total)  
**Impact**: 84% core reduction, better performance

---

**Establishes pattern for complex graph/tree renderer refactoring.**
