# SelectionModule.ts Complete Implementation Plan
**Target**: Systematically account for and refactor all 1,852 lines in SelectionModule.ts  
**Status**: Ready for implementation following architectural principles  
**Validation**: Expert-verified approach with Perplexity and Exa analysis  

## 📊 Complete Line-by-Line Analysis

### Current SelectionModule.ts Breakdown (1,852 lines total)

#### **Section 1: Imports & Types (Lines 1-77)**
- **Lines 1-28**: Import statements (external dependencies)
- **Lines 30-58**: Interface definitions (ElementUpdate, ElementChanges, etc.)
- **Lines 59-77**: Class field declarations
- **Action**: Keep in main SelectionModule as core orchestrator needs

#### **Section 2: Module Lifecycle (Lines 78-265)**
- **Lines 78-264**: `mount()` method - module initialization, dependencies setup
- **Lines 266-302**: `unmount()` method - cleanup and resource disposal
- **Action**: Keep in main SelectionModule as orchestrator pattern

#### **Section 3: Selection Management Core (Lines 303-428)**
- **Lines 303-427**: `updateSelection()` method - core selection coordination logic
- **Action**: Keep in main SelectionModule as primary orchestrator responsibility

#### **Section 4: Utility Methods (Lines 429-484)**
- **Lines 429-436**: `debugLog()` - logging utility
- **Lines 437-443**: `clearConnectorSelectionTimer()` - timer management
- **Lines 444-457**: `toStringSet()` - type conversion utility
- **Lines 458-471**: `getStage()` - stage access utility
- **Lines 472-484**: `getRelevantLayers()` - layer access utility
- **Action**: Keep in main SelectionModule - core utilities

#### **Section 5: Transform Lifecycle Management (Lines 485-574)**
- **Lines 485-508**: `beginSelectionTransform()` - transform initialization
- **Lines 509-529**: `progressSelectionTransform()` - transform progress tracking
- **Lines 530-574**: `endSelectionTransform()` - transform finalization
- **Target for Extraction**: → **TransformStateManager.ts** (~90 lines)

#### **Section 6: Element-Node Synchronization (Lines 575-909)**
- **Lines 575-909**: `updateElementsFromNodes()` - massive method for syncing Konva nodes to store
- **Target for Extraction**: → **ElementSynchronizer.ts** (~335 lines)

#### **Section 7: Transformer Management (Lines 910-992)**
- **Lines 910-992**: `refreshTransformerForSelection()` - transformer configuration
- **Action**: Keep in main SelectionModule - core orchestrator responsibility

#### **Section 8: Aspect Ratio Logic (Lines 993-1046)**
- **Lines 993-1046**: `shouldLockAspectRatio()` - aspect ratio determination logic
- **Target for Extraction**: → **TransformStateManager.ts** (~54 lines)

#### **Section 9: Public API (Lines 1047-1128)**
- **Lines 1047-1048**: `forceRefresh()` - public refresh method
- **Lines 1049-1128**: Public selection methods (selectElementsInBounds, selectElement, clearSelection)
- **Action**: Keep in main SelectionModule - public API surface

#### **Section 10: Connector Scheduling (Lines 1129-1162)**
- **Lines 1129-1162**: `scheduleConnectorRefresh()` - RAF-based connector refresh scheduling
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~34 lines)

#### **Section 11: Mindmap Scheduling (Lines 1163-1195)**
- **Lines 1163-1195**: `scheduleMindmapReroute()` - RAF-based mindmap rerouting
- **Target for Extraction**: → **MindmapSelectionManager.ts** (~33 lines)

#### **Section 12: Mindmap Operations (Lines 1196-1205)**
- **Lines 1196-1205**: `performMindmapReroute()` - actual mindmap rerouting logic
- **Target for Extraction**: → **MindmapSelectionManager.ts** (~10 lines)

#### **Section 13: Connector Refresh Implementation (Lines 1206-1261)**
- **Lines 1206-1261**: `refreshConnectedConnectors()` - connector refresh implementation
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~56 lines)

