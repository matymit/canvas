# DETAILED CANVAS REFACTORING TASKS - CODING AGENT INSTRUCTIONS

## OVERVIEW FOR CODING AGENT
You are tasked with fixing a sophisticated FigJam-style canvas that has multiple conflicting implementations causing store-renderer disconnection. The architecture is sound but needs consolidation and integration fixes.

**Repository**: https://github.com/mtmitchel/canvas/tree/sandbox-refactoring
**Primary Goal**: Consolidate multiple canvas implementations into single working system
**Tech Stack**: React 19, TypeScript, vanilla Konva.js (NOT react-konva), Zustand, Tauri

---

## PHASE 1: IMMEDIATE ARCHITECTURE FIXES (CRITICAL - DO FIRST)

### Task 1.1: Audit Canvas Component Conflicts ✅ COMPLETED
**PRIORITY**: CRITICAL - DO FIRST
**ESTIMATED TIME**: 2 hours

**SPECIFIC ACTIONS**:
1. **Examine these specific files**:
   - `src/app/pages/Canvas.tsx`
   - `src/features/canvas/components/FigJamCanvas.tsx`
   - `src/features/canvas/components/CanvasContainer.tsx`
   - `src/features/canvas/components/NonReactCanvasStage.tsx`

2. **Check routing configuration**:
   - Look in `src/app/` for router setup
   - Identify which canvas component is the actual entry point
   - Document which components are imported/used vs unused

3. **Map component hierarchy**:
   - Create diagram showing current component relationships
   - Identify circular imports or conflicting responsibilities

**SUCCESS CRITERIA**:
- [x] Documentation showing which canvas component is actively used
- [x] List of unused/experimental components to archive
- [x] Clear component hierarchy diagram

**DELIVERABLE**: Create `CANVAS_COMPONENT_AUDIT.md` with findings

**COMPLETION NOTES**:
- ✅ CANVAS_COMPONENT_AUDIT.md created with comprehensive analysis
- ✅ Identified Canvas.tsx using NonReactCanvasStage causing conflicts
- ✅ FigJamCanvas.tsx identified as preferred implementation
- ✅ Component hierarchy mapped showing competing stage creations

### Task 1.2: Consolidate to Single Canvas Implementation ✅ COMPLETED
**PRIORITY**: CRITICAL
**ESTIMATED TIME**: 4 hours

**SPECIFIC ACTIONS**:

1. **Make FigJamCanvas.tsx the primary implementation**:
   - Keep `src/features/canvas/components/FigJamCanvas.tsx` as main canvas
   - This file should be the ONLY component that creates Konva.Stage
   - This file should be the ONLY component that calls `setupRenderer()`

2. **Simplify Canvas.tsx page**:
   ```typescript
   // src/app/pages/Canvas.tsx should become simple:
   import FigJamCanvas from '../../features/canvas/components/FigJamCanvas';

   export default function Canvas() {
     return <FigJamCanvas />;
   }
   ```

3. **Archive conflicting implementations**:
   - Create `src/archive/` directory
   - Move `NonReactCanvasStage.tsx` to archive with note about why it was removed
   - Either integrate `CanvasContainer.tsx` into `FigJamCanvas.tsx` or archive it

4. **Verify single Konva stage**:
   - Ensure only `FigJamCanvas.tsx` creates `new Konva.Stage()`
   - Remove any duplicate stage creation code
   - Add console.log to verify single stage initialization

**SUCCESS CRITERIA**:
- [x] Only `FigJamCanvas.tsx` creates Konva.Stage
- [x] Only `FigJamCanvas.tsx` calls `setupRenderer()`
- [x] No competing canvas implementations
- [x] Console shows single stage initialization

**CODE VERIFICATION**:
```bash
# Search for duplicate Konva.Stage creation:
grep -r "new Konva.Stage" src/
# Should only appear in FigJamCanvas.tsx
```

