# 🚨 CRITICAL BUG FIX: Connector Marquee Selection Drag Issue

## **📧 Developer Handoff Message**

Hello! I need to hand off a critical bug fix for the Canvas FigJam-style whiteboard application. This is a **connector dragging issue** that's been systematically debugged and has a targeted fix ready for testing.

---

## **🎯 What This Project Is**

This is a **sophisticated canvas drawing application** similar to FigJam/Miro, built with:
- **React 18 + TypeScript** for UI components
- **Vanilla Konva.js** for high-performance canvas rendering (NO react-konva)
- **Zustand + Immer** for state management
- **4-layer rendering pipeline** for optimal performance
- **60fps drawing targets** with RAF batching
- **Tauri** for desktop app functionality

**Key Architecture Constraints:**
- Must use vanilla Konva.js directly (react-konva is forbidden)
- All rendering follows store-driven pattern (tools → Zustand state → renderers)
- 4-layer limit: Background, Main, Preview, Overlay
- User actions must use `withUndo` for history support
- Performance budgets: 60fps, ≤500MB memory, ≤4MB bundle

---

## **🐛 The Bug: Connector Lines Don't Move in Marquee Selection**

### **User Experience Issue:**
1. User draws a marquee selection rectangle around multiple elements (shapes + connector lines)
2. Elements get selected correctly ✅
3. User drags the selection group
4. **Shapes move correctly, but connector lines stay anchored** ❌
5. This causes visual distortion and breaks the user's mental model

### **Visual Problem:**
```
Before Drag:    During Drag:      After Release:
[A]----[B]      [A]----[B]        [A]    [B]
   |               |                 |     |
[C]                C                [C] ---+
                                        
✅ Correct      ❌ Connectors       ❌ Broken layout
                   don't move
```

---

## **🔍 Root Cause Analysis (Completed)**

### **Console Log Evidence:**
```javascript
// ✅ Selection works correctly
[MarqueeSelectionTool] SelectionModule returned – {selectedIds: Array(7), elementIds: [...]}

// ✅ Base positions captured correctly  
[MarqueeSelectionTool] captured base positions for drag: [
  ["shape-1", {x: 508, y: 277}], 
  ["connector-1", {x: 840, y: 319.5}],  // ← Connector center calculated correctly
  ["connector-2", {x: 925.5, y: 346.5}]
]

// ✅ Connector movement called with correct delta
[ConnectorSelectionManager] Moving selected connectors {delta: {dx: 50, dy: 30}}

// ❌ BUT THEN: Wrong delta applied  
[ConnectorSelectionManager] Committing connector translation {dx: 0, dy: 0}  // ← BUG!
```

### **Technical Root Cause:**
**DOUBLE PROCESSING CONFLICT** between two systems:

1. **`MarqueeSelectionTool.tsx`** correctly calls `moveSelectedConnectors(connectorIds, {dx: 50, dy: 30})` ✅
2. **`SelectionModule.ts`** separately calls `commitTranslation({dx: 0, dy: 0})` ❌

The second call overwrites the first with zero delta because `TransformController.computeDelta()` compares:
- `node.position()` = `{x: 0, y: 0}` (connectors have no position in Konva)
- `baseline.x/y` = `{x: 0, y: 0}` (from snapshot)
- Result: `{dx: 0-0, dy: 0-0} = {dx: 0, dy: 0}` ❌

---

## **✅ Solution Applied (Ready for Testing)**

### **Fix: Prevent Double Processing**
Added a flag in `ConnectorSelectionManager.ts` to skip `commitTranslation()` when `moveSelectedConnectors()` was already called:

```typescript
// NEW: Flag to prevent double processing
private moveSelectedConnectorsWasCalled = false;

moveSelectedConnectors(connectorIds: Set<string>, delta: { dx: number; dy: number }): void {
  this.moveSelectedConnectorsWasCalled = true; // Set flag
  // ... apply correct delta to connectors
}

commitTranslation(delta: { dx: number; dy: number }): void {
  if (this.moveSelectedConnectorsWasCalled) {
    console.log("Skipping commitTranslation - connectors already moved");
    this.moveSelectedConnectorsWasCalled = false; // Reset flag
    return; // SKIP double processing
  }
  // ... existing logic for non-marquee cases
}
```

---

## **🧪 How to Test the Fix**

### **Manual Testing Steps:**
1. **Start dev server**: `npm run dev`
2. **Create test scene**:
   - Add 2-3 mindmap nodes or sticky notes
   - Connect them with connector lines (use connector tool)
3. **Test marquee selection**:
   - Draw selection rectangle including both shapes and connectors
   - Verify all elements get selected (blue outline/handles)
4. **Test drag behavior**:
   - Click and drag the selection group
   - **EXPECTED**: Connectors move smoothly with shapes
   - **BEFORE FIX**: Connectors stay anchored, visual distortion
5. **Verify undo/redo**: Movement should be undoable

### **Console Log Verification:**
**Before Fix:**
```
[ConnectorSelectionManager] Moving selected connectors {delta: {dx: 50, dy: 30}}
[ConnectorSelectionManager] Committing connector translation {dx: 0, dy: 0}
```

**After Fix (Expected):**
```
[ConnectorSelectionManager] Moving selected connectors {delta: {dx: 50, dy: 30}}
[ConnectorSelectionManager] Skipping commitTranslation - connectors already moved
```

---

## **📁 Files Modified**

### **Primary Fix:**
- `src/features/canvas/renderer/modules/selection/managers/ConnectorSelectionManager.ts`
  - Added `moveSelectedConnectorsWasCalled` flag
  - Modified `commitTranslation()` to check flag and skip double processing

### **Debug/Documentation:**
- `src/features/canvas/__tests__/connector-drag-debug.test.tsx` (NEW)
- `CONNECTOR_DRAG_FIX.md` (NEW) - This technical documentation

---

## **🚨 Critical Information**

### **Environment Setup:**
```bash
# IMPORTANT: Currently has npm dependency issues
rm -rf node_modules package-lock.json
npm cache clean --force  
npm install --legacy-peer-deps

# If dev server fails, try:
npm run type-check  # Should pass
npm run lint        # Should pass
```

### **Testing Framework:**
- **Unit Tests**: `npm test` (Vitest + jsdom + Konva mocking)
- **E2E Tests**: `npm run test:e2e` (Playwright)
- **Performance**: `npm run test:performance-budgets`

### **Architecture Notes:**
- This is a **surgical fix** - no architecture changes
- Maintains existing 4-layer rendering pipeline
- Preserves store-driven pattern and vanilla Konva usage
- No impact on performance budgets or other tools

---

## **🎯 Expected Outcome**

After applying this fix:
1. **Marquee selection** should work seamlessly with mixed element types
2. **Connector lines** should move smoothly with shapes during group drag
3. **No visual glitches** or position snapping
4. **Undo/redo** works correctly for connector movements
5. **Performance** remains within 60fps targets

---

## **❓ Questions/Issues?**

1. **Dependency Issues**: The npm modules seem corrupted - may need fresh clone or different Node version
2. **Testing**: Focus on visual testing in browser - unit tests are helpful but the UI behavior is key
3. **Performance**: Test with 10+ elements to ensure no performance regression
4. **Edge Cases**: Test with different connector types (element-to-element vs point-to-point)

**The fix is architecturally sound and surgical - it only prevents double processing without changing core functionality.**

Good luck! 🚀