#### **Section 14: Transform Snapshot Capture (Lines 1262-1466)**
- **Lines 1262-1466**: `captureTransformSnapshot()` - comprehensive state snapshot creation
- **Target for Extraction**: → **TransformStateManager.ts** (~205 lines)

#### **Section 15: Transform Finalization (Lines 1467-1483)**
- **Lines 1467-1483**: `finalizeTransform()` - transform completion logic
- **Target for Extraction**: → **TransformStateManager.ts** (~17 lines)

#### **Section 16: Connector Visual Updates (Lines 1484-1498)**
- **Lines 1484-1498**: `updateConnectorVisuals()` - visual connector updates during transform
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~15 lines)

#### **Section 17: Connector Endpoint Override (Lines 1499-1509)**
- **Lines 1499-1509**: `applyConnectorEndpointOverride()` - connector endpoint manipulation
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~11 lines)

#### **Section 18: Connector Geometry Updates (Lines 1510-1554)**
- **Lines 1510-1554**: `updateConnectorShapeGeometry()` - connector shape calculations
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~45 lines)

#### **Section 19: Mindmap Edge Updates (Lines 1555-1561)**
- **Lines 1555-1561**: `updateMindmapEdgeVisuals()` - mindmap edge visual updates
- **Target for Extraction**: → **MindmapSelectionManager.ts** (~7 lines)

#### **Section 20: Connector Translation (Lines 1562-1565)**
- **Lines 1562-1565**: `commitConnectorTranslation()` - connector position commit
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~4 lines)

#### **Section 21: Connector Point Calculation (Lines 1566-1593)**
- **Lines 1566-1593**: `getConnectorAbsolutePoints()` - connector point computation
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~28 lines)

#### **Section 22: Connector Group Finding (Lines 1594-1617)**
- **Lines 1594-1617**: `findConnectorGroup()` - connector group lookup
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~24 lines)

#### **Section 23: Connector Point Computation (Lines 1618-1692)**
- **Lines 1618-1692**: `computeConnectorPointsFromStore()` - complex connector point calculation
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~75 lines)

#### **Section 24: Connector Live Routing (Lines 1693-1707)**
- **Lines 1693-1707**: `setLiveRoutingEnabled()` - connector live routing toggle
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~15 lines)

#### **Section 25: Mindmap Live Routing (Lines 1708-1722)**
- **Lines 1708-1722**: `setMindmapLiveRoutingEnabled()` - mindmap live routing toggle
- **Target for Extraction**: → **MindmapSelectionManager.ts** (~15 lines)

#### **Section 26: Connector Service Access (Lines 1723-1730)**
- **Lines 1723-1730**: `getConnectorService()` - connector service accessor
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~8 lines)

#### **Section 27: Connector Element Updates (Lines 1731-1775)**
- **Lines 1731-1775**: `updateConnectorElement()` - connector element store updates
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~45 lines)

#### **Section 28: Mindmap Renderer Access (Lines 1776-1786)**
- **Lines 1776-1786**: `getMindmapRenderer()` - mindmap renderer accessor
- **Target for Extraction**: → **MindmapSelectionManager.ts** (~11 lines)

#### **Section 29: Connector Endpoint Drag (Lines 1787-1812)**
- **Lines 1787-1812**: `handleConnectorEndpointDrag()` - connector endpoint drag handling
- **Target for Extraction**: → **ConnectorSelectionManager.ts** (~26 lines)

#### **Section 30: Shape Text Sync (Lines 1813-1852)**
- **Lines 1813-1852**: `syncShapeTextDuringTransform()` - shape text synchronization
- **Target for Extraction**: → **ShapeTextSynchronizer.ts** (~40 lines)

---

## 🎯 Extraction Strategy (Line-by-Line Accounting)