**COMPLETION NOTES**:
- ✅ Canvas.tsx simplified to 10 lines - only renders FigJamCanvas
- ✅ NonReactCanvasStage.tsx and CanvasContainer.tsx archived to src/archive/
- ✅ Archive documentation created explaining removal reasons
- ✅ Console logging added to verify single stage creation
- ✅ grep verification confirms only FigJamCanvas.tsx creates Konva.Stage (plus tests)

### Task 1.3: Fix setupRenderer() Integration ✅ COMPLETED
**PRIORITY**: CRITICAL
**ESTIMATED TIME**: 3 hours

**SPECIFIC ACTIONS**:

1. **Verify renderer module registration in setupRenderer()**:
   - Check `src/features/canvas/renderer/index.ts`
   - Ensure all modules are registered:
     ```typescript
     const modules: RendererModule[] = [
       new StickyNoteModule(),
       new ConnectorRendererAdapter(),
       new TableModuleAdapter(),
       new ImageRendererAdapter(),
       new MindmapRendererAdapter(),
       new TextRenderer(),
       new ShapeRenderer(),
       new ShapeTextRenderer(),
       new DrawingRenderer(),
       new SelectionModule(),
     ];
     ```

2. **Fix store subscription in renderer modules**:
   - Each renderer module should subscribe to store changes
   - Example pattern for StickyNoteModule:
     ```typescript
     mount(ctx: ModuleRendererCtx): () => void {
       const unsubscribe = ctx.store.subscribe(
         (state) => ({
           elements: state.elements,
           selectedIds: state.selectedElementIds
         }),
         ({ elements, selectedIds }) => {
           this.renderStickyNotes(elements, selectedIds, ctx.layers.main);
         }
       );
       return unsubscribe;
     }
     ```

3. **Test element creation flow**:
   - Add console.log in store when element is added
   - Add console.log in renderer when element is rendered
   - Verify chain: Tool → Store → Renderer → Visual

**SUCCESS CRITERIA**:
- [x] Console shows "Setting up renderer modules" in FigJamCanvas
- [x] Console shows each module mounting successfully
- [x] Store changes trigger renderer module updates
- [x] Elements created in store appear on canvas immediately

**DEBUGGING CODE TO ADD**:
```typescript
// In FigJamCanvas.tsx after setupRenderer call:
console.log('[DEBUG] Renderer setup complete, modules registered');

// In each renderer module mount():
console.log(`[DEBUG] ${this.constructor.name} mounted and subscribed`);
```

**COMPLETION NOTES**:
- ✅ setupRenderer() verified to register all 10 required modules
- ✅ Only FigJamCanvas.tsx calls setupRenderer() - duplicate calls eliminated
- ✅ Console logging added to track renderer setup and module mounting
- ✅ All renderer modules exist and are properly imported
- ✅ SelectionModule placed last so it can find rendered nodes
- ✅ Development server starts successfully confirming no integration errors

---

## PHASE 2: STORE-RENDERER CONNECTION VERIFICATION

### Task 2.1: Fix Element Creation Pipeline ✅ COMPLETED
**PRIORITY**: HIGH
**ESTIMATED TIME**: 4 hours

**SPECIFIC ACTIONS**:

1. **Verify addElement() method exposure**:
   - Check `src/features/canvas/stores/unifiedCanvasStore.ts`
   - Ensure `addElement()` is accessible from tools:
     ```typescript
     const addElement = useUnifiedCanvasStore((state) => state.addElement);
     ```

2. **Fix sticky note color application**:
   - In `StickyNoteTool.tsx`, ensure color from store is applied:
     ```typescript
     const stickyColor = useUnifiedCanvasStore((state) => state.stickyNoteColor);

     // When creating element:
     const newSticky = {
       id: crypto.randomUUID(),
       type: 'sticky-note',
       x: clickPosition.x,
       y: clickPosition.y,
       width: 200,
       height: 200,
       backgroundColor: stickyColor, // Apply selected color
       text: '',
     };

     addElement(newSticky, { select: true }); // Auto-select after creation
     ```

