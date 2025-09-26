// PanTool Debug Test Script
// Run this in the browser console when the canvas is loaded

console.log("=== PanTool Debug Test Started ===");

// Test 1: Check if PanTool component is rendered
function checkPanToolRendered() {
  const panToolElements = document.querySelectorAll('[data-testid*="pan"]');
  console.log("PanTool elements found:", panToolElements.length);

  // Check if the pan tool button exists in toolbar
  const panButton = document.querySelector('[data-testid="tool-pan"]');
  console.log("Pan button in toolbar:", panButton ? "Found" : "Not found");

  return panButton;
}

// Test 2: Simulate clicking the pan tool button
function testPanToolActivation() {
  const panButton = document.querySelector('[data-testid="tool-pan"]');
  if (panButton) {
    console.log("Clicking pan tool button...");
    panButton.click();

    // Check if it becomes active
    setTimeout(() => {
      const isActive = panButton.classList.contains("active");
      console.log("Pan tool button active after click:", isActive);

      // Check cursor style
      const container = document.querySelector(".konva-stage-container");
      if (container) {
        console.log("Container cursor style:", container.style.cursor);
      }
    }, 100);
  }
}

// Test 3: Check current selected tool in store
function checkSelectedTool() {
  // Try to access the store state
  if (window.useUnifiedCanvasStore) {
    const state = window.useUnifiedCanvasStore.getState();
    console.log(
      "Current selected tool from store:",
      state.selectedTool || state.ui?.selectedTool,
    );
  } else {
    console.log("Store not accessible from window");
  }
}

// Run all tests
console.log("Running PanTool debug tests...");
checkPanToolRendered();
testPanToolActivation();
checkSelectedTool();

console.log("=== PanTool Debug Test Complete ===");
console.log(
  "Now try manually clicking the pan tool button (hand icon) and dragging on the canvas",
);
