/**
 * Direct Pan Tool Issue Diagnosis
 *
 * This script helps identify the actual pan tool problem by checking
 * the real-time state and behavior of the application.
 *
 * Usage:
 * 1. Open http://localhost:1420 in browser
 * 2. Open DevTools (F12)
 * 3. Paste this entire script into console
 * 4. Run diagnosePanIssues()
 */

function diagnosePanIssues() {
  console.clear();
  console.log("🔍 PAN TOOL ISSUE DIAGNOSIS STARTED");
  console.log("=====================================");

  // 1. Basic environment check
  console.log("1. ENVIRONMENT CHECK");
  console.log("   Page URL:", window.location.href);
  console.log("   React available:", typeof React !== "undefined");
  console.log("   Konva available:", typeof Konva !== "undefined");
  console.log(
    "   Canvas container exists:",
    !!document.querySelector(".konvajs-content"),
  );

  // 2. Check pan tool button
  console.log("\n2. PAN TOOL BUTTON CHECK");
  const panButton = findPanToolButton();
  if (panButton) {
    console.log("   ✅ Pan tool button found:", panButton);
    console.log("   Button text:", panButton.textContent);
    console.log("   Button title:", panButton.title);
    console.log("   Button classes:", panButton.className);
    console.log("   Is active:", isButtonActive(panButton));

    // Try to activate it
    console.log("   Attempting to activate pan tool...");
    panButton.click();
    setTimeout(() => {
      console.log("   Is active after click:", isButtonActive(panButton));
    }, 100);
  } else {
    console.log("   ❌ Pan tool button NOT FOUND");
    console.log(
      "   Available buttons:",
      Array.from(document.querySelectorAll("button")).map((btn) => ({
        text: btn.textContent,
        title: btn.title,
        class: btn.className,
      })),
    );
  }

  // 3. Check canvas and stage
  console.log("\n3. CANVAS & STAGE CHECK");
  const canvasContainer = document.querySelector(".konvajs-content");
  if (canvasContainer) {
    console.log("   ✅ Canvas container found");
    console.log(
      "   Container cursor:",
      window.getComputedStyle(canvasContainer).cursor,
    );

    // Look for Konva stage
    const stage = findKonvaStage();
    if (stage) {
      console.log("   ✅ Konva stage found");
      console.log("   Stage position:", { x: stage.x(), y: stage.y() });
      console.log("   Stage scale:", { x: stage.scaleX(), y: stage.scaleY() });
      console.log("   Stage size:", {
        width: stage.width(),
        height: stage.height(),
      });

      // Check layers
      const layers = stage.getChildren();
      console.log("   Layers count:", layers.length);
      layers.forEach((layer, index) => {
        console.log(`   Layer ${index}:`, {
          name: layer.name(),
          visible: layer.visible(),
          position: { x: layer.x(), y: layer.y() },
          listening: layer.listening(),
        });
      });
    } else {
      console.log("   ❌ Konva stage not found");
    }
  } else {
    console.log("   ❌ Canvas container not found");
  }

  // 4. Check store integration
  console.log("\n4. STORE INTEGRATION CHECK");
  checkStoreIntegration();

  // 5. Set up event monitoring
  console.log("\n5. EVENT MONITORING SETUP");
  setupEventMonitoring();

  // 6. Check for errors
  console.log("\n6. ERROR CHECK");
  checkForErrors();

  console.log("\n🔍 DIAGNOSIS SETUP COMPLETE");
  console.log("=====================================");
  console.log("Instructions:");
  console.log("1. Try to pan the canvas by clicking and dragging");
  console.log("2. Watch the console for event logs and errors");
  console.log("3. Check if the canvas content actually moves");
  console.log("4. Run checkCurrentState() to see current state");
}

// Helper functions
function findPanToolButton() {
  // Try multiple selectors to find the pan tool button
  const selectors = [
    '[data-testid="tool-pan"]',
    '[title="Pan"]',
    '[aria-label*="pan" i]',
    'button[title*="Pan" i]',
    '.tool-button[title*="Pan" i]',
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) return button;
  }

  // Fallback: look for button with pan-related text
  const buttons = Array.from(document.querySelectorAll("button"));
  return buttons.find(
    (btn) =>
      btn.textContent?.toLowerCase().includes("pan") ||
      btn.title?.toLowerCase().includes("pan") ||
      btn.getAttribute("aria-label")?.toLowerCase().includes("pan"),
  );
}

function isButtonActive(button) {
  return (
    button.classList.contains("active") ||
    button.getAttribute("aria-pressed") === "true" ||
    button.hasAttribute("data-active") ||
    button.classList.contains("selected")
  );
}

function findKonvaStage() {
  // Try to find Konva stage through various means
  if (typeof Konva !== "undefined") {
    // Look for stages in the global Konva registry
    const stages = Konva.stages;
    if (stages && stages.length > 0) {
      return stages[0];
    }
  }

  // Try to find stage through DOM attributes
  const stageElements = document.querySelectorAll("[data-konva-stage]");
  if (stageElements.length > 0) {
    // This is a bit hacky, but might work
    return stageElements[0].konvaNode;
  }

  return null;
}