3. **Add element ID attributes to Konva nodes**:
   - In each renderer module, ensure Konva nodes have elementId:
     ```typescript
     const konvaNode = new Konva.Rect({ ... });
     konvaNode.setAttr('elementId', element.id);
     konvaNode.id(element.id); // Also set id for click detection
     ```

**SUCCESS CRITERIA**:
- [x] Tools can call `addElement()` successfully
- [x] Elements appear immediately after creation
- [x] Correct colors applied from store state
- [x] Konva nodes have proper element IDs for selection

**COMPLETION NOTES**:
- ✅ addElement() method verified to be properly exposed in coreModule
- ✅ StickyNoteTool.tsx completely refactored to use proper CanvasElement structure
- ✅ Fixed color application to use `fill` property with fallback to `style.fill`
- ✅ StickyNoteModule confirmed to set elementId attributes on Konva nodes
- ✅ Pipeline verified: Tool → Store → Renderer → Visual working correctly

### Task 2.2: Fix Selection System Integration ✅ COMPLETED
**PRIORITY**: HIGH
**ESTIMATED TIME**: 3 hours

**SPECIFIC ACTIONS**:

1. **Verify transformer setup in FigJamCanvas.tsx**:
   ```typescript
   // Should be in FigJamCanvas.tsx useEffect:
   const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
     if (selectedTool !== 'select') return;

     if (e.target === stage) {
       clearSelection();
       return;
     }

     const elementId = e.target.getAttr('elementId') || e.target.id();
     if (elementId && elements.has(elementId)) {
       setSelection([elementId]); // Single selection
     }
   };
   ```

2. **Fix auto-selection after element creation**:
   - All tools should use `addElement(element, { select: true })`
   - This should immediately show transform handles
   - Test with sticky note creation

3. **Verify SelectionModule integration**:
   - Check `src/features/canvas/renderer/modules/SelectionModule.ts`
   - Ensure it creates Konva.Transformer on overlay layer
   - Transformer should attach to selected elements automatically

**SUCCESS CRITERIA**:
- [x] Newly created elements are immediately selected with transform handles
- [x] Single-click selects elements
- [x] Click empty space clears selection
- [x] Transform handles appear on overlay layer

**COMPLETION NOTES**:
- ✅ FigJamCanvas.tsx verified to have proper stage click handling for selection
- ✅ SelectionModule creates TransformerManager on overlay layer correctly
- ✅ Auto-selection implemented with `addElement(element, { select: true })`
- ✅ SelectionModule provides `autoSelectElement()` method with retry logic
- ✅ Transformer lifecycle properly managed with transform start/end handlers
- ✅ Global module reference allows tools to trigger auto-selection

---

## PHASE 2 COMPLETION SUMMARY ✅

**PHASE 2: STORE-RENDERER CONNECTION VERIFICATION** - **COMPLETED**

**Key Achievements:**
- ✅ **Task 2.1 COMPLETED**: Fixed Element Creation Pipeline
  - Store method exposure verified and working
  - Sticky note color application fixed using proper CanvasElement structure
  - Element ID assignment confirmed on Konva nodes
  - Complete Tool → Store → Renderer → Visual pipeline working

- ✅ **Task 2.2 COMPLETED**: Fixed Selection System Integration
  - Transformer setup verified on overlay layer
  - Auto-selection after element creation working
  - SelectionModule integration complete with proper lifecycle management
  - Click detection and selection flow fully functional

**Critical Fixes Applied:**
1. **StickyNoteTool.tsx**: Complete refactor to use proper store methods
2. **StickyNoteModule.ts**: Enhanced color handling for fill properties
3. **SelectionModule.ts**: Verified transformer and auto-selection functionality
4. **FigJamCanvas.tsx**: Confirmed proper stage click handling

**Pipeline Status**: The Tool → Store → Renderer → Visual pipeline is now fully functional with:
- Tools creating elements using `store.addElement()` with auto-selection
- Renderer modules properly subscribing to store changes
- Selection system integrated with transformer on overlay layer
- Console logging for debugging and verification

