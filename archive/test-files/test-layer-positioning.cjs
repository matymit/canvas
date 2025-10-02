const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("http://localhost:1420");

  // Wait for canvas to load
  await page.waitForSelector('[data-testid="konva-stage-container"]');

  // Test layer positioning specifically
  const layerTest = await page.evaluate(() => {
    return new Promise((resolve) => {
      const store = window.useUnifiedCanvasStore?.getState?.();
      const stage = window.konvaStage;
      if (!store || !stage) return { error: "Store or stage not accessible" };

      console.log("=== INITIAL STATE ===");
      console.log("store.viewport:", store.viewport);

      // Get all layers
      const layers = stage.getChildren();
      console.log("All layers:");
      layers.forEach((layer, index) => {
        console.log("Layer detail", {
          index,
          className: layer.getClassName ? layer.getClassName() : "unknown",
          name: layer.name(),
          position: layer.position(),
          visible: layer.visible(),
          listening: layer.listening(),
        });
      });

      // Call setPan
      console.log("=== CALLING setPan(100, 100) ===");
      store.viewport.setPan(100, 100);

      // Check immediately after
      setTimeout(() => {
        console.log("=== IMMEDIATELY AFTER setPan ===");
        console.log("store.viewport:", store.viewport);

        const layersAfter = stage.getChildren();
        console.log("Layer positions immediately after:");
        layersAfter.forEach((layer, index) => {
          console.log("Layer detail", {
            index,
            className: layer.getClassName ? layer.getClassName() : "unknown",
            position: layer.position(),
          });
        });

        // Wait longer for React useEffect to run
        setTimeout(() => {
          console.log("=== AFTER REACT EFFECT SHOULD HAVE RUN ===");
          console.log("store.viewport:", store.viewport);

          const layersFinal = stage.getChildren();
          console.log("Layer positions after React effect:");
          layersFinal.forEach((layer, index) => {
            console.log("Layer detail", {
              index,
              className: layer.getClassName ? layer.getClassName() : "unknown",
              position: layer.position(),
            });
          });

          // Check if layersRef is accessible
          const layersRef = window.layersRef;
          if (layersRef && layersRef.current) {
            console.log("layersRef positions:");
            console.log(
              "background:",
              layersRef.current.background?.position(),
            );
            console.log("main:", layersRef.current.main?.position());
            console.log(
              "highlighter:",
              layersRef.current.highlighter?.position(),
            );
            console.log("preview:", layersRef.current.preview?.position());
            console.log("overlay:", layersRef.current.overlay?.position());
          }

          resolve({
            storeViewport: { x: store.viewport.x, y: store.viewport.y },
            layerPositions: layersFinal.map((layer) => ({
              className: layer.getClassName ? layer.getClassName() : "unknown",
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
        }, 500); // Wait 500ms for React effect
      }, 100);
    });
  });

  console.log("🔍 Layer Positioning Test:");
  console.log(JSON.stringify(layerTest, null, 2));

  await browser.close();
})();
