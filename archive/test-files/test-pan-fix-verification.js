import puppeteer from "puppeteer";

async function testPanToolFix() {
  console.log("🧪 Testing Pan Tool Fix...");

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // Navigate to the app
    await page.goto("http://localhost:1420");
    console.log("✅ Page loaded");

    // Wait for canvas to be ready
    await page.waitForSelector("canvas", { timeout: 10000 });
    console.log("✅ Canvas found");

    // Wait a bit more for everything to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get the canvas element
    const canvas = await page.$("canvas");
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error("Canvas bounding box not found");
    }

    console.log("📐 Canvas dimensions:", canvasBox);

    // Create a test element first (rectangle)
    console.log("🔧 Creating test rectangle...");

    // Switch to rectangle tool
    await page.click('[data-tool="rectangle"]');
    await page.waitForTimeout(500);

    // Draw a rectangle
    const startX = canvasBox.x + 100;
    const startY = canvasBox.y + 100;
    const endX = canvasBox.x + 200;
    const endY = canvasBox.y + 150;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    await page.waitForTimeout(1000);
    console.log("✅ Rectangle created");

    // Switch to select tool and select the rectangle
    await page.click('[data-tool="select"]');
    await page.waitForTimeout(500);

    // Click on the rectangle to select it
    await page.mouse.move(startX + 50, startY + 25);
    await page.mouse.down();
    await page.mouse.up();

    await page.waitForTimeout(500);
    console.log("✅ Rectangle selected");

    // Now test the pan tool
    console.log("🔍 Testing pan tool...");

    // Switch to pan tool
    await page.click('[data-tool="pan"]');
    await page.waitForTimeout(500);
    console.log("✅ Pan tool activated");

    // Get initial viewport position (from stage transform)
    const initialTransform = await page.evaluate(() => {
      const stage = window.figjamCanvas?.stageRef?.current;
      if (!stage) return { x: 0, y: 0 };
      return { x: stage.x(), y: stage.y() };
    });

    console.log("📍 Initial viewport position:", initialTransform);

    // Perform pan operation
    const panStartX = canvasBox.x + canvasBox.width / 2;
    const panStartY = canvasBox.y + canvasBox.height / 2;
    const panEndX = panStartX + 100;
    const panEndY = panStartY + 50;

    console.log("🖱️ Performing pan gesture...");

    await page.mouse.move(panStartX, panStartY);
    await page.mouse.down();
    await page.mouse.move(panEndX, panEndY, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(1000);

    // Get final viewport position
    const finalTransform = await page.evaluate(() => {
      const stage = window.figjamCanvas?.stageRef?.current;
      if (!stage) return { x: 0, y: 0 };
      return { x: stage.x(), y: stage.y() };
    });

    console.log("📍 Final viewport position:", finalTransform);

    // Check if viewport moved
    const viewportDeltaX = finalTransform.x - initialTransform.x;
    const viewportDeltaY = finalTransform.y - initialTransform.y;

    console.log("📊 Viewport movement:", {
      x: viewportDeltaX,
      y: viewportDeltaY,
    });

    // Check if rectangle position changed (it shouldn't)
    const rectanglePosition = await page.evaluate(() => {
      const stage = window.figjamCanvas?.stageRef?.current;
      if (!stage) return { x: 0, y: 0 };

      // Find the rectangle in the main layer
      const mainLayer = stage.findOne(".main-layer");
      if (!mainLayer) return { x: 0, y: 0 };

      const rect = mainLayer.findOne("Rect");
      if (!rect) return { x: 0, y: 0 };

      return { x: rect.x(), y: rect.y() };
    });

    console.log("📐 Rectangle position after pan:", rectanglePosition);

    // Verify results
    const viewportMoved =
      Math.abs(viewportDeltaX) > 10 || Math.abs(viewportDeltaY) > 10;
    const rectangleMoved =
      Math.abs(rectanglePosition.x - 150) > 5 ||
      Math.abs(rectanglePosition.y - 125) > 5;

    console.log("🎯 Results:");
    console.log(`  Viewport moved: ${viewportMoved} (expected: true)`);
    console.log(`  Rectangle moved: ${rectangleMoved} (expected: false)`);

    if (viewportMoved && !rectangleMoved) {
      console.log("🎉 SUCCESS: Pan tool is working correctly!");
      console.log("   - Viewport panned as expected");
      console.log("   - Selected elements did not move");
      return true;
    } else {
      console.log("❌ FAILURE: Pan tool fix not working properly");
      if (!viewportMoved) {
        console.log("   - Viewport did not move");
      }
      if (rectangleMoved) {
        console.log("   - Rectangle moved when it should not have");
      }
      return false;
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testPanToolFix()
  .then((success) => {
    if (success) {
      console.log("\n✅ Pan tool fix verification PASSED");
      process.exit(0);
    } else {
      console.log("\n❌ Pan tool fix verification FAILED");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("💥 Test crashed:", error);
    process.exit(1);
  });