### Phase 1A: TransformStateManager.ts (~366 lines total)
**Extract lines:**
- 485-508: `beginSelectionTransform()` (24 lines)
- 509-529: `progressSelectionTransform()` (21 lines) 
- 530-574: `endSelectionTransform()` (45 lines)
- 993-1046: `shouldLockAspectRatio()` (54 lines)
- 1262-1466: `captureTransformSnapshot()` (205 lines)
- 1467-1483: `finalizeTransform()` (17 lines)

### Phase 1B: ElementSynchronizer.ts (~335 lines total)
**Extract lines:**
- 575-909: `updateElementsFromNodes()` (335 lines)

### Phase 1C: ConnectorSelectionManager.ts (~386 lines total)
**Extract lines:**
- 1129-1162: `scheduleConnectorRefresh()` (34 lines)
- 1206-1261: `refreshConnectedConnectors()` (56 lines)
- 1484-1498: `updateConnectorVisuals()` (15 lines)
- 1499-1509: `applyConnectorEndpointOverride()` (11 lines)
- 1510-1554: `updateConnectorShapeGeometry()` (45 lines)
- 1562-1565: `commitConnectorTranslation()` (4 lines)
- 1566-1593: `getConnectorAbsolutePoints()` (28 lines)
- 1594-1617: `findConnectorGroup()` (24 lines)
- 1618-1692: `computeConnectorPointsFromStore()` (75 lines)
- 1693-1707: `setLiveRoutingEnabled()` (15 lines)
- 1723-1730: `getConnectorService()` (8 lines)
- 1731-1775: `updateConnectorElement()` (45 lines)
- 1787-1812: `handleConnectorEndpointDrag()` (26 lines)

### Phase 1D: MindmapSelectionManager.ts (~76 lines total)
**Extract lines:**
- 1163-1195: `scheduleMindmapReroute()` (33 lines)
- 1196-1205: `performMindmapReroute()` (10 lines)
- 1555-1561: `updateMindmapEdgeVisuals()` (7 lines)
- 1708-1722: `setMindmapLiveRoutingEnabled()` (15 lines)
- 1776-1786: `getMindmapRenderer()` (11 lines)

### Phase 1E: ShapeTextSynchronizer.ts (~40 lines total)
**Extract lines:**
- 1813-1852: `syncShapeTextDuringTransform()` (40 lines)

### Remaining in SelectionModule.ts (~649 lines)
**Keep lines:**
- 1-77: Imports, types, class fields (77 lines)
- 78-265: `mount()` method (188 lines)
- 266-302: `unmount()` method (37 lines)
- 303-428: `updateSelection()` method (126 lines)
- 429-484: Utility methods (56 lines)
- 910-992: `refreshTransformerForSelection()` (83 lines)
- 1047-1128: Public API methods (82 lines)

**Total Extracted: 1,203 lines**  
**Remaining: 649 lines**  
**Verification: 1,203 + 649 = 1,852 ✅**

---

## 🏗️ Module Interface Design

### TransformStateManager Interface
```typescript
interface TransformStateManager {
  beginTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
  progressTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
  endTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
  shouldLockAspectRatio(selectedIds: Set<string>): boolean;
  captureSnapshot(initialNodes?: Konva.Node[]): TransformSnapshot | null;
  finalizeTransform(): void;
}
```

### ElementSynchronizer Interface
```typescript
interface ElementSynchronizer {
  updateElementsFromNodes(
    nodes: Konva.Node[],
    source: "drag" | "transform",
    options?: { skipConnectorScheduling?: boolean }
  ): void;
}
```

### ConnectorSelectionManager Interface
```typescript
interface ConnectorSelectionManager {
  scheduleRefresh(elementIds: Set<string>): void;
  refreshConnectedConnectors(elementIds: Set<string>): void;
  updateVisuals(delta: { dx: number; dy: number }): void;
  applyEndpointOverride(id: string, from?: ConnectorEndpoint, to?: ConnectorEndpoint): void;
  updateShapeGeometry(connectorId: string, node: Konva.Node): void;
  commitTranslation(delta: { dx: number; dy: number }): void;
  getAbsolutePoints(id: string): number[] | null;
  setLiveRoutingEnabled(enabled: boolean): void;
  updateElement(id: string, changes: any): void;
  handleEndpointDrag(connectorId: string, endpoint: "from" | "to", position: {x: number; y: number}): void;
}
```

