const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("http://localhost:1420");

  // Wait for canvas to load
  await page.waitForSelector('[data-testid="konva-stage-container"]');

  // Test stage position after setPan
  const stagePositionTest = await page.evaluate(() => {
    const store = window.useUnifiedCanvasStore?.getState?.();
    const stage = window.konvaStage;
    if (!store || !stage) return { error: "Store or stage not accessible" };

    console.log("=== INITIAL STATE ===");
    console.log("store.viewport:", store.viewport);
    console.log("stage.position():", stage.position());
    console.log("stage.scale():", stage.scale());

    // Get layer positions
    const layers = stage.getChildren();
    console.log("Layer count:", layers.length);
    layers.forEach((layer, index) => {
      console.log(
        `Layer ${index} (${layer.name || "unnamed"}):`,
        layer.position(),
      );
    });

    // Call setPan
    console.log("=== CALLING setPan(100, 100) ===");
    store.viewport.setPan(100, 100);

    // Wait a bit for state to propagate
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("=== AFTER setPan ===");
        console.log("store.viewport:", store.viewport);
        console.log("stage.position():", stage.position());
        console.log("stage.scale():", stage.scale());

        // Get layer positions again
        const layersAfter = stage.getChildren();
        console.log("Layer positions after:");
        layersAfter.forEach((layer, index) => {
          console.log(
            `Layer ${index} (${layer.className()}):`,
            layer.position(),
          );
        });

        // Check if layersRef has the correct layers
        const layersRef = window.layersRef;
        if (layersRef) {
          console.log("layersRef:", {
            background: layersRef.current?.background?.position(),
            main: layersRef.current?.main?.position(),
            highlighter: layersRef.current?.highlighter?.position(),
            preview: layersRef.current?.preview?.position(),
            overlay: layersRef.current?.overlay?.position(),
          });
        }

        resolve({
          storeViewport: { x: store.viewport.x, y: store.viewport.y },
          stagePosition: stage.position(),
          layerPositions: layersAfter.map((layer) => ({
            className: layer.className(),
            position: layer.position(),
          })),
          layersRefPositions: layersRef?.current
            ? {
                background: layersRef.current.background?.position(),
                main: layersRef.current.main?.position(),
                highlighter: layersRef.current.highlighter?.position(),
                preview: layersRef.current.preview?.position(),
                overlay: layersRef.current.overlay?.position(),
              }
            : null,
        });
      }, 100); // Wait 100ms for state to propagate
    });
  });

  console.log("🔍 Stage Position Test:");
  console.log(JSON.stringify(stagePositionTest, null, 2));

  await browser.close();
})();
