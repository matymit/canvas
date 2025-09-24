const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("http://localhost:1420");

  // Wait for canvas to load
  await page.waitForSelector('[data-testid="konva-stage-container"]');

  // Test actual store structure
  const storeStructure = await page.evaluate(() => {
    const store = window.useUnifiedCanvasStore?.getState?.();
    if (!store) return { error: "Store not accessible" };

    // Get the raw state without the methods
    const rawState = {
      hasViewport: "viewport" in store,
      hasDirectX: "x" in store,
      hasDirectY: "y" in store,
      hasDirectScale: "scale" in store,
      directX: store.x,
      directY: store.y,
      directScale: store.scale,
      viewportX: store.viewport?.x,
      viewportY: store.viewport?.y,
      viewportScale: store.viewport?.scale,
      fullViewport: store.viewport,
      allKeys: Object.keys(store),
      nonFunctionKeys: Object.keys(store).filter(
        (key) => typeof store[key] !== "function",
      ),
    };

    return rawState;
  });

  console.log("🔍 Store Structure Analysis:");
  console.log(JSON.stringify(storeStructure, null, 2));

  await browser.close();
})();
