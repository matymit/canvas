// Simple Pan Tool Debug Script
// Run this in the browser console when the canvas is loaded

console.log("🔍 Starting Pan Tool Debug Analysis...");

// 1. Check if we can access the store
function checkStoreAccess() {
  console.log("1. Checking store access...");

  if (window.useUnifiedCanvasStore) {
    console.log("✅ useUnifiedCanvasStore found globally");

    const store = window.useUnifiedCanvasStore.getState();
    console.log("Store state:", {
      hasViewport: !!store.viewport,
      viewport: store.viewport,
      selectedTool: store.selectedTool || store.ui?.selectedTool,
      hasElements: store.elements && store.elements.size > 0,
    });

    // Test viewport methods
    if (store.viewport) {
      console.log("Viewport methods:", {
        setPan: typeof store.viewport.setPan,
        setScale: typeof store.viewport.setScale,
        zoomAt: typeof store.viewport.zoomAt,
      });

      // Test setPan
      const originalX = store.viewport.x;
      const originalY = store.viewport.y;

      console.log("Original viewport position", {
        x: originalX,
        y: originalY,
      });

      try {
        store.viewport.setPan(originalX + 10, originalY + 10);

        setTimeout(() => {
          const newState = window.useUnifiedCanvasStore.getState();
          console.log("After setPan", {
            x: newState.viewport.x,
            y: newState.viewport.y,
          });

          if (
            newState.viewport.x === originalX + 10 &&
            newState.viewport.y === originalY + 10
          ) {
            console.log("✅ viewport.setPan works correctly");
          } else {
            console.log("❌ viewport.setPan failed");
          }
        }, 100);
      } catch (error) {
        console.log("❌ Error calling viewport.setPan:", error);
      }
    } else {
      console.log("❌ No viewport found in store");
    }
  } else {
    console.log("❌ useUnifiedCanvasStore not found globally");
  }
}

// 2. Check Konva stage
function checkKonvaStage() {
  console.log("2. Checking Konva stage...");

  if (window.konvaStage) {
    console.log("✅ Konva stage found globally");

    const stage = window.konvaStage;
    console.log("Stage info:", {
      width: stage.width(),
      height: stage.height(),
      x: stage.x(),
      y: stage.y(),
      scaleX: stage.scaleX(),
      scaleY: stage.scaleY(),
      draggable: stage.draggable(),
      layerCount: stage.getChildren().length,
    });

    // Check layers
    const layers = stage.getChildren();
    console.log(
      "Layers:",
      layers.map((layer, i) => ({
        index: i,
        name: layer.className(),
        listening: layer.listening(),
        position: { x: layer.x(), y: layer.y() },
      })),
    );
  } else {
    console.log("❌ Konva stage not found globally");
  }
}

// 3. Check for pan tool events
function checkPanToolEvents() {
  console.log("3. Checking pan tool events...");

  if (!window.konvaStage) {
    console.log("❌ Cannot check events - no Konva stage");
    return;
  }

  const stage = window.konvaStage;

  // Check if pan tool events are already attached
  const eventListeners = stage.eventListeners;
  const panEvents = eventListeners.filter(
    (listener) => listener.name && listener.name.includes("pantool"),
  );

  console.log("Found pan tool event listeners", {
    count: panEvents.length,
    listeners: panEvents,
  });

  if (panEvents.length === 0) {
    console.log("❌ No pan tool event listeners found");
    console.log(
      "Available event listeners:",
      eventListeners.map((l) => l.name),
    );
  } else {
    console.log("✅ Pan tool event listeners found");
  }
}

