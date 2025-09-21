// E2E Test Utilities for Canvas Testing
import { Page } from "@playwright/test";

/**
 * Launch the test canvas application
 */
export async function launchTestCanvas(page: Page) {
  await page.goto("http://localhost:5173"); // Vite dev server default
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for canvas to be fully ready
 */
export async function waitForCanvasReady(page: Page) {
  await page.waitForFunction(
    () => {
      return (
        window["canvasStage"] !== undefined &&
        window["canvasLayers"] !== undefined &&
        window["useUnifiedCanvasStore"] !== undefined
      );
    },
    { timeout: 10000 },
  );
}

/**
 * Get canvas stage identifier
 */
export async function getCanvasStage(_page: Page): Promise<string> {
  return "canvasStage";
}

/**
 * Select a tool from the toolbar
 */
export async function selectTool(page: Page, toolId: string) {
  const toolButton = await page.locator(`[data-testid="tool-${toolId}"]`);
  await toolButton.click();
  await page.waitForTimeout(100); // Allow tool to activate
}

/**
 * Draw on canvas from one point to another
 */
export async function drawOnCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
  await page.waitForTimeout(100); // Allow drawing to complete
}

/**
 * Get an element from the canvas by selector
 */
export async function getElement(page: Page, selector: string) {
  return await page.evaluate((sel) => {
    const stage = window["canvasStage"];
    return stage?.findOne(sel);
  }, selector);
}

/**
 * Wait for a condition to become truthy
 */
export async function expectEventuallyTruthy(
  page: Page,
  evaluator: () => unknown,
  timeout = 5000,
) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await page.evaluate(evaluator);
    if (result) return result;
    await page.waitForTimeout(100);
  }
  throw new Error(`Condition did not become truthy within ${timeout}ms`);
}

/**
 * Get the current selection
 */
export async function getSelection(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const store = window["useUnifiedCanvasStore"]?.getState();
    return store?.selection?.selected || [];
  });
}

/**
 * Clear the canvas
 */
export async function clearCanvas(page: Page) {
  await page.evaluate(() => {
    const store = window["useUnifiedCanvasStore"]?.getState();
    store?.element?.clear();
  });
}

/**
 * Undo last action
 */
export async function undo(page: Page) {
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(100);
}

/**
 * Redo last undone action
 */
export async function redo(page: Page) {
  await page.keyboard.press("Control+y");
  await page.waitForTimeout(100);
}

/**
 * Get the current zoom level
 */
export async function getZoom(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const store = window["useUnifiedCanvasStore"]?.getState();
    return store?.viewport?.zoom || 1;
  });
}

/**
 * Set the zoom level
 */
export async function setZoom(page: Page, zoom: number) {
  await page.evaluate((z) => {
    const store = window["useUnifiedCanvasStore"]?.getState();
    store?.viewport?.setZoom(z);
  }, zoom);
  await page.waitForTimeout(100);
}

/**
 * Pan the canvas
 */
export async function panCanvas(page: Page, deltaX: number, deltaY: number) {
  await page.evaluate(
    (delta) => {
      const store = window["useUnifiedCanvasStore"]?.getState();
      const current = store?.viewport?.pan || { x: 0, y: 0 };
      store?.viewport?.setPan({
        x: current.x + delta.x,
        y: current.y + delta.y,
      });
    },
    { x: deltaX, y: deltaY },
  );
  await page.waitForTimeout(100);
}

/**
 * Take a screenshot of the canvas area
 */
export async function screenshotCanvas(page: Page, path: string) {
  const canvas = await page.locator("#canvas-container");
  await canvas.screenshot({ path });
}

/**
 * Get element bounds
 */
export async function getElementBounds(page: Page, elementId: string) {
  return await page.evaluate((id) => {
    const stage = window["canvasStage"];
    const element = stage?.findOne(`#${id}`);
    if (!element) return null;
    return {
      x: element.x(),
      y: element.y(),
      width: element.width(),
      height: element.height(),
      rotation: element.rotation(),
    };
  }, elementId);
}

/**
 * Multi-select elements by holding shift and clicking
 */
export async function multiSelect(
  page: Page,
  positions: Array<{ x: number; y: number }>,
) {
  await page.keyboard.down("Shift");
  for (const pos of positions) {
    await page.mouse.click(pos.x, pos.y);
  }
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);
}

/**
 * Create a sticky note at position
 */
export async function createStickyNote(
  page: Page,
  x: number,
  y: number,
  text?: string,
) {
  await selectTool(page, "sticky-note");
  await page.mouse.click(x, y);
  if (text) {
    await page.keyboard.type(text);
    await page.keyboard.press("Escape"); // Exit edit mode
  }
  await page.waitForTimeout(100);
}

/**
 * Create a text element at position
 */
export async function createText(
  page: Page,
  x: number,
  y: number,
  text: string,
) {
  await selectTool(page, "text");
  await page.mouse.click(x, y);
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
}

/**
 * Verify grid visibility
 */
export async function isGridVisible(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const stage = window["canvasStage"];
    const bgLayer = stage?.getLayers()[0];
    const grid = bgLayer?.findOne(".grid");
    return grid?.visible() === true;
  });
}

/**
 * Toggle grid visibility
 */
export async function toggleGrid(page: Page) {
  const gridButton = await page.locator('[data-testid="grid-toggle"]');
  await gridButton.click();
  await page.waitForTimeout(100);
}
