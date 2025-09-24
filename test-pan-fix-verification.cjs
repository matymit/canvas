// Simple test to verify pan tool fix
const { chromium } = require("playwright");

(async () => {
  console.log("🔧 Testing Pan Tool Fix...");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto("http://localhost:1421");
    console.log("✅ App loaded successfully");

    // Wait for canvas to be ready
    await page.waitForSelector(".konva-stage-container", { timeout: 10000 });
    console.log("✅ Canvas container found");

    // Check if pan tool button exists
    const panButton = await page
      .locator('button[title="Pan tool"], [data-tool="pan"]')
      .first();
    const panButtonExists = (await panButton.count()) > 0;

    if (panButtonExists) {
      console.log("✅ Pan tool button found");
      await panButton.click();
      console.log("✅ Pan tool selected");

      // Wait a moment for the tool to activate
      await page.waitForTimeout(500);

      // Check if cursor changed to grab
      const canvasContainer = await page.locator(".konva-stage-container");
      const cursorStyle = await canvasContainer.evaluate(
        (el) => window.getComputedStyle(el).cursor,
      );

      if (cursorStyle.includes("grab") || cursorStyle.includes("move")) {
        console.log("✅ Cursor changed correctly:", cursorStyle);
      } else {
        console.log("⚠️  Cursor not changed as expected:", cursorStyle);
      }

      // Test viewport functionality via console
      const viewportTest = await page.evaluate(() => {
        try {
          const store = window.useUnifiedCanvasStore?.getState?.();
          if (!store) return { error: "Store not found" };

          const initialViewport = {
            x: store.viewport?.x || 0,
            y: store.viewport?.y || 0,
            scale: store.viewport?.scale || 1,
          };

          // Test setPan
          store.viewport?.setPan?.(100, 50);

          // Wait a moment for state to update
          return new Promise((resolve) => {
            setTimeout(() => {
              const newStore = window.useUnifiedCanvasStore?.getState?.();
              const newViewport = {
                x: newStore?.viewport?.x || 0,
                y: newStore?.viewport?.y || 0,
                scale: newStore?.viewport?.scale || 1,
              };

              resolve({
                initial: initialViewport,
                new: newViewport,
                success: newViewport.x === 100 && newViewport.y === 50,
              });
            }, 200);
          });
        } catch (error) {
          return { error: error.message };
        }
      });

      if (viewportTest.error) {
        console.log("❌ Viewport test failed:", viewportTest.error);
      } else {
        console.log("✅ Viewport test results:");
        console.log("   Initial:", viewportTest.initial);
        console.log("   New:", viewportTest.new);
        console.log("   Success:", viewportTest.success ? "✅" : "❌");
      }
    } else {
      console.log("❌ Pan tool button not found");
    }

    console.log("\n🎯 MANUAL VERIFICATION NEEDED:");
    console.log("1. Try dragging the canvas with the pan tool");
    console.log("2. Check if canvas moves smoothly");
    console.log("3. Verify no infinite console messages");
    console.log("4. Test switching between tools");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    await browser.close();
  }
})();
