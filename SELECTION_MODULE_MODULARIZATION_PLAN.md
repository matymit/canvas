# SelectionModule.ts Modularization Plan

**Target**: Break down 1,852-line SelectionModule.ts into focused, maintainable modules  
**Current**: Some modularization done (1,062 lines extracted)  
**Remaining**: 1,852 lines to be systematically refactored  

## Architecture Compliance ✅

This plan follows the CANVAS _MASTER_BLUEPRINT.md requirements:
- ✅ Maintains 4-layer rendering pipeline (Background, Main, Preview, Overlay)
- ✅ Uses vanilla Konva.js directly (no react-konva)
- ✅ Preserves store-driven pattern with Zustand + Immer
- ✅ Maintains RAF batching for performance
- ✅ Uses withUndo for user-initiated state changes
- ✅ Follows single responsibility principle per expert validation

## Expert Validation ✅

**Perplexity Analysis**: Confirmed approach is architecturally sound
- ✅ Single Responsibility Principle for each module
- ✅ Store-driven coordination via Zustand state  
- ✅ Minimal API surface with explicit interfaces
- ✅ Dependency injection pattern
- ✅ No cyclic dependencies

**Exa Code Research**: Found similar modularization patterns in other canvas systems
- ✅ SelectionVisuals class patterns in BPMN designers
- ✅ Modular selection management approaches
- ✅ Event-driven coordination patterns

## Current State Analysis

### Already Extracted (1,062 lines)
- `MarqueeSelectionController.ts` (218 lines) - Marquee selection logic
- `TransformController.ts` (209 lines) - Transform operations
- `SelectionResolver.ts` (204 lines) - Element resolution utilities
- `TransformLifecycleCoordinator.ts` (137 lines) - Transform lifecycle management
- `MindmapController.ts` (28 lines) - Basic mindmap operations
- `types.ts` (49 lines) - Type definitions
- Tests (217 lines) - Unit tests

### Remaining in SelectionModule.ts (1,852 lines)
**42 methods across 5 major functional areas**

---

## 🎯 Proposed Module Extraction Strategy

### Phase 1: Connector Management Module (Estimated ~400-500 lines)
**Target**: Extract all connector-related functionality
**New Module**: `ConnectorSelectionManager.ts`

**Lines to Extract**:
- `scheduleConnectorRefresh()` (~1129-1162)
- `refreshConnectedConnectors()` (~1206-1261) 
- `updateConnectorVisuals()` (~1484-1498)
- `applyConnectorEndpointOverride()` (~1499-1509)
- `updateConnectorShapeGeometry()` (~1510-1554)
- `commitConnectorTranslation()` (~1562-1565)
- `getConnectorAbsolutePoints()` (~1566-1593)
- `findConnectorGroup()` (~1594-1617)
- `computeConnectorPointsFromStore()` (~1618-1692)
- `setLiveRoutingEnabled()` (~1693-1707)
- `getConnectorService()` (~1723-1730)
- `updateConnectorElement()` (~1731-1775)
- `handleConnectorEndpointDrag()` (~1787-1806)

**Dependencies**:
- Import ConnectorService
- Access to stage/layers
- Store context for element updates

### Phase 2: Mindmap Management Module (Estimated ~150-200 lines)
**Target**: Extract mindmap-specific functionality
**New Module**: `MindmapSelectionManager.ts`

**Lines to Extract**:
- `scheduleMindmapReroute()` (~1163-1195)
- `performMindmapReroute()` (~1196-1205)
- `updateMindmapEdgeVisuals()` (~1555-1561)
- `setMindmapLiveRoutingEnabled()` (~1708-1722)
- `getMindmapRenderer()` (~1776-1786)

**Dependencies**:
- Import MindmapRenderer
- Access to batchMindmapReroute utility
- Store context for mindmap operations

### Phase 3: Transform State Manager (Estimated ~300-400 lines)
**Target**: Extract transformation state management
**New Module**: `TransformStateManager.ts`

**Lines to Extract**:
- `beginSelectionTransform()` (~485-508)
- `progressSelectionTransform()` (~509-529)
- `endSelectionTransform()` (~530-574)
- `updateElementsFromNodes()` (~575-759)
- `captureTransformSnapshot()` (~1262-1466)
- `finalizeTransform()` (~1467-1483)
- `shouldLockAspectRatio()` (~993-1046)

**Dependencies**:
- TransformSnapshot types
- Store context for element updates
- withUndo integration

### Phase 4: Shape Text Synchronization Module (Estimated ~40-50 lines)
**Target**: Extract shape text positioning logic
**New Module**: `ShapeTextSynchronizer.ts`

**Lines to Extract**:
- `syncShapeTextDuringTransform()` (~1813-1851)

**Dependencies**:
- Access to global ShapeRenderer
- Store context for element type checking

### Phase 5: Core Selection Orchestrator (Estimated ~600-700 lines remaining)
**Target**: Refactor remaining SelectionModule.ts as orchestrator
**Result**: Lean coordinator that delegates to specialized modules

**Remaining Methods**:
- `mount()` / `unmount()` - Module lifecycle
- `updateSelection()` - Selection coordination
- `selectElementsInBounds()` / `selectElement()` / `clearSelection()` - Public API
- `refreshTransformerForSelection()` - Transformer coordination
- `forceRefresh()` - Manual refresh trigger
- Helper methods (debugLog, getStage, etc.)

---

## 🔄 Implementation Phases

