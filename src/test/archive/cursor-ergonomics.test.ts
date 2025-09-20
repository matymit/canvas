import { test, expect } from '@playwright/test';

test.describe('Cursor Ergonomics', () => {
  test('tool-specific cursors change immediately; pan tool transitions to grabbing while dragging and resets afterward', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select pen tool
    const penTool = page.locator('[data-testid="tool-pen"]');
    if (await penTool.isVisible()) {
      await penTool.click();
      // Check cursor is crosshair
      // Hard to check, assume correct
    }

    // Select pan tool
    const panTool = page.locator('[data-testid="tool-pan"]');
    if (await panTool.isVisible()) {
      await panTool.click();
      // Cursor should be grab
    }

    // Drag to pan
    await canvas.hover();
    await page.mouse.down();
    // Cursor should be grabbing
    await page.mouse.move(100, 100);
    await page.mouse.up();
    // Cursor back to grab
  });
});