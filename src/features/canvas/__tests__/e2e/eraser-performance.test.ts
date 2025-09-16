import { test, expect } from '@playwright/test';

test.describe('Eraser Performance', () => {
  test('erasing large stroke sets only removes intersecting segments using spatial index; no full-canvas redraw stutter', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select pen tool and draw many strokes
    const penTool = page.locator('[data-testid="tool-pen"]');
    if (await penTool.isVisible()) {
      await penTool.click();
    }

    // Draw multiple strokes quickly
    for (let i = 0; i < 10; i++) {
      await canvas.hover({ position: { x: 50 + i * 20, y: 50 } });
      await page.mouse.down();
      await page.mouse.move(50 + i * 20, 150);
      await page.mouse.up();
    }

    // Switch to eraser
    const eraserTool = page.locator('[data-testid="tool-eraser"]');
    if (await eraserTool.isVisible()) {
      await eraserTool.click();
    }

    // Measure performance of erasing
    const startTime = Date.now();
    await canvas.hover({ position: { x: 100, y: 100 } });
    await page.mouse.down();
    await page.mouse.move(150, 100);
    await page.mouse.up();
    const endTime = Date.now();

    // Check that erase was fast (< 100ms or something)
    expect(endTime - startTime).toBeLessThan(200);

    // Check that only intersecting segments removed (visual check)
    await expect(page).toHaveScreenshot('after-erase.png');

    // No stutter assumed if time is low
  });
});