// Test script to verify drag functionality after refactoring
// Run with: node test-drag-functionality.cjs

console.log("=== DRAG FUNCTIONALITY TEST ===\n");

console.log("Testing sticky notes, tables, and mindmaps drag after refactoring\n");

console.log("Key checks:");
console.log("1. StickyRenderingEngine.createStickyGroup() - draggable: !isPanToolActive()");
console.log("2. StickyRenderingEngine.updateStickyGroup() - group.draggable(!isPanToolActive())");
console.log("3. TableRenderingEngine.ensureGroup() - draggable: !isPanToolActive");
console.log("4. TableRenderingEngine.render() - g.draggable(!isPanToolActive)");
console.log("5. MindmapNodeRenderer.renderNode() - draggable: !isPanToolActive");
console.log("");

console.log("Expected behavior:");
console.log("- When selectedTool !== 'pan': draggable = true");
console.log("- When selectedTool === 'pan': draggable = false");
console.log("");

console.log("Potential issues to check:");
console.log("1. Is store.getState() returning correct ui.selectedTool?");
console.log("2. Is isPanToolActive() callback being called correctly?");
console.log("3. Are groups being added to correct layer?");
console.log("4. Are event handlers preventing drag?");
console.log("5. Is listening property set correctly?");
console.log("");

console.log("Manual test steps:");
console.log("1. Open canvas in browser");
console.log("2. Select sticky-note tool");
console.log("3. Add a sticky note");
console.log("4. Try to drag it immediately");
console.log("5. Check browser console for errors");
console.log("6. Check if group.draggable() returns true");
console.log("7. Repeat for table and mindmap");
console.log("");

console.log("DEBUG COMMAND to run in browser console:");
console.log("const stage = window.__DEBUG_STAGE__;");
console.log("const groups = stage.find('.table-group, [nodeType=sticky-note], [nodeType=mindmap-node]');");
console.log("groups.forEach(g => console.log({ id: g.id(), draggable: g.draggable(), listening: g.listening() }));");
console.log("");

console.log("If draggable=false but should be true, check:");
console.log("- store.getState().ui.selectedTool value");
console.log("- isPanToolActive() return value");
console.log("- When draggable is being set (creation vs update)");