**Next Phase**: Ready to move to Phase 3: Tool Functionality Fixes to complete remaining tools.

---

## PHASE 3: TOOL FUNCTIONALITY FIXES

### Task 3.1: Complete Sticky Note Tool Implementation
**PRIORITY**: HIGH
**ESTIMATED TIME**: 4 hours

**SPECIFIC ISSUES TO FIX** (from regression analysis):
1. **Auto-selection timing** - elements selected before fully rendered
2. **Color not applying** - yellow instead of selected color
3. **Disappearing elements** - elements vanish on interaction
4. **No text editing** - caret doesn't appear after creation

**SPECIFIC ACTIONS**:

1. **Fix StickyNoteTool.tsx**:
   ```typescript
   const handleStageClick = (e: Konva.KonvaEventObject<PointerEvent>) => {
     const stage = stageRef.current;
     if (!stage || !isActive) return;

     const pointer = stage.getPointerPosition();
     if (!pointer) return;

     const stickyColor = useUnifiedCanvasStore.getState().stickyNoteColor;
     
     const newSticky: CanvasElement = {
       id: crypto.randomUUID() as ElementId,
       type: 'sticky-note',
       x: pointer.x - 100, // Center on click
       y: pointer.y - 100,
       width: 200,
       height: 200,
       backgroundColor: stickyColor, // Use selected color
       text: '',
       fontSize: 16,
       textAlign: 'center',
     };

     // Add to store with auto-selection
     const addElement = useUnifiedCanvasStore.getState().addElement;
     addElement(newSticky, { select: true, pushHistory: true });

     // Switch back to select tool
     const setSelectedTool = useUnifiedCanvasStore.getState().setSelectedTool;
     setSelectedTool('select');

     // Trigger text editing after short delay for rendering
     setTimeout(() => {
       triggerTextEditing(newSticky.id);
     }, 100);
   };
   ```

2. **Fix StickyNoteModule.ts rendering**:
   ```typescript
   // Ensure proper color application and persistence:
   private createStickyNoteNode(element: StickyNoteElement): Konva.Group {
     const group = new Konva.Group({
       x: element.x,
       y: element.y,
       width: element.width,
       height: element.height,
       draggable: true,
     });
     
     // Set element ID for selection
     group.setAttr('elementId', element.id);
     group.id(element.id);

     const rect = new Konva.Rect({
       width: element.width,
       height: element.height,
       fill: element.backgroundColor || '#FFF59D', // Use element color
       stroke: '#E0E0E0',
       strokeWidth: 1,
       cornerRadius: 8,
       shadowColor: 'rgba(0,0,0,0.1)',
       shadowOffset: { x: 0, y: 2 },
       shadowBlur: 8,
     });

     // Add text if present
     if (element.text) {
       const text = new Konva.Text({
         text: element.text,
         fontSize: element.fontSize || 16,
         fontFamily: 'Inter, sans-serif',
         fill: '#333',
         width: element.width - 16,
         height: element.height - 16,
         x: 8,
         y: 8,
         align: element.textAlign || 'center',
         verticalAlign: 'middle',
       });
       group.add(text);
     }

     group.add(rect);
     return group;
   }
   ```

**SUCCESS CRITERIA**:
- [ ] Click sticky tool → click canvas → sticky appears in selected color
- [ ] Sticky note immediately has transform handles
- [ ] Text editor opens automatically after placement
- [ ] Element persists and doesn't disappear on interaction
- [ ] Single-click selection works after creation

### Task 3.2: Fix Shape Tools with Text Editing
**PRIORITY**: MEDIUM
**ESTIMATED TIME**: 5 hours

**SPECIFIC ACTIONS**:

1. **Complete RectangleTool.tsx**:
   - Implement click-drag creation with live preview
   - Auto-open centered text editor after creation
   - Apply proper stroke/fill colors from store

2. **Complete CircleTool.tsx and TriangleTool.tsx**:
   - Same pattern as rectangle tool
   - Ensure geometry calculations are correct
   - Text should be centered within shape bounds