### MindmapSelectionManager Interface
```typescript
interface MindmapSelectionManager {
  scheduleReroute(nodeIds: Set<string>): void;
  performReroute(nodeIds: Set<string>): void;
  updateEdgeVisuals(delta: { dx: number; dy: number }): void;
  setLiveRoutingEnabled(enabled: boolean): void;
  getRenderer(): MindmapRenderer | null;
}
```

### ShapeTextSynchronizer Interface
```typescript
interface ShapeTextSynchronizer {
  syncTextDuringTransform(nodes: Konva.Node[]): void;
}
```

---

## 📁 Final Architecture

```
selection/
├── controllers/                          # ✅ Existing (602 lines)
│   ├── MarqueeSelectionController.ts     # ✅ 218 lines
│   ├── TransformController.ts            # ✅ 209 lines  
│   ├── TransformLifecycleCoordinator.ts  # ✅ 137 lines
│   └── MindmapController.ts              # ✅ 28 lines
├── managers/                             # 🆕 New extraction targets
│   ├── TransformStateManager.ts          # 🆕 366 lines
│   ├── ElementSynchronizer.ts            # 🆕 335 lines
│   ├── ConnectorSelectionManager.ts     # 🆕 386 lines
│   ├── MindmapSelectionManager.ts       # 🆕 76 lines
│   └── ShapeTextSynchronizer.ts         # 🆕 40 lines
├── SelectionResolver.ts                  # ✅ 204 lines
├── types.ts                              # ✅ 49 lines
└── __tests__/                            # ✅ + new tests
```

**Final SelectionModule.ts**: 649 lines (down from 1,852)  
**Total Extracted**: 1,203 lines across 5 focused managers  
**Architectural Compliance**: ✅ All Canvas Blueprint requirements maintained

---

## ⚡ Implementation Phases

### Phase 1: Create Manager Infrastructure
1. Create `selection/managers/` directory
2. Set up base interfaces and dependencies
3. Create stub implementations

### Phase 2: Extract Transform State Management  
1. Extract TransformStateManager.ts (366 lines)
2. Update SelectionModule to use manager
3. Test transform operations

### Phase 3: Extract Element Synchronization
1. Extract ElementSynchronizer.ts (335 lines)  
2. Update SelectionModule to delegate element updates
3. Test element-node synchronization

### Phase 4: Extract Connector Management
1. Extract ConnectorSelectionManager.ts (386 lines)
2. Update SelectionModule to delegate connector operations
3. Test connector selection and dragging

### Phase 5: Extract Mindmap Management
1. Extract MindmapSelectionManager.ts (76 lines)
2. Update SelectionModule to delegate mindmap operations  
3. Test mindmap rerouting

### Phase 6: Extract Shape Text Synchronization
1. Extract ShapeTextSynchronizer.ts (40 lines)
2. Update SelectionModule to delegate text sync
3. Test shape text during transforms

### Phase 7: Final Validation
1. Run complete test suite
2. Validate 60fps performance maintained
3. Verify undo/redo functionality
4. Check RAF batching preserved

---

## ✅ Success Criteria

- [ ] **Line Accounting**: All 1,852 lines accounted for and properly categorized
- [ ] **Size Reduction**: SelectionModule.ts reduced to 649 lines (~65% reduction)
- [ ] **Zero Regressions**: TypeScript compilation passes (0 errors)
- [ ] **Clean Code**: Zero new ESLint warnings
- [ ] **Performance**: 60fps maintained, RAF batching preserved
- [ ] **Functionality**: All selection operations work correctly
- [ ] **Architecture**: Canvas Blueprint compliance maintained
- [ ] **Testing**: Comprehensive test coverage for all new modules

---

*This plan provides complete line-by-line accounting of SelectionModule.ts and systematic extraction strategy while maintaining Canvas architectural principles.*