function checkStoreIntegration() {
  console.log("   Checking store accessibility...");

  // Try different ways to access the store
  const storeAccessors = [
    () => window.__UNIFIED_CANVAS_STORE__,
    () => window.useUnifiedCanvasStore,
    () => document.querySelector("[data-store]")?.__store,
    () => window.__STATE__?.unifiedCanvas,
    () => window.reduxStore?.getState()?.unifiedCanvas,
  ];

  let storeFound = false;
  for (const accessor of storeAccessors) {
    try {
      const store = accessor();
      if (store) {
        console.log("   ✅ Store found via accessor");
        console.log("   Store type:", typeof store);
        console.log("   Store methods:", Object.getOwnPropertyNames(store));

        // Try to get state
        if (typeof store.getState === "function") {
          const state = store.getState();
          console.log("   Store state keys:", Object.keys(state));
          if (state.viewport) {
            console.log("   Viewport state:", state.viewport);
          }
        }

        storeFound = true;
        break;
      }
    } catch (error) {
      console.log("   Store accessor failed:", error.message);
    }
  }

  if (!storeFound) {
    console.log("   ❌ Store not accessible through any known method");
    console.log("   This might indicate a store integration issue");
  }
}

function setupEventMonitoring() {
  let eventCount = 0;
  const events = ["pointerdown", "pointermove", "pointerup", "click"];

  events.forEach((eventName) => {
    const handler = (e) => {
      eventCount++;
      console.log(`🖱️  ${eventName.toUpperCase()} #${eventCount}:`, {
        x: e.clientX,
        y: e.clientY,
        target: e.target.tagName,
        button: e.button,
        isPrimary: e.isPrimary,
        timestamp: Date.now(),
      });
    };

    document.addEventListener(eventName, handler, { capture: true });
    console.log(`   📝 Monitoring ${eventName} events`);
  });

  // Monitor console errors
  const originalError = console.error;
  console.error = function (...args) {
    console.log("🚨 CONSOLE ERROR:", args);
    originalError.apply(console, args);
  };
}

function checkForErrors() {
  // Check for any error elements or indicators
  const errorElements = document.querySelectorAll(
    '[class*="error"], [class*="warning"]',
  );
  if (errorElements.length > 0) {
    console.log("   Found error/warning elements:", errorElements.length);
    errorElements.forEach((el, index) => {
      console.log(`   Error element ${index + 1}:`, {
        text: el.textContent,
        class: el.className,
        visible: el.offsetParent !== null,
      });
    });
  } else {
    console.log("   No error elements found");
  }

  // Check for any global error indicators
  if (window.__ERRORS__) {
    console.log("   Global errors found:", window.__ERRORS__);
  }
}

// Additional diagnostic functions
function checkCurrentState() {
  console.log("🔍 CURRENT STATE CHECK");
  console.log("====================");

  // Check pan tool button
  const panButton = findPanToolButton();
  if (panButton) {
    console.log("Pan tool active:", isButtonActive(panButton));
  }

  // Check stage
  const stage = findKonvaStage();
  if (stage) {
    console.log("Stage position:", { x: stage.x(), y: stage.y() });
    console.log("Stage scale:", { x: stage.scaleX(), y: stage.scaleY() });

    // Check layers
    const layers = stage.getChildren();
    layers.forEach((layer, index) => {
      console.log(`Layer ${index} position:`, { x: layer.x(), y: layer.y() });
    });
  }

  // Check store
  checkStoreIntegration();

  console.log("====================");
}

function simulatePanInteraction() {
  console.log("🎭 SIMULATING PAN INTERACTION");

  const canvas = document.querySelector(".konvajs-content");
  if (!canvas) {
    console.log("❌ Canvas not found for simulation");
    return;
  }

  const events = [
    new PointerEvent("pointerdown", {
      clientX: 200,
      clientY: 200,
      button: 0,
      isPrimary: true,
      bubbles: true,
    }),
    new PointerEvent("pointermove", {
      clientX: 250,
      clientY: 250,
      button: 0,
      isPrimary: true,
      bubbles: true,
    }),
    new PointerEvent("pointerup", {
      clientX: 250,
      clientY: 250,
      button: 0,
      isPrimary: true,
      bubbles: true,
    }),
  ];

  events.forEach((event, index) => {
    setTimeout(() => {
      canvas.dispatchEvent(event);
      console.log(
        `🎭 Dispatched ${event.type} at (${event.clientX}, ${event.clientY})`,
      );
    }, index * 200);
  });
}

// Export functions for global access
window.diagnosePanIssues = diagnosePanIssues;
window.checkCurrentState = checkCurrentState;
window.simulatePanInteraction = simulatePanInteraction;

console.log("🔧 Pan tool diagnosis functions loaded");
console.log("Run diagnosePanIssues() to start diagnosis");
