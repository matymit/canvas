# Canvas Project - Developer Handover

## Project Overview

Canvas is a FigJam-style collaborative whiteboard application built with React 18, TypeScript, and vanilla Konva.js for canvas rendering. The project enforces strict architectural constraints and performance requirements.

## Current Issue Being Worked On

**Problem**: Marquee selection tool has bugs where:
- Selected elements don't maintain their relative positions during drag operations
- Selection bounding box expands unexpectedly after drag operations
- Connectors sometimes "jump" outside the selection frame
- Empty space appears in the middle of selections

**Root Cause**: The monolithic `SelectionModule.ts` (1,853 lines) contains complex interdependent logic that's difficult to maintain and debug.

## Work Completed This Session

### 1. Marquee Selection Debugging
- Added extensive logging to `MarqueeSelectionTool.tsx` 
- Identified timing issues with selection state synchronization
- Found problems with base position calculation for connectors
- Partially fixed selection bounds calculation

### 2. SelectionModule Refactoring Started
- Created modular architecture plan in `SELECTION_MODULE_REFACTORING_PLAN.md`
- Began extracting functionality into smaller, focused modules
- Set up foundation for breaking down the 1,853-line monolith

### 3. Architecture Documentation
- Updated Canvas Master Blueprint
- Documented selection system architecture
- Created comprehensive refactoring plan

## Current State

### What's Working
- Basic marquee selection functions
- Elements can be selected and moved
- Most visual feedback is working

### What's Broken
- Selection persistence during drag operations
- Accurate bounding box calculation
- Connector positioning in selections
- Some timing issues with selection state

### Key Files Modified
```
src/features/canvas/tools/selection/MarqueeSelectionTool.tsx  # Enhanced logging
SELECTION_MODULE_REFACTORING_PLAN.md                         # Refactoring strategy
CANVAS_MASTER_BLUEPRINT.md                                   # Updated architecture
```

## Next Steps (Priority Order)

### 1. IMMEDIATE: Fix Selection Position Bugs
- Debug base position calculation in `MarqueeSelectionTool.tsx` lines 393-448
- Fix connector center position calculation (lines 418+)
- Ensure selection state persistence during drag operations

### 2. Continue SelectionModule Refactoring
- Implement the plan in `SELECTION_MODULE_REFACTORING_PLAN.md`
- Break down `SelectionModule.ts` into smaller modules:
  - `SelectionBoundsCalculator.ts` (~200 lines)
  - `SelectionDragHandler.ts` (~300 lines)
  - `SelectionVisualManager.ts` (~250 lines)
  - `ElementDetectionEngine.ts` (~400 lines)
  - Core `SelectionModule.ts` (~200 lines)

### 3. Type Safety & Lint Cleanup
- Address TypeScript errors in selection system
- Fix ESLint warnings
- Ensure all new modules follow project patterns

## Getting Started

### Prerequisites
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checking
npm run type-check

# Run linting
npm run lint
```

### Testing the Selection Issue
1. Open the canvas in browser
2. Create some elements (sticky notes, mindmap nodes, connectors)
3. Use marquee selection tool (drag selection rectangle)
4. Try to drag the selected group
5. Observe position/bounds issues in console logs

### Key Architecture Constraints

**CRITICAL**: This project has strict architectural requirements:

1. **NO REACT-KONVA**: Must use vanilla Konva.js directly
2. **Four-Layer Architecture**: Background, Main, Preview, Overlay layers only
3. **Store-Driven Pattern**: Tools write to Zustand state, renderers subscribe
4. **60fps Performance**: All updates must use RAF batching
5. **withUndo Pattern**: All user actions must use `store.history.withUndo()`

### Important Files to Understand

```
src/features/canvas/
├── stores/unifiedCanvasStore.ts          # Central Zustand store
├── renderer/modules/SelectionModule.ts   # 1,853-line monolith to refactor
├── tools/selection/MarqueeSelectionTool.tsx  # Current bug location
├── layers/CanvasLayerManager.ts          # Four-layer enforcement
└── utils/performance/                    # RAF batching, optimization
```

### Memory Graph & Documentation

Check the memory graph for:
- Pre-flight checklist items
- Documentation update requirements
- Known issues and workarounds

Important docs to keep updated:
- `docs/known-issues.md`
- `docs/architecture/canvas-implementation-progress.md`
- `docs/CHANGELOG.md`

## Debugging Tools

### Console Logs
- Marquee selection operations are heavily logged
- Look for "MarqueeSelectionTool:" prefix in console
- Selection state changes logged with element IDs and positions

### Performance Monitoring
- Use browser dev tools Performance tab
- Watch for frame drops during selection operations
- Monitor memory usage during large selections

## Common Pitfalls

1. **Never use react-konva** - Will break entire architecture
2. **Always use RAF batching** for canvas updates
3. **Selection state is complex** - Study existing patterns before changing
4. **Connector positioning is tricky** - They use calculated center points
5. **Mind the four-layer limit** - Don't add new layers

## Contact & Resources

- Check `CLAUDE.md` for AI assistant guidelines
- Review `README.md` for complete setup instructions
- See `CANVAS_MASTER_BLUEPRINT.md` for full architecture
- Consult `SELECTION_MODULE_REFACTORING_PLAN.md` for refactoring strategy

## Emergency Commands

```bash
# If build breaks
npm run clean && npm install

# If TypeScript errors overwhelm
npm run type-check | head -20

# If performance degrades
npm run test:performance-budgets

# If you break selection entirely
git checkout HEAD -- src/features/canvas/tools/selection/
git checkout HEAD -- src/features/canvas/renderer/modules/SelectionModule.ts
```

---

**Status**: Selection bugs partially fixed, refactoring in progress, requires continued work on position calculation and module breakdown.

**Last Updated**: Current session
**Next Dev Should Start With**: Debugging base position calculation in MarqueeSelectionTool.tsx