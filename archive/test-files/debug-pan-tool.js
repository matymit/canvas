/**
 * Pan Tool Debugging Script
 *
 * This script can be run in the browser console to debug pan tool functionality
 *
 * Instructions:
 * 1. Open http://localhost:1420 in your browser
 * 2. Open DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Run debugPanTool() to start debugging
 */

function debugPanTool() {
  console.log("=== PAN TOOL DEBUGGING STARTED ===");

  // Check if we're on the right page
  if (!window.location.href.includes("localhost:1420")) {
    console.error(
      "❌ Not on the Canvas app page. Please open http://localhost:1420",
    );
    return;
  }

  console.log("✅ Canvas app page loaded");

  // Check if React is available
  if (typeof React === "undefined") {
    console.error("❌ React not found");
    return;
  }
  console.log("✅ React is available");

  // Check if Konva is available
  if (typeof Konva === "undefined") {
    console.error("❌ Konva not found");
    return;
  }
  console.log("✅ Konva is available");

  // Check if we can find the canvas stage
  const stageElement = document.querySelector(".konvajs-content");
  if (!stageElement) {
    console.error("❌ Konva stage not found in DOM");
    return;
  }
  console.log("✅ Konva stage found in DOM");

  // Try to access the UnifiedCanvasStore
  let store;
  try {
    // This might not work depending on how the store is exposed
    store =
      window.__UNIFIED_CANVAS_STORE__ ||
      window.useUnifiedCanvasStore ||
      document.querySelector("[data-store]")?.__store;

    if (!store) {
      console.warn(
        "⚠️  Cannot access store directly, will check via React components",
      );
    } else {
      console.log("✅ Store accessible:", store);
    }
  } catch (error) {
    console.warn("⚠️  Cannot access store:", error.message);
  }

  // Check for pan tool button
  const panToolButton =
    document.querySelector('[data-testid="tool-pan"]') ||
    document.querySelector('[title="Pan"]') ||
    Array.from(document.querySelectorAll("button")).find(
      (btn) =>
        btn.textContent?.includes("Pan") ||
        btn.title?.includes("Pan") ||
        btn.getAttribute("aria-label")?.includes("Pan"),
    );

  if (!panToolButton) {
    console.error("❌ Pan tool button not found");
    console.log(
      "Available buttons:",
      Array.from(document.querySelectorAll("button")).map((btn) => ({
        text: btn.textContent,
        title: btn.title,
        "data-testid": btn.getAttribute("data-testid"),
      })),
    );
    return;
  }
  console.log("✅ Pan tool button found:", panToolButton);

  // Check if pan tool is already active
  const isActive =
    panToolButton.classList.contains("active") ||
    panToolButton.getAttribute("aria-pressed") === "true" ||
    panToolButton.hasAttribute("data-active");

  console.log("📍 Pan tool status", isActive ? "active" : "inactive");

  // Try to activate pan tool
  if (!isActive) {
    console.log("🔄 Attempting to activate pan tool...");
    panToolButton.click();

    // Check if it became active
    setTimeout(() => {
      const nowActive =
        panToolButton.classList.contains("active") ||
        panToolButton.getAttribute("aria-pressed") === "true" ||
        panToolButton.hasAttribute("data-active");

      if (nowActive) {
        console.log("✅ Pan tool activated successfully");
      } else {
        console.warn("⚠️  Pan tool activation may have failed");
      }
    }, 100);
  }

  // Check cursor changes
  setTimeout(() => {
    const canvasContainer =
      document.querySelector(".konvajs-content") ||
      document.querySelector("[data-canvas-container]");

    if (canvasContainer) {
      const cursor = window.getComputedStyle(canvasContainer).cursor;
  console.log("🎯 Canvas container cursor", cursor);

      if (cursor === "grab" || cursor === "grabbing") {
        console.log("✅ Cursor correctly set for pan tool");
      } else {
        console.warn("⚠️  Cursor not set correctly for pan tool");
      }
    } else {
      console.warn("⚠️  Cannot find canvas container to check cursor");
    }
  }, 200);

  // Set up event listeners to debug pan interactions
  let interactionCount = 0;
  const debugEvents = ["pointerdown", "pointermove", "pointerup"];

  debugEvents.forEach((eventName) => {
    const handler = (e) => {
      interactionCount++;
      console.log("🖱️  Pointer event", {
        eventName,
        interactionCount,
        x: e.clientX,
        y: e.clientY,
        target: e.target.tagName,
        button: e.button,
        isPrimary: e.isPrimary,
      });
    };

    document.addEventListener(eventName, handler, true);
  console.log("🔍 Added debug listener", eventName);
  });

  // Monitor console errors
  const originalError = console.error;
  console.error = function (...args) {
    originalError.apply(console, args);
    console.log("🚨 Console error detected:", args);
  };

  // Check viewport store after a delay
  setTimeout(() => {
    console.log("🔍 Checking viewport state...");

    // Try to get viewport state from various sources
    try {
      // Method 1: Check if store is globally accessible
      if (window.__UNIFIED_CANVAS_STORE__) {
        const state = window.__UNIFIED_CANVAS_STORE__.getState();
        console.log("📊 Viewport state from global store:", state?.viewport);
      }

      // Method 2: Check React component state (more complex)
      const root = document.querySelector("#root");
      if (root && root._reactRootContainer) {
        console.log(
          "🔍 React root found, but cannot easily access internal state",
        );
      }

      // Method 3: Check for any global state
      if (window.__STATE__) {
        console.log("📊 Global state found:", window.__STATE__);
      }
    } catch (error) {
      console.warn("⚠️  Cannot access viewport state:", error.message);
    }
  }, 1000);

  console.log("=== PAN TOOL DEBUGGING SETUP COMPLETE ===");
  console.log("📝 Instructions:");
  console.log("1. Try to pan the canvas by clicking and dragging");
  console.log("2. Watch the console for event logs and errors");
  console.log("3. Check if the canvas content moves");
  console.log("4. Look for any error messages");
  console.log("");
  console.log("🔧 Additional commands:");
  console.log("- checkViewportState(): Check current viewport state");
  console.log("- simulatePan(): Simulate pan interaction");
  console.log("- checkEventListeners(): Check attached event listeners");
}

