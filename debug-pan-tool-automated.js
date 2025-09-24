import puppeteer from "puppeteer";

async function debugPanTool() {
  console.log("🔍 Starting automated Pan Tool debug analysis...");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // Listen for console messages
  page.on("console", (msg) => {
    console.log(`Browser: ${msg.text()}`);
  });

  page.on("pageerror", (error) => {
    console.error(`Page Error: ${error.message}`);
  });

  try {
    // Navigate to the main canvas app
    console.log("📝 Navigating to canvas app...");
    await page.goto("http://localhost:1420/");

    // Wait for canvas to load
    console.log("⏳ Waiting for canvas to load...");
    await page.waitForSelector('[data-testid="konva-stage-container"]', {
      timeout: 10000,
    });

    // Check if pan tool is available
    console.log("🔍 Checking pan tool availability...");
    const panToolExists = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="tool-pan"]');
    });

    console.log(`Pan tool button exists: ${panToolExists}`);

    // Switch to pan tool
    if (panToolExists) {
      console.log("🔄 Switching to pan tool...");
      await page.click('[data-testid="tool-pan"]');

      // Wait a moment for tool switch
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if pan tool is active
      const isPanToolActive = await page.evaluate(() => {
        const store = window.useUnifiedCanvasStore?.getState();
        const selectedTool = store?.selectedTool || store?.ui?.selectedTool;
        return selectedTool === "pan";
      });

      console.log(`Pan tool is active: ${isPanToolActive}`);

      // Test store access
      console.log("🧪 Testing store access...");
      const storeAccess = await page.evaluate(() => {
        try {
          const store = window.useUnifiedCanvasStore?.getState();
          if (!store) return { success: false, error: "Store not found" };

          return {
            success: true,
            hasViewport: !!store.viewport,
            viewport: store.viewport
              ? {
                  x: store.viewport.x,
                  y: store.viewport.y,
                  scale: store.viewport.scale,
                }
              : null,
            hasSetPan: typeof store.viewport?.setPan === "function",
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      console.log("Store access result:", storeAccess);

      // Test Konva stage access
      console.log("🎭 Testing Konva stage access...");
      const stageAccess = await page.evaluate(() => {
        try {
          const stage = window.konvaStage;
          if (!stage) return { success: false, error: "Stage not found" };

          return {
            success: true,
            width: stage.width(),
            height: stage.height(),
            x: stage.x(),
            y: stage.y(),
            scale: stage.scaleX(),
            layerCount: stage.getChildren().length,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      console.log("Stage access result:", stageAccess);

      // Test viewport.setPan method
      if (storeAccess.success && storeAccess.hasSetPan) {
        console.log("🔄 Testing viewport.setPan method...");
        const setPanTest = await page.evaluate(() => {
          try {
            const store = window.useUnifiedCanvasStore.getState();
            const originalX = store.viewport.x;
            const originalY = store.viewport.y;

            store.viewport.setPan(originalX + 50, originalY + 50);

            // Wait a moment for state update
            return new Promise((resolve) => {
              setTimeout(() => {
                const newState = window.useUnifiedCanvasStore.getState();
                resolve({
                  success: true,
                  original: { x: originalX, y: originalY },
                  new: { x: newState.viewport.x, y: newState.viewport.y },
                  changed:
                    newState.viewport.x !== originalX ||
                    newState.viewport.y !== originalY,
                });
              }, 200);
            });
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        console.log("setPan test result:", setPanTest);
      }

      // Test stage sync
      if (storeAccess.success && stageAccess.success) {
        console.log("🔄 Testing stage-viewport sync...");
        const syncTest = await page.evaluate(() => {
          try {
            const store = window.useUnifiedCanvasStore.getState();
            const stage = window.konvaStage;

            const storeViewport = { x: store.viewport.x, y: store.viewport.y };
            const stagePos = { x: stage.x(), y: stage.y() };

            return {
              success: true,
              storeViewport,
              stagePos,
              inSync:
                Math.abs(storeViewport.x - stagePos.x) < 1 &&
                Math.abs(storeViewport.y - stagePos.y) < 1,
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        console.log("Stage sync test result:", syncTest);
      }

      // Test actual panning by simulating mouse events
      console.log("🖱️ Testing actual panning with mouse events...");
      const panTest = await page.evaluate(() => {
        return new Promise((resolve) => {
          try {
            const stage = window.konvaStage;
            const container = stage.container();
            const rect = container.getBoundingClientRect();

            // Get initial viewport
            const store = window.useUnifiedCanvasStore.getState();
            const initialViewport = {
              x: store.viewport.x,
              y: store.viewport.y,
            };

            // Simulate pan start
            const startX = rect.left + rect.width / 2;
            const startY = rect.top + rect.height / 2;

            const mouseDownEvent = new MouseEvent("pointerdown", {
              clientX: startX,
              clientY: startY,
              button: 0,
              bubbles: true,
            });

            container.dispatchEvent(mouseDownEvent);

            // Simulate pan move
            setTimeout(() => {
              const mouseMoveEvent = new MouseEvent("pointermove", {
                clientX: startX + 100,
                clientY: startY + 50,
                button: 0,
                bubbles: true,
              });

              container.dispatchEvent(mouseMoveEvent);

              // Simulate pan end
              setTimeout(() => {
                const mouseUpEvent = new MouseEvent("pointerup", {
                  clientX: startX + 100,
                  clientY: startY + 50,
                  button: 0,
                  bubbles: true,
                });

                container.dispatchEvent(mouseUpEvent);

                // Check final viewport
                setTimeout(() => {
                  const finalStore = window.useUnifiedCanvasStore.getState();
                  const finalViewport = {
                    x: finalStore.viewport.x,
                    y: finalStore.viewport.y,
                  };

                  resolve({
                    success: true,
                    initialViewport,
                    finalViewport,
                    panned:
                      finalViewport.x !== initialViewport.x ||
                      finalViewport.y !== initialViewport.y,
                    deltaX: finalViewport.x - initialViewport.x,
                    deltaY: finalViewport.y - initialViewport.y,
                  });
                }, 200);
              }, 100);
            }, 100);
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      });

      console.log("Actual pan test result:", panTest);

      // Check for event listeners
      console.log("🔍 Checking event listeners...");
      const eventListeners = await page.evaluate(() => {
        try {
          const stage = window.konvaStage;
          const listeners = stage.eventListeners || [];

          const panListeners = listeners.filter(
            (l) =>
              l.name && (l.name.includes("pantool") || l.name.includes("pan")),
          );

          return {
            totalListeners: listeners.length,
            panListeners: panListeners.length,
            panListenerNames: panListeners.map((l) => l.name),
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      console.log("Event listeners result:", eventListeners);
    } else {
      console.log("❌ Pan tool button not found");
    }

    console.log("✅ Automated debug analysis complete");
  } catch (error) {
    console.error("❌ Debug analysis failed:", error);
  } finally {
    // Keep browser open for manual inspection
    console.log("🌐 Browser kept open for manual inspection");
    // await browser.close();
  }
}

// Run the debug analysis
debugPanTool().catch(console.error);
