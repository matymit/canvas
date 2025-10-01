#!/usr/bin/env node
/**
 * Automated drag functionality test
 * Tests sticky notes, tables, and mindmaps after refactoring
 * Run this after opening the app in browser
 */

console.log("=== DRAG FUNCTIONALITY TEST ===\n");
console.log("This script should be run in the browser console.");
console.log("Copy and paste the following code into the browser DevTools console:\n");
console.log("---START BROWSER TEST CODE---\n");

console.log(`
// STEP 1: Get the stage
const stage = window.__DEBUG_STAGE__;
if (!stage) {
  console.error("❌ CRITICAL: Stage not found. Make sure you're in the canvas view.");
} else {
  console.log("✅ Stage found:", stage);
}

// STEP 2: Check store state
const store = window.__STORE__;
if (!store) {
  console.error("❌ CRITICAL: Store not found");
} else {
  console.log("✅ Store found");
  const state = store.getState();
  console.log("Current selected tool:", state?.ui?.selectedTool);
  
  if (state?.ui?.selectedTool === "pan") {
    console.error("❌ WARNING: Pan tool is active! Elements should NOT be draggable.");
    console.log("Switch to select tool first.");
  } else {
    console.log("✅ Pan tool is NOT active. Elements SHOULD be draggable.");
  }
}

// STEP 3: Find all rendered elements
console.log("\n=== Checking Rendered Elements ===");

const stickyNotes = stage?.find('[nodeType=sticky-note]') || [];
const tables = stage?.find('.table-group') || [];
const mindmapNodes = stage?.find('[nodeType=mindmap-node]') || [];

console.log(\`Found \${stickyNotes.length} sticky notes\`);
console.log(\`Found \${tables.length} tables\`);
console.log(\`Found \${mindmapNodes.length} mindmap nodes\`);

// STEP 4: Check draggable properties
console.log("\n=== Draggable Property Check ===");

const checkDraggable = (elements, type) => {
  if (elements.length === 0) {
    console.log(\`ℹ️ No \${type} elements found. Add some to test.\`);
    return;
  }
  
  elements.forEach((element, index) => {
    const id = element.id();
    const draggable = element.draggable();
    const listening = element.listening();
    const layer = element.getLayer()?.name();
    
    console.log(\`\${type} #\${index + 1} (id: \${id}):\`);
    console.log(\`  - draggable: \${draggable}\`);
    console.log(\`  - listening: \${listening}\`);
    console.log(\`  - layer: \${layer}\`);
    
    if (!draggable) {
      console.error(\`  ❌ NOT DRAGGABLE! This is the bug.\`);
    } else {
      console.log(\`  ✅ Draggable is true\`);
    }
  });
};

checkDraggable(stickyNotes, "Sticky Note");
checkDraggable(tables, "Table");
checkDraggable(mindmapNodes, "Mindmap Node");

// STEP 5: Check if store hook is working
console.log("\n=== Store Hook Test ===");

if (store) {
  const state = store.getState();
  const isPanToolActive = state?.ui?.selectedTool === "pan";
  console.log("Store value for isPanToolActive:", isPanToolActive);
  console.log("Expected draggable value:", !isPanToolActive);
}

// STEP 6: Summary
console.log("\n=== TEST SUMMARY ===");
console.log("If draggable=false but pan tool is NOT active, that's the bug.");
console.log("Elements should be draggable when selectedTool !== 'pan'");
console.log("\nManual test: Try dragging each element type:");
console.log("1. Add a sticky note, try to drag it");
console.log("2. Add a table, try to drag it");  
console.log("3. Add a mindmap node, try to drag it");
console.log("\nIf they don't move, the bug is confirmed.");
`);

console.log("\n---END BROWSER TEST CODE---\n");
console.log("After pasting the code, manually test dragging each element type.");
console.log("Report results back.");