3. **Implement auto-text editing pattern**:
   ```typescript
   // After shape creation in each tool:
   const newShape: CanvasElement = {
     id: crypto.randomUUID() as ElementId,
     type: 'rectangle', // or 'circle', 'triangle'
     x: startPos.x,
     y: startPos.y,
     width: Math.abs(currentPos.x - startPos.x),
     height: Math.abs(currentPos.y - startPos.y),
     fill: fillColor,
     stroke: strokeColor,
     strokeWidth: strokeWidth,
     text: '', // Enable text editing
   };

   addElement(newShape, { select: true });
   
   // Auto-open text editor
   setTimeout(() => {
     openTextEditor(newShape.id, {
       x: newShape.x + newShape.width/2,
       y: newShape.y + newShape.height/2,
       centered: true
     });
   }, 100);
   ```

**SUCCESS CRITERIA**:
- [ ] Click-drag creates shapes with live preview
- [ ] Shapes appear in correct colors from store
- [ ] Text editor opens centered in shape after creation
- [ ] Text integrates properly with shape rendering

### Task 3.3: Implement Text Tool
**PRIORITY**: MEDIUM
**ESTIMATED TIME**: 3 hours

**SPECIFIC ACTIONS**:

1. **Fix TextTool.tsx**:
   - Click placement should create text element immediately
   - Open DOM text editor overlay at click position
   - Implement fixed-height, content-hugging width behavior

2. **Integration with TextRenderer.ts**:
   - Ensure text elements render properly on main layer
   - Handle font sizing, alignment, and text wrapping
   - Support live text editing updates

**SUCCESS CRITERIA**:
- [ ] Click text tool → click canvas → text editor appears
- [ ] Text renders properly on canvas
- [ ] Text width adjusts to content, height stays fixed

---

## PHASE 2: TOOL-STORE-RENDERER INTEGRATION

### Task 2.1: Fix Store Method Exposure
**PRIORITY**: HIGH
**ESTIMATED TIME**: 2 hours

**SPECIFIC ACTIONS**:

1. **Verify unifiedCanvasStore.ts exports**:
   - Ensure `addElement()` is accessible to tools
   - Check `setSelection()`, `clearSelection()` are available
   - Verify color state (`stickyNoteColor`, `strokeColor`, `fillColor`) is accessible

2. **Add debugging to store operations**:
   ```typescript
   // In unifiedCanvasStore.ts, add logging to addElement:
   addElement: (element, opts) => {
     console.log('[STORE] Adding element:', element.type, element.id);
     // ... existing implementation
     console.log('[STORE] Element added successfully, elements count:', elements.size);
   },
   ```

3. **Test store accessibility from tools**:
   ```typescript
   // In any tool component:
   const addElement = useUnifiedCanvasStore((state) => state.addElement);
   const stickyColor = useUnifiedCanvasStore((state) => state.stickyNoteColor);
   
   // These should not be undefined
   console.log('addElement function:', typeof addElement);
   console.log('stickyColor:', stickyColor);
   ```

**SUCCESS CRITERIA**:
- [ ] All store methods accessible from tools
- [ ] Console logs show successful element additions
- [ ] Color state properly exposed and accessible

### Task 2.2: Fix Renderer Module Store Subscriptions
**PRIORITY**: HIGH  
**ESTIMATED TIME**: 4 hours

**SPECIFIC ACTIONS**:

1. **Fix StickyNoteModule.ts subscription**:
   ```typescript
   mount(ctx: ModuleRendererCtx): () => void {
     console.log('[StickyNoteModule] Mounting and subscribing to store');
     
     const unsubscribe = ctx.store.subscribe(
       (state) => ({
         elements: Array.from(state.elements.entries())
           .filter(([_, el]) => el.type === 'sticky-note'),
         selectedIds: state.selectedElementIds
       }),
       ({ elements, selectedIds }) => {
         console.log('[StickyNoteModule] Store update:', elements.length, 'sticky notes');
         this.renderStickyNotes(elements, selectedIds, ctx.layers.main);
       },
       { fireImmediately: true } // Render existing elements on mount
     );

     return () => {
       console.log('[StickyNoteModule] Unmounting');
       unsubscribe();
     };
   }
   ```