// Additional helper functions
function checkViewportState() {
  console.log("🔍 Checking viewport state...");

  try {
    if (window.__UNIFIED_CANVAS_STORE__) {
      const state = window.__UNIFIED_CANVAS_STORE__.getState();
      console.log("📊 Viewport state:", state?.viewport);
    } else {
      console.warn("⚠️  Store not accessible");
    }
  } catch (error) {
    console.error("❌ Error checking viewport state:", error);
  }
}

function simulatePan() {
  console.log("🎭 Simulating pan interaction...");

  const canvas = document.querySelector(".konvajs-content");
  if (!canvas) {
    console.error("❌ Canvas not found");
    return;
  }

  // Create and dispatch pointer events
  const events = [
    new PointerEvent("pointerdown", {
      clientX: 100,
      clientY: 100,
      button: 0,
      isPrimary: true,
      bubbles: true,
    }),
    new PointerEvent("pointermove", {
      clientX: 150,
      clientY: 150,
      button: 0,
      isPrimary: true,
      bubbles: true,
    }),
    new PointerEvent("pointerup", {
      clientX: 150,
      clientY: 150,
      button: 0,
      isPrimary: true,
      bubbles: true,
    }),
  ];

  events.forEach((event, index) => {
    setTimeout(() => {
      canvas.dispatchEvent(event);
  console.log("🎭 Dispatched event", event.type);
    }, index * 100);
  });
}

function checkEventListeners() {
  console.log("🔍 Checking event listeners...");

  const canvas = document.querySelector(".konvajs-content");
  if (!canvas) {
    console.error("❌ Canvas not found");
    return;
  }

  // Note: This won't show all listeners due to browser security
  // but it's a basic check
  console.log("📋 Canvas element:", canvas);
  console.log("📋 Canvas has onclick:", typeof canvas.onclick === "function");
  console.log(
    "📋 Canvas has onpointerdown:",
    typeof canvas.onpointerdown === "function",
  );

  // Check for event listeners in a more comprehensive way
  const listeners =
    typeof getEventListeners === "function"
      ? getEventListeners(canvas)
      : "Not available in this browser";
  console.log("📋 Event listeners:", listeners);
}

// Export functions for global access
window.debugPanTool = debugPanTool;
window.checkViewportState = checkViewportState;
window.simulatePan = simulatePan;
window.checkEventListeners = checkEventListeners;

console.log("🔧 Pan tool debugging functions loaded");
console.log("Run debugPanTool() to start debugging");
