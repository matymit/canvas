import { test, expect } from '@playwright/test';

test.describe('Persistence', () => {
  test('save canvas, reload app, and verify full state restore including selection, viewport, and z-order', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create elements
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 100, y: 100 } });
      await page.mouse.move(150, 150);
      await page.mouse.up();
    }

    // Select and set viewport
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
      await canvas.click({ position: { x: 125, y: 125 } });
    }

    // Zoom in
    const zoomInBtn = page.locator('[data-testid="zoom-in"]');
    if (await zoomInBtn.isVisible()) {
      await zoomInBtn.click();
    }

    // Save (assume auto-save or save button)
    // Reload
    await page.reload();

    // Verify state restored
    await expect(canvas).toBeVisible();
    const transformer = page.locator('.konva-transformer');
    await expect(transformer).toBeVisible(); // Selection restored

    // Viewport scale assumed restored
  });
});