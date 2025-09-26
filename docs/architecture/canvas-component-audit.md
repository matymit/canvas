# CANVAS COMPONENT AUDIT - Phase 1 Task 1.1

**Date**: 2024-09-18
**Phase**: PHASE 1 - IMMEDIATE ARCHITECTURE FIXES
**Task**: 1.1 - Audit Canvas Component Conflicts

## EXECUTIVE SUMMARY

**CRITICAL ISSUE IDENTIFIED**: Multiple components are creating Konva.Stage instances and calling setupRenderer(), causing store-renderer disconnection and architectural conflicts.

**RECOMMENDED ACTION**: Consolidate to **FigJamCanvas.tsx** as the single canvas implementation.

---

## COMPONENT ANALYSIS

### 1. `src/app/pages/Canvas.tsx` ❌ PROBLEMATIC
**Status**: ACTIVE ENTRY POINT - Currently used by routing
**Issues**:
- Creates Konva.Stage indirectly via NonReactCanvasStage (line 659)
- Calls setupRenderer() directly (line 149)
- 782 lines of complex setup logic that duplicates FigJamCanvas functionality
- Manages layers manually through NonReactCanvasStage
- Instantiates multiple renderer classes directly (TableRenderer, MindmapRenderer)
- Has extensive cleanup and lifecycle management

**Architecture Violations**:
- Violates single-responsibility principle
- Duplicates renderer setup that should only be in FigJamCanvas.tsx
- Creates competing stage instances

### 2. `src/features/canvas/components/FigJamCanvas.tsx` ✅ TARGET IMPLEMENTATION
**Status**: PREFERRED IMPLEMENTATION
**Strengths**:
- Clean, focused canvas implementation (511 lines)
- Direct Konva.Stage creation (line 67)
- Proper four-layer architecture (background, main, preview, overlay)
- Correct setupRenderer() integration (line 140)
- Proper tool management and lifecycle
- Modern React patterns with proper cleanup

**Architecture Compliance**:
- Single Konva.Stage creation ✅
- Proper renderer module integration ✅
- Clean tool activation system ✅
- Viewport integration ✅

### 3. `src/features/canvas/components/NonReactCanvasStage.tsx` ❌ UNNECESSARY ABSTRACTION
**Status**: USED BY CANVAS.TSX - Should be archived
**Issues**:
- Creates Konva.Stage (line 58) - competing with FigJamCanvas
- Only implements 4 layers instead of required 5 (missing highlighter layer)
- 152 lines of code that duplicate FigJamCanvas functionality
- Abstracts stage creation without adding value
- No renderer integration

**Problems**:
- Architectural duplication
- Incomplete layer implementation
- Unnecessary complexity layer

### 4. `src/features/canvas/components/CanvasContainer.tsx` ⚠️ MINOR ISSUE
**Status**: USED BY CANVAS.TSX - Simple wrapper
**Analysis**:
- 42 lines of simple prop forwarding
- No Konva.Stage creation
- Could be integrated into FigJamCanvas.tsx or kept as layout wrapper
- Not harmful but adds unnecessary abstraction

---

## COMPONENT HIERARCHY DIAGRAM

```
CURRENT PROBLEMATIC STRUCTURE:
App Router
└── Canvas.tsx (Page) ❌
    ├── NonReactCanvasStage ❌ creates Konva.Stage
    ├── setupRenderer() call ❌ duplicate
    ├── Manual renderer instances ❌
    └── Complex lifecycle management ❌

CURRENT UNUSED BUT CORRECT STRUCTURE:
FigJamCanvas.tsx ✅
├── Direct Konva.Stage creation ✅
├── Four-layer architecture ✅
├── setupRenderer() integration ✅
└── Proper tool management ✅
```

**TARGET STRUCTURE** (after consolidation):
```
App Router
└── Canvas.tsx (Simple Page) ✅
    └── FigJamCanvas.tsx (Single Implementation) ✅
        ├── Direct Konva.Stage creation
        ├── Four-layer architecture
        ├── setupRenderer() integration
        └── All tool management
```

---

## ROUTING CONFIGURATION

**Current Entry Point**: `src/app/pages/Canvas.tsx`
- This is the component that gets loaded by the routing system
- It currently imports and uses NonReactCanvasStage
- **Must be simplified** to only import and render FigJamCanvas

**Verification Commands**:
```bash
# Check for multiple Konva.Stage creations
grep -r "new Konva.Stage" src/
# Found in:
# - src/app/pages/Canvas.tsx (via NonReactCanvasStage)
# - src/features/canvas/components/FigJamCanvas.tsx
# - src/features/canvas/components/NonReactCanvasStage.tsx
```

---

## SPECIFIC ARCHITECTURAL CONFLICTS

### 1. Duplicate setupRenderer() Calls
- **Canvas.tsx line 149**: `rendererCleanupRef.current = setupRenderer(stage, layerRefs);`
- **FigJamCanvas.tsx line 140**: `const rendererDispose = setupRenderer(stage, { ... });`

**Impact**: Renderer modules get registered twice, causing subscription conflicts and element duplication.

### 2. Competing Konva.Stage Instances
- **NonReactCanvasStage.tsx line 58**: Creates stage with 4 layers
- **FigJamCanvas.tsx line 67**: Creates stage with 4 layers

**Impact**: Tools and store may bind to wrong stage, elements appear in wrong place or not at all.

### 3. Layer Architecture Mismatch
- **NonReactCanvasStage**: background, main, preview, overlay (4 layers)
- **FigJamCanvas**: background, main, preview, overlay (4 layers)

**Impact**: Highlighter tools fail, z-index conflicts, rendering issues.

---

## UNUSED/EXPERIMENTAL COMPONENTS

### Components to Archive:
1. **NonReactCanvasStage.tsx** - Unnecessary abstraction, incomplete implementation
2. **CanvasContainer.tsx** - Simple wrapper, functionality can be integrated

### Components to Keep:
1. **FigJamCanvas.tsx** - Primary implementation ✅
2. **Canvas.tsx** - Simplified to wrapper only ✅

---

## SUCCESS CRITERIA VERIFICATION

- [x] **Documentation showing which canvas component is actively used**: Canvas.tsx is entry point, uses NonReactCanvasStage
- [x] **List of unused/experimental components to archive**: NonReactCanvasStage.tsx, CanvasContainer.tsx
- [x] **Clear component hierarchy diagram**: Provided above showing current vs target structure

---

## RECOMMENDED IMMEDIATE ACTIONS

### Task 1.2 Implementation Plan:
1. **Archive conflicting components**:
   ```bash
   mkdir -p src/archive
   mv src/features/canvas/components/NonReactCanvasStage.tsx src/archive/
   mv src/features/canvas/components/CanvasContainer.tsx src/archive/
   ```

2. **Simplify Canvas.tsx** to:
   ```typescript
   import FigJamCanvas from '../../features/canvas/components/FigJamCanvas';

   export default function Canvas() {
     return <FigJamCanvas />;
   }
   ```

3. **Verify single stage creation**:
   - Only FigJamCanvas.tsx should create Konva.Stage
   - Only FigJamCanvas.tsx should call setupRenderer()
   - Add console.log to verify single initialization

### Task 1.3 Implementation Plan:
1. **Remove duplicate setupRenderer() call** from Canvas.tsx
2. **Ensure all renderer modules** are registered in setupRenderer()
3. **Add debugging** to verify store → renderer pipeline
4. **Test element creation** flow end-to-end

---

## RISK ASSESSMENT

**HIGH RISK**: Store-renderer disconnection causing elements to not appear
**MEDIUM RISK**: Tool functionality breaking during transition
**LOW RISK**: Layout/styling issues from component simplification

**MITIGATION**: Systematic step-by-step implementation with extensive logging and testing at each step.