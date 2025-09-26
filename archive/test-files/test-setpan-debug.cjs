const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("http://localhost:1420");

  // Wait for canvas to load
  await page.waitForSelector('[data-testid="konva-stage-container"]');

  // Test setPan with detailed debugging
  const setPanDebug = await page.evaluate(() => {
    const store = window.useUnifiedCanvasStore?.getState?.();
    if (!store || !store.viewport?.setPan)
      return { error: "setPan not available" };

    console.log("=== BEFORE setPan ===");
    console.log("store.viewport:", store.viewport);
    console.log("store.viewport.x:", store.viewport.x);
    console.log("store.viewport.y:", store.viewport.y);

    const original = { x: store.viewport.x, y: store.viewport.y };
    console.log("Original values:", original);

    // Call setPan
    console.log("=== CALLING setPan(200, 200) ===");
    store.viewport.setPan(200, 200);

    // Check state immediately after setPan
    const after = { x: store.viewport.x, y: store.viewport.y };
    console.log("=== AFTER setPan ===");
    console.log("store.viewport:", store.viewport);
    console.log("store.viewport.x:", store.viewport.x);
    console.log("store.viewport.y:", store.viewport.y);
    console.log("After values:", after);

    // Try to get a fresh state reference
    const freshState = window.useUnifiedCanvasStore?.getState?.();
    const fresh = { x: freshState.viewport.x, y: freshState.viewport.y };
    console.log("=== FRESH STATE ===");
    console.log("freshState.viewport:", freshState.viewport);
    console.log("Fresh values:", fresh);

    return {
      original,
      after,
      fresh,
      changed: original.x !== after.x || original.y !== after.y,
      freshChanged: original.x !== fresh.x || original.y !== fresh.y,
    };
  });

  console.log("🔍 setPan Debug Analysis:");
  console.log(JSON.stringify(setPanDebug, null, 2));

  await browser.close();
})();
