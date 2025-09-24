// Manual Pan Tool Test Script
// Copy and paste this into the browser console at http://localhost:1421

console.log("🧪 Manual Pan Tool Test");
console.log("========================");

async function testPanTool() {
  // Check if store and stage are available
  const store = window.unifiedCanvasStore;
  const stage = window.konvaStage;

  if (!store || !stage) {
    console.error("❌ Store or stage not found. Make sure the app is loaded.");
    return;
  }

  console.log("✅ Store and stage found");

  // Get initial state
  const viewport = store.getState().viewport;
  console.log("📍 Initial viewport:", {
    x: viewport.x,
    y: viewport.y,
    scale: viewport.scale,
  });

  // Test 1: Basic setPan functionality
  console.log("\n📋 Test 1: Basic setPan functionality");
  console.log("Setting viewport to (50, 50)...");

  viewport.setPan(50, 50);

  // Wait for state update
  await new Promise((resolve) => setTimeout(resolve, 100));

  const updatedViewport = store.getState().viewport;
  console.log("📍 Updated viewport:", {
    x: updatedViewport.x,
    y: updatedViewport.y,
    scale: updatedViewport.scale,
  });

  if (updatedViewport.x === 50 && updatedViewport.y === 50) {
    console.log("✅ setPan works correctly");
  } else {
    console.log("❌ setPan failed");
    return;
  }

  // Test 2: Stage synchronization
  console.log("\n📋 Test 2: Stage synchronization");

  const layers = stage.getChildren();
  console.log("📍 Stage layers position:");
  let allLayersSynced = true;

  layers.forEach((layer, index) => {
    const pos = layer.position();
    console.log(`  Layer ${index}: (${pos.x}, ${pos.y})`);
    if (pos.x !== 50 || pos.y !== 50) {
      allLayersSynced = false;
    }
  });

  if (allLayersSynced) {
    console.log("✅ All stage layers synchronized correctly");
  } else {
    console.log("❌ Stage layers not synchronized");
    return;
  }

  // Test 3: Pan tool activation
  console.log("\n📋 Test 3: Pan tool activation");

  console.log("Switching to pan tool...");
  store.getState().setSelectedTool("pan");

  // Wait for tool switch
  await new Promise((resolve) => setTimeout(resolve, 100));

  const currentTool =
    store.getState().selectedTool || store.getState().ui?.selectedTool;
  if (currentTool === "pan") {
    console.log("✅ Pan tool activated successfully");
  } else {
    console.log("❌ Pan tool activation failed");
    return;
  }

  // Test 4: Viewport persistence
  console.log("\n📋 Test 4: Viewport persistence");

  console.log("Switching tools to test persistence...");
  store.getState().setSelectedTool("select");
  await new Promise((resolve) => setTimeout(resolve, 50));
  store.getState().setSelectedTool("pan");
  await new Promise((resolve) => setTimeout(resolve, 50));

  const finalViewport = store.getState().viewport;
  console.log("📍 Final viewport after tool switches:", {
    x: finalViewport.x,
    y: finalViewport.y,
  });

  if (finalViewport.x === 50 && finalViewport.y === 50) {
    console.log("✅ Viewport position persisted through tool switches");
  } else {
    console.log("❌ Viewport position not persisted");
    return;
  }

  // Test 5: Reset functionality
  console.log("\n📋 Test 5: Reset functionality");

  console.log("Resetting viewport...");
  viewport.reset();

  await new Promise((resolve) => setTimeout(resolve, 100));

  const resetViewport = store.getState().viewport;
  console.log("📍 Reset viewport:", {
    x: resetViewport.x,
    y: resetViewport.y,
    scale: resetViewport.scale,
  });

  if (resetViewport.x === 0 && resetViewport.y === 0) {
    console.log("✅ Viewport reset works correctly");
  } else {
    console.log("❌ Viewport reset failed");
    return;
  }

  console.log("\n🎉 All tests passed! Pan tool fix is working correctly.");
  console.log("\n📝 Manual testing instructions:");
  console.log("1. Select pan tool (hand icon)");
  console.log("2. Click and drag on the canvas");
  console.log("3. Verify smooth panning");
  console.log("4. Switch to other tools and back to pan");
  console.log("5. Verify panning still works");
}

// Run the test
testPanTool().catch(console.error);