### Phase 1A: ConnectorSelectionManager Creation
1. **Create**: `selection/managers/ConnectorSelectionManager.ts`
2. **Extract**: All connector-related methods (13 methods, ~400-500 lines)
3. **Interface**: 
   ```typescript
   interface ConnectorSelectionManager {
     scheduleRefresh(elementIds: Set<string>): void;
     updateVisuals(delta: { dx: number; dy: number }): void;
     commitTranslation(delta: { dx: number; dy: number }): void;
     setLiveRoutingEnabled(enabled: boolean): void;
     handleEndpointDrag(connectorId: string, endpoint: "from" | "to", position: { x: number; y: number }): void;
   }
   ```

### Phase 1B: MindmapSelectionManager Creation  
1. **Create**: `selection/managers/MindmapSelectionManager.ts`
2. **Extract**: All mindmap-related methods (5 methods, ~150-200 lines)
3. **Interface**:
   ```typescript
   interface MindmapSelectionManager {
     scheduleReroute(nodeIds: Set<string>): void;
     performReroute(nodeIds: Set<string>): void;
     updateEdgeVisuals(delta: { dx: number; dy: number }): void;
     setLiveRoutingEnabled(enabled: boolean): void;
   }
   ```

### Phase 1C: TransformStateManager Creation
1. **Create**: `selection/managers/TransformStateManager.ts`
2. **Extract**: Transform state methods (7 methods, ~300-400 lines)
3. **Interface**:
   ```typescript
   interface TransformStateManager {
     beginTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
     progressTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
     endTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
     captureSnapshot(initialNodes?: Konva.Node[]): TransformSnapshot | null;
     shouldLockAspectRatio(selectedIds: Set<string>): boolean;
   }
   ```

### Phase 1D: ShapeTextSynchronizer Creation
1. **Create**: `selection/managers/ShapeTextSynchronizer.ts`
2. **Extract**: Shape text sync method (1 method, ~40-50 lines)
3. **Interface**:
   ```typescript
   interface ShapeTextSynchronizer {
     syncTextDuringTransform(nodes: Konva.Node[]): void;
   }
   ```

### Phase 2: SelectionModule Refactoring
1. **Refactor**: Main SelectionModule.ts to orchestrator pattern
2. **Inject**: All extracted managers as dependencies
3. **Delegate**: Method calls to appropriate managers
4. **Maintain**: Public API compatibility

---

## 📁 Final Directory Structure

```
selection/
├── controllers/                          # Existing controllers
│   ├── MarqueeSelectionController.ts     # ✅ Already exists (218 lines)
│   ├── TransformController.ts            # ✅ Already exists (209 lines)
│   ├── TransformLifecycleCoordinator.ts  # ✅ Already exists (137 lines)
│   └── MindmapController.ts              # ✅ Already exists (28 lines)
├── managers/                             # 🆕 New specialized managers
│   ├── ConnectorSelectionManager.ts     # 🆕 ~400-500 lines
│   ├── MindmapSelectionManager.ts       # 🆕 ~150-200 lines
│   ├── TransformStateManager.ts         # 🆕 ~300-400 lines
│   └── ShapeTextSynchronizer.ts         # 🆕 ~40-50 lines
├── SelectionResolver.ts                  # ✅ Already exists (204 lines)
├── types.ts                              # ✅ Already exists (49 lines)
└── __tests__/                            # ✅ Existing + new tests
    ├── SelectionResolver.test.ts         # ✅ Already exists
    ├── TransformController.test.ts       # ✅ Already exists
    ├── ConnectorSelectionManager.test.ts # 🆕 New
    ├── MindmapSelectionManager.test.ts   # 🆕 New
    ├── TransformStateManager.test.ts     # 🆕 New
    └── ShapeTextSynchronizer.test.ts     # 🆕 New
```

**Final SelectionModule.ts**: ~500-600 lines (down from 1,852)
**Total Lines Distributed**: ~1,852 lines across focused modules

---

## ⚡ Performance Validation Strategy

### After Each Phase
1. **Run**: `npm run type-check && npm run lint`
2. **Test**: Canvas selection functionality
3. **Verify**: 60fps performance maintained
4. **Check**: RAF batching still functional
5. **Validate**: Undo/redo operations work correctly

### Integration Testing
- Marquee selection with multiple element types
- Transform operations on mixed selections
- Connector endpoint dragging
- Mindmap node rerouting
- Shape text synchronization during resize

---

## 🧪 Risk Mitigation

### Dependency Management
- Use dependency injection for all managers
- Avoid circular imports through careful interface design
- Maintain clear separation of concerns

### State Consistency
- All state updates go through store methods
- Use RAF batching for visual updates
- Maintain transform lifecycle coordination

### Performance Monitoring
- Profile after each extraction phase
- Monitor for memory leaks in Konva event handlers
- Validate transform performance stays within 60fps target

---

## 📝 Documentation Updates Required

### After Completion
1. **Update**: `canvas-implementation-progress.md`
2. **Update**: `CHANGELOG.md` 
3. **Update**: `known-issues.md`
4. **Add**: Architecture documentation for new modules
5. **Create**: Migration guide for developers

---

## ✅ Success Criteria

- [ ] SelectionModule.ts reduced from 1,852 to <600 lines
- [ ] All 42 methods properly categorized and extracted
- [ ] Zero TypeScript compilation errors
- [ ] Zero new ESLint warnings
- [ ] 60fps performance maintained
- [ ] All selection functionality works correctly
- [ ] Undo/redo operations function properly
- [ ] No memory leaks or Konva handler issues
- [ ] Clean, testable module interfaces
- [ ] Comprehensive test coverage for new modules

---

*This plan accounts for all 1,852 lines of SelectionModule.ts and provides a systematic approach to modularization while maintaining Canvas architectural principles and performance targets.*