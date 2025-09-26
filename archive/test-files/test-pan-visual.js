// Test script to add visual elements to canvas for testing pan functionality
// Run this in browser console when canvas is loaded

console.log("=== Adding test elements for pan visualization ===");

// Get store state
const store = window.useUnifiedCanvasStore?.getState();
if (!store) {
  console.error("Store not accessible");
} else {
  console.log("Store accessible, adding test elements...");

  // Add a few test sticky notes to create visual reference points
  const testElements = [
    {
      id: "test-pan-1",
      type: "sticky-note",
      x: 100,
      y: 100,
      width: 150,
      height: 150,
      text: "Pan Test 1",
      color: "#FDE68A",
    },
    {
      id: "test-pan-2",
      type: "sticky-note",
      x: 400,
      y: 200,
      width: 150,
      height: 150,
      text: "Pan Test 2",
      color: "#FCA5A5",
    },
    {
      id: "test-pan-3",
      type: "sticky-note",
      x: 700,
      y: 300,
      width: 150,
      height: 150,
      text: "Pan Test 3",
      color: "#A7F3D0",
    },
  ];

  // Use withUndo to add elements
  if (store.history?.withUndo) {
    store.history.withUndo("Add pan test elements", () => {
      testElements.forEach((element) => {
        store.element?.addElement?.(element);
      });
    });
  } else {
    // Fallback direct addition
    testElements.forEach((element) => {
      store.element?.addElement?.(element);
    });
  }

  console.log(
    "Test elements added. Now try panning with the pan tool - you should see these sticky notes move!",
  );
}

console.log("=== Test script complete ===");
