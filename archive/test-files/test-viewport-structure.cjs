const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("http://localhost:1420");

  // Wait for canvas to load
  await page.waitForSelector('[data-testid="konva-stage-container"]');

  // Test viewport structure
  const viewportStructure = await page.evaluate(() => {
    const store = window.useUnifiedCanvasStore?.getState?.();
    if (!store) return { error: "Store not accessible" };

    return {
      hasViewport: "viewport" in store,
      viewportType: typeof store.viewport,
      viewport: store.viewport,
      viewportKeys: store.viewport ? Object.keys(store.viewport) : [],
      hasX: "x" in store.viewport,
      hasY: "y" in store.viewport,
      hasScale: "scale" in store.viewport,
      x: store.viewport?.x,
      y: store.viewport?.y,
      scale: store.viewport?.scale,
    };
  });

  console.log("🔍 Viewport Structure Analysis:");
  console.log(JSON.stringify(viewportStructure, null, 2));

  // Test setPan and immediate state check
  const setPanTest = await page.evaluate(() => {
    const store = window.useUnifiedCanvasStore?.getState?.();
    if (!store || !store.viewport?.setPan)
      return { error: "setPan not available" };

    const original = { x: store.viewport.x, y: store.viewport.y };
    store.viewport.setPan(100, 100);

    // Check state immediately after setPan
    const after = { x: store.viewport.x, y: store.viewport.y };

    return {
      original,
      after,
      changed: original.x !== after.x || original.y !== after.y,
    };
  });

  console.log("🔄 setPan Immediate State Check:");
  console.log(JSON.stringify(setPanTest, null, 2));

  await browser.close();
})();