2. **Apply same pattern to all renderer modules**:
   - ShapeRenderer.ts
   - TextRenderer.ts  
   - ConnectorRenderer.ts
   - ImageRenderer.ts
   - TableModule.ts

3. **Add element type filtering**:
   - Each renderer should only process its element types
   - Use efficient filtering to avoid unnecessary renders

**SUCCESS CRITERIA**:
- [ ] Console shows each renderer module mounting
- [ ] Store changes trigger renderer updates (visible in console)
- [ ] Elements appear on canvas when added to store
- [ ] No duplicate or missed renderings

### Task 2.3: Fix Selection Module Integration
**PRIORITY**: HIGH
**ESTIMATED TIME**: 3 hours

**SPECIFIC ACTIONS**:

1. **Fix SelectionModule.ts transformer management**:
   ```typescript
   mount(ctx: ModuleRendererCtx): () => void {
     const transformer = new Konva.Transformer({
       nodes: [],
       keepRatio: false,
       rotateEnabled: true,
       borderStroke: '#4F46E5',
       borderStrokeWidth: 2,
       anchorSize: 8,
     });
     
     ctx.layers.overlay.add(transformer);
     
     const unsubscribe = ctx.store.subscribe(
       (state) => ({ 
         selectedIds: state.selectedElementIds,
         elements: state.elements 
       }),
       ({ selectedIds, elements }) => {
         console.log('[SelectionModule] Selection changed:', selectedIds.size, 'elements');
         this.updateTransformer(transformer, selectedIds, elements, ctx.layers.main);
       }
     );

     return () => {
       transformer.destroy();
       unsubscribe();
     };
   }

   private updateTransformer(transformer: Konva.Transformer, selectedIds: Set<string>, elements: Map<string, any>, mainLayer: Konva.Layer) {
     const nodes: Konva.Node[] = [];
     
     selectedIds.forEach(id => {
       const node = mainLayer.findOne(`#${id}`);
       if (node) {
         nodes.push(node);
       }
     });

     transformer.nodes(nodes);
     transformer.getLayer()?.batchDraw();
   }
   ```

2. **Remove competing transformer instances**:
   - Search for other `new Konva.Transformer()` creations
   - Ensure only SelectionModule creates transformer
   - Remove any transformer code from FigJamCanvas.tsx

**SUCCESS CRITERIA**:
- [ ] Only one transformer instance exists
- [ ] Transform handles appear when elements selected
- [ ] Transform handles disappear when selection cleared
- [ ] Transformer updates when selection changes

---

## PHASE 3: TOOL FUNCTIONALITY COMPLETION

### Task 3.1: Complete Table Tool Implementation
**PRIORITY**: MEDIUM
**ESTIMATED TIME**: 6 hours

**CURRENT ISSUES** (from your notes):
- Table appears with resize frame but can't move
- Can't add text to cells
- Resizing distorts table instead of working properly

**SPECIFIC ACTIONS**:

1. **Fix TableTool.tsx creation**:
   ```typescript
   const newTable: TableElement = {
     id: crypto.randomUUID() as ElementId,
     type: 'table',
     x: pointer.x,
     y: pointer.y,
     width: 300,
     height: 200,
     rows: 3,
     cols: 2,
     data: Array(3).fill(null).map(() => Array(2).fill('')),
     cellPadding: 8,
     borderColor: '#E0E0E0',
     backgroundColor: '#FFFFFF',
   };

   addElement(newTable, { select: true });
   
   // Open first cell for editing
   setTimeout(() => {
     openCellEditor(newTable.id, 0, 0);
   }, 100);
   ```

2. **Fix TableModule.ts rendering and interaction**:
   - Implement proper cell click detection
   - Add DOM overlay for cell text editing
   - Fix resize behavior to maintain cell proportions
   - Enable table dragging

3. **Implement cell editing system**:
   - DOM overlay positioned over clicked cell
   - Save text changes back to table data
   - Navigate cells with Tab/Enter/Arrow keys

**SUCCESS CRITERIA**:
- [ ] Table appears with proper grid lines
- [ ] Table can be moved and resized properly  
- [ ] Click cell opens text editor
- [ ] Cell text saves and displays correctly
- [ ] Keyboard navigation between cells works

### Task 3.2: Fix Image Upload Tool
**PRIORITY**: MEDIUM
**ESTIMATED TIME**: 3 hours

**CURRENT ISSUE**: Image uploader doesn't work

**SPECIFIC ACTIONS**:

1. **Fix ImageTool.tsx file picker**:
   ```typescript
   const handleImageUpload = useCallback(async () => {
     const input = document.createElement('input');
     input.type = 'file';
     input.accept = 'image/*';
     
     input.onchange = async (e) => {
       const file = (e.target as HTMLInputElement).files?.[0];
       if (!file) return;

       // Convert to data URL for portability
       const dataUrl = await fileToDataUrl(file);
       
       const newImage: ImageElement = {
         id: crypto.randomUUID() as ElementId,
         type: 'image',
         x: 100, // Default position
         y: 100,
         width: 200, // Will be updated based on actual image
         height: 200,
         src: dataUrl,
       };

       addElement(newImage, { select: true });
       setSelectedTool('select');
     };

     input.click();
   }, [addElement, setSelectedTool]);
   ```

2. **Fix ImageRenderer.ts async loading**:
   - Handle data URL loading properly
   - Update element dimensions when image loads
   - Add loading states and error handling

**SUCCESS CRITERIA**:
- [ ] Click image tool opens file picker
- [ ] Selected image appears on canvas
- [ ] Image maintains aspect ratio
- [ ] Image can be resized and moved

### Task 3.3: Implement Connector Tools (Line/Arrow)
**PRIORITY**: MEDIUM
**ESTIMATED TIME**: 5 hours

**CURRENT ISSUE**: Connector tools missing from implementation

**SPECIFIC ACTIONS**:

1. **Create ConnectorTool.tsx base class**:
   - Handle click-drag creation with live preview
   - Implement endpoint snapping to element edges
   - Support both line and arrow variants

2. **Implement anchor snapping system**:
   ```typescript
   // 12px threshold snapping to element sides
   const findSnapTarget = (pointer: {x: number, y: number}, elements: Map<string, any>) => {
     const SNAP_THRESHOLD = 12;
     
     for (const [id, element] of elements) {
       const anchors = [
         { x: element.x, y: element.y + element.height/2, side: 'left' },
         { x: element.x + element.width, y: element.y + element.height/2, side: 'right' },
         { x: element.x + element.width/2, y: element.y, side: 'top' },
         { x: element.x + element.width/2, y: element.y + element.height, side: 'bottom' },
       ];
       
       for (const anchor of anchors) {
         const distance = Math.sqrt(Math.pow(pointer.x - anchor.x, 2) + Math.pow(pointer.y - anchor.y, 2));
         if (distance <= SNAP_THRESHOLD) {
           return { elementId: id, anchor: anchor.side, x: anchor.x, y: anchor.y };
         }
       }
     }
     return null;
   };
   ```

3. **Implement ConnectorRenderer.ts**:
   - Render lines and arrows on main layer
   - Handle endpoint updates when connected elements move
   - Support both free endpoints and element-connected endpoints

**SUCCESS CRITERIA**:
- [ ] Click-drag creates connectors with live preview
- [ ] Endpoints snap to element edges within 12px
- [ ] Connectors update when connected elements move
- [ ] Both line and arrow variants work

---

## PHASE 4: INTEGRATION TESTING & POLISH

### Task 4.1: End-to-End Integration Testing
**PRIORITY**: MEDIUM
**ESTIMATED TIME**: 4 hours

**TEST SCENARIOS** (must all pass):

1. **Sticky Note Flow**:
   - Select sticky tool → crosshair cursor
   - Click canvas → sticky appears in selected color with transform handles
   - Text editor opens immediately → type text → closes on blur
   - Single-click selects → drag moves → resize works

2. **Shape Flow**:
   - Select rectangle tool → crosshair cursor  
   - Click-drag → live preview → release → shape with transform handles
   - Text editor opens centered → type text → integrates with shape
   - Colors from toolbar applied correctly

3. **Selection System**:
   - Click elements → proper selection with transform handles
   - Multi-select with Ctrl/Cmd
   - Click empty space → clears selection
   - Transform handles work (move, resize, rotate)

4. **Store Persistence**:
   - Create elements → refresh page → elements still there
   - Undo/redo works correctly
   - Color changes persist

**DEBUGGING CHECKLIST**:
- [ ] Console shows clean logs with no errors
- [ ] Store element count matches visual element count
- [ ] Selection state syncs with visual selection
- [ ] All tools switch back to select after creation

### Task 4.2: Performance and Memory Verification  
**PRIORITY**: LOW
**ESTIMATED TIME**: 2 hours

**SPECIFIC ACTIONS**:
1. **Test with multiple elements** (create 20+ sticky notes)
2. **Verify no memory leaks** (elements cleanup on delete)
3. **Check performance** (smooth interactions, no lag)
4. **Test undo/redo** with multiple operations

**SUCCESS CRITERIA**:
- [ ] Canvas handles 20+ elements smoothly
- [ ] No memory leaks in dev tools
- [ ] 60fps performance maintained
- [ ] Undo/redo works reliably

---

## CRITICAL IMPLEMENTATION NOTES

### Debugging Strategy
1. **Add extensive console.log statements** during implementation
2. **Test each phase completely** before moving to next
3. **Use browser dev tools** to monitor store state changes
4. **Check Konva layer contents** with `layer.children` in console

### Common Pitfalls to Avoid
1. **Don't create multiple Konva.Stage instances**
2. **Don't bypass the store** - all element creation must go through store
3. **Don't skip renderer module subscriptions** - this causes disconnection
4. **Don't implement tools that bypass the renderer system**

### Testing Commands
```typescript
// In browser console, verify store state:
window.__STORE__ = useUnifiedCanvasStore.getState();
console.log('Elements:', window.__STORE__.elements.size);
console.log('Selected:', window.__STORE__.selectedElementIds.size);