// 4. Test manual panning
function testManualPanning() {
  console.log("4. Testing manual panning...");

  if (!window.useUnifiedCanvasStore || !window.konvaStage) {
    console.log("❌ Cannot test manual panning - store or stage missing");
    return;
  }

  const store = window.useUnifiedCanvasStore;
  const stage = window.konvaStage;

  // Get initial positions
  const initialStorePos = {
    x: store.getState().viewport.x,
    y: store.getState().viewport.y,
  };
  const initialStagePos = { x: stage.x(), y: stage.y() };

  console.log("Initial positions:", {
    store: initialStorePos,
    stage: initialStagePos,
  });

  // Manually trigger pan
  try {
    store
      .getState()
      .viewport.setPan(initialStorePos.x + 20, initialStorePos.y + 20);

    setTimeout(() => {
      const newStorePos = {
        x: store.getState().viewport.x,
        y: store.getState().viewport.y,
      };
      const newStagePos = { x: stage.x(), y: stage.y() };

      console.log("After manual pan:", {
        store: newStorePos,
        stage: newStagePos,
        storeChanged:
          newStorePos.x !== initialStorePos.x ||
          newStorePos.y !== initialStorePos.y,
        stageSynced:
          Math.abs(newStagePos.x - newStorePos.x) < 1 &&
          Math.abs(newStagePos.y - newStorePos.y) < 1,
      });
    }, 200);
  } catch (error) {
    console.log("❌ Error during manual pan test:", error);
  }
}

// 5. Check if pan tool is active
function checkPanToolActive() {
  console.log("5. Checking if pan tool is active...");

  if (window.useUnifiedCanvasStore) {
    const store = window.useUnifiedCanvasStore.getState();
    const selectedTool = store.selectedTool || store.ui?.selectedTool;

    console.log("Selected tool:", selectedTool);

    if (selectedTool === "pan") {
      console.log("✅ Pan tool is active");
    } else {
      console.log("❌ Pan tool is not active, current tool:", selectedTool);
      console.log("Attempting to switch to pan tool...");

      try {
        store.setSelectedTool("pan");
        setTimeout(() => {
          const newTool =
            window.useUnifiedCanvasStore.getState().selectedTool ||
            window.useUnifiedCanvasStore.getState().ui?.selectedTool;
          console.log("After switching, selected tool:", newTool);
        }, 100);
      } catch (error) {
        console.log("❌ Error switching to pan tool:", error);
      }
    }
  } else {
    console.log("❌ Cannot check tool - no store access");
  }
}

// 6. Monitor viewport changes
function monitorViewportChanges() {
  console.log("6. Setting up viewport change monitoring...");

  if (!window.useUnifiedCanvasStore) {
    console.log("❌ Cannot monitor - no store access");
    return;
  }

  let lastViewport = null;

  const checkInterval = setInterval(() => {
    const store = window.useUnifiedCanvasStore.getState();
    const currentViewport = {
      x: store.viewport.x,
      y: store.viewport.y,
      scale: store.viewport.scale,
    };

    if (
      lastViewport &&
      (lastViewport.x !== currentViewport.x ||
        lastViewport.y !== currentViewport.y ||
        lastViewport.scale !== currentViewport.scale)
    ) {
      console.log("🔄 Viewport changed:", {
        from: lastViewport,
        to: currentViewport,
        delta: {
          x: currentViewport.x - lastViewport.x,
          y: currentViewport.y - lastViewport.y,
          scale: currentViewport.scale - lastViewport.scale,
        },
      });
    }

    lastViewport = currentViewport;
  }, 100);

  // Stop monitoring after 30 seconds
  setTimeout(() => {
    clearInterval(checkInterval);
    console.log("🛑 Viewport monitoring stopped");
  }, 30000);
}

// Run all checks
function runAllChecks() {
  console.log("🚀 Running complete pan tool diagnostic...");

  checkStoreAccess();
  setTimeout(() => checkKonvaStage(), 500);
  setTimeout(() => checkPanToolEvents(), 1000);
  setTimeout(() => checkPanToolActive(), 1500);
  setTimeout(() => testManualPanning(), 2000);
  setTimeout(() => monitorViewportChanges(), 2500);

  console.log("📋 Diagnostic complete. Check console for results.");
}

// Export functions to global scope
window.panToolDebug = {
  checkStoreAccess,
  checkKonvaStage,
  checkPanToolEvents,
  testManualPanning,
  checkPanToolActive,
  monitorViewportChanges,
  runAllChecks,
};

console.log("🔧 Pan tool debug functions available at window.panToolDebug");
console.log("💡 Run window.panToolDebug.runAllChecks() to start diagnostics");
