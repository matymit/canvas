const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the app
  await page.goto("http://localhost:1420");

  // Wait for canvas to load
  await page.waitForSelector('[data-testid="konva-stage-container"]');

  // Expose store for testing
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const checkStore = () => {
        if (window.useUnifiedCanvasStore) {
          resolve();
        } else {
          setTimeout(checkStore, 100);
        }
      };
      checkStore();
    });
  });

  // Test viewport object reference tracking
  const viewportRefTest = await page.evaluate(() => {
    const store = window.useUnifiedCanvasStore.getState();
    const initialViewport = store.viewport;

    // Track viewport object reference
    let viewportRefBefore = store.viewport;

    // Call setPan
    store.viewport.setPan(50, 50);

    let viewportRefAfter = store.viewport;

    // Check if object reference changed
    const referenceChanged = viewportRefBefore !== viewportRefAfter;

    // Check if properties changed
    const propertiesChanged =
      viewportRefBefore.x !== viewportRefAfter.x ||
      viewportRefBefore.y !== viewportRefAfter.y;

    return {
      initialViewport: { x: initialViewport.x, y: initialViewport.y },
      afterSetPan: { x: store.viewport.x, y: store.viewport.y },
      referenceChanged,
      propertiesChanged,
      sameObject: viewportRefBefore === viewportRefAfter,
      viewportBefore: { x: viewportRefBefore.x, y: viewportRefBefore.y },
      viewportAfter: { x: viewportRefAfter.x, y: viewportRefAfter.y },
    };
  });

  console.log("🔍 Viewport Reference Test Results:");
  console.log(JSON.stringify(viewportRefTest, null, 2));

  // Test React subscription updates
  const subscriptionTest = await page.evaluate(() => {
    return new Promise((resolve) => {
      const store = window.useUnifiedCanvasStore.getState();
      let updateCount = 0;
      let lastViewport = null;

      // Subscribe to viewport changes
      const unsubscribe = window.useUnifiedCanvasStore.subscribe(
        (state) => state.viewport,
        (viewport) => {
          updateCount++;
          console.log(`Subscription update #${updateCount}:`, viewport);

          if (updateCount === 1) {
            lastViewport = viewport;
            // Trigger another change
            setTimeout(() => {
              store.viewport.setPan(100, 100);
            }, 100);
          } else if (updateCount === 2) {
            unsubscribe();
            resolve({
              updateCount,
              firstViewport: lastViewport,
              secondViewport: viewport,
              viewportChanged:
                lastViewport.x !== viewport.x || lastViewport.y !== viewport.y,
            });
          }
        },
      );

      // Trigger first change
      store.viewport.setPan(25, 25);
    });
  });

  console.log("🔍 Subscription Test Results:");
  console.log(JSON.stringify(subscriptionTest, null, 2));

  await browser.close();
})();