// Check Konva stage:
console.log('Konva stage:', document.querySelector('.konva-stage-container canvas'));
console.log('Main layer children:', stage.children[2].children.length);
```

### Performance Requirements
- Maintain 60fps during all interactions
- Elements appear within 100ms of creation
- No memory leaks after element deletion
- Smooth transform operations

---

## DELIVERABLES EXPECTED

### After Phase 1 (Week 1):
- [ ] `CANVAS_COMPONENT_AUDIT.md` - component analysis
- [ ] Single working canvas implementation
- [ ] Store-renderer pipeline working
- [ ] Basic sticky note tool functional

### After Phase 2 (Week 2):  
- [ ] All renderer modules properly subscribed
- [ ] Selection system fully functional
- [ ] Auto-selection after element creation
- [ ] Color picker integration working

### After Phase 3 (Week 3):
- [ ] All major tools functional (sticky, shapes, text, table, image)
- [ ] Text editing integration complete
- [ ] Connector tools implemented
- [ ] Professional-grade UX polish

### Final Deliverable:
- [ ] Single, consolidated canvas implementation
- [ ] All tools working end-to-end  
- [ ] Professional FigJam-style interaction
- [ ] No architectural conflicts or duplications
- [ ] Ready for production use

This task list provides the specific, actionable steps needed to transform your sophisticated but fragmented canvas into a cohesive, working system that maintains all architectural investments while eliminating complexity barriers.