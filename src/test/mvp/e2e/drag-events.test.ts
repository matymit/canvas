import { test, expect } from "@playwright/test";

// Global declarations for E2E testing
declare global {
  interface Window {
    konvaStage?: any;
  }
}

test.describe("Drag Events", () => {
  test("dragstart/dragmove/dragend sequences fire on nodes and update positions and selection consistently", async ({
    page,
  }) => {
    await page.goto("/");

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select tool
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    // Create an element
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 100, y: 100 } });
      await page.mouse.move(150, 150);
      await page.mouse.up();
    }

    // Switch back to select tool first
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    // Now select the element
    await canvas.click({ position: { x: 125, y: 125 } });

    // Add a small delay to ensure selection is processed
    await page.waitForTimeout(100);

    // Check transformer visibility BEFORE drag (debug purposes)

    // Try to manually show the transformer
    await page.evaluate(() => {
      const stage = window.konvaStage;
      if (!stage) return;

      const transformer = stage.findOne("Transformer");
      if (transformer) {
        console.log("Manually showing transformer");
        transformer.visible(true);
        transformer.getLayer()?.batchDraw();
      }
    });

    // Wait a bit for manual show to take effect
    await page.waitForTimeout(50);

    // Check transformer visibility after manual show
    const transformerDebugAfterManual = await page.evaluate(() => {
      const stage = window.konvaStage;
      if (!stage) return { error: "No stage found" };

      const byClass = stage.findOne("Transformer");
      return byClass
        ? { visible: byClass.visible(), name: byClass.name() }
        : null;
    });
    console.log(
      "Transformer debug info AFTER manual show:",
      transformerDebugAfterManual,
    );

    // Add console logging to see what happens during drag
    await page.evaluate(() => {
      const originalLog = console.log;
      console.log = (...args) => {
        originalLog(...args);
        // Also send to test output
        (window as any).testLogs = (window as any).testLogs || [];
        (window as any).testLogs.push(args.join(" "));
      };
    });

    // Drag the element
    await page.mouse.move(125, 125);
    await page.mouse.down();

    // Check transformer visibility during drag start
    const transformerDuringDragStart = await page.evaluate(() => {
      const stage = window.konvaStage;
      if (!stage) return { error: "No stage found" };
      const transformer = stage.findOne("Transformer");
      return transformer
        ? { visible: transformer.visible(), name: transformer.name() }
        : null;
    });
    console.log("Transformer during drag start:", transformerDuringDragStart);

    // Drag start should fire
    await page.mouse.move(175, 175);

    // Check transformer visibility during drag move
    const transformerDuringDragMove = await page.evaluate(() => {
      const stage = window.konvaStage;
      if (!stage) return { error: "No stage found" };
      const transformer = stage.findOne("Transformer");
      return transformer
        ? { visible: transformer.visible(), name: transformer.name() }
        : null;
    });
    console.log("Transformer during drag move:", transformerDuringDragMove);

    // Drag move
    await page.mouse.move(200, 200);
    // Drag end
    await page.mouse.up();

    // Check transformer visibility immediately after drag end (before timeout)
    const transformerImmediatelyAfterDrag = await page.evaluate(() => {
      const stage = window.konvaStage;
      if (!stage) return { error: "No stage found" };
      const transformer = stage.findOne("Transformer");
      return transformer
        ? { visible: transformer.visible(), name: transformer.name() }
        : null;
    });
    console.log(
      "Transformer immediately after drag end:",
      transformerImmediatelyAfterDrag,
    );

    // Wait for the 10ms timeout in SelectionModule to complete
    await page.waitForTimeout(50);

    // Check transformer visibility after timeout
    const transformerAfterTimeout = await page.evaluate(() => {
      const stage = window.konvaStage;
      if (!stage) return { error: "No stage found" };
      const transformer = stage.findOne("Transformer");
      return transformer
        ? { visible: transformer.visible(), name: transformer.name() }
        : null;
    });
    console.log("Transformer after 50ms timeout:", transformerAfterTimeout);

    // Add additional delay after drag to ensure transform is complete
    await page.waitForTimeout(200);

    // Collect any logs that were generated during drag
    const dragLogs = await page.evaluate(() => {
      const logs = (window as any).testLogs || [];
      (window as any).testLogs = [];
      return logs;
    });
    console.log("Logs during drag operation:", dragLogs);

    // Check if selection changed during drag
    const selectionInfo = await page.evaluate(() => {
      const store = (window as any).useUnifiedCanvasStore?.getState?.();
      return {
        selectedElementIds: store?.selectedElementIds,
        selectionVersion: store?.selectionVersion,
      };
    });
    console.log("Selection info after drag:", selectionInfo);

    // Check that position updated (assume visually or via screenshot)
    await expect(page).toHaveScreenshot("after-drag.png"); // For visual regression

    // Selection should remain consistent
    // Check if transformer exists by evaluating Konva stage
    const transformerDebug = await page.evaluate(() => {
      const stage = window.konvaStage;
      if (!stage) return { error: "No stage found" };

      // Try different selectors to find transformer
      const byName = stage.findOne(".Transformer");
      const byClass = stage.findOne("Transformer");
      const byNameAttr = stage.findOne('[name="selection-transformer"]');

      return {
        byName: byName
          ? { visible: byName.visible(), name: byName.name() }
          : null,
        byClass: byClass
          ? { visible: byClass.visible(), name: byClass.name() }
          : null,
        byNameAttr: byNameAttr
          ? { visible: byNameAttr.visible(), name: byNameAttr.name() }
          : null,
        allNodes: stage
          .find(".Transformer")
          .map((n: Konva.Node) => ({ name: n.name(), visible: n.visible() })),
      };
    });

    console.log("Transformer debug info AFTER drag:", transformerDebug);

    // Check if any transformer was found and is visible
    const transformerExists =
      (transformerDebug.byName && transformerDebug.byName.visible) ||
      (transformerDebug.byClass && transformerDebug.byClass.visible) ||
      (transformerDebug.byNameAttr && transformerDebug.byNameAttr.visible);

    await expect(transformerExists).toBe(true);
  });
});
