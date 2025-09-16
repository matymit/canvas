import { test, expect } from '@playwright/test';

test.describe('Multi-Resize Stress', () => {
  test('select many shapes and resize via transformer; verify smoothness and correct proportional updates under load', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create many shapes
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      for (let i = 0; i < 20; i++) {
        await canvas.click({ position: { x: 50 + (i % 5) * 60, y: 50 + Math.floor(i / 5) * 60 } });
        await page.mouse.move(80 + (i % 5) * 60, 80 + Math.floor(i / 5) * 60);
        await page.mouse.up();
      }
    }

    // Select all
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    await page.keyboard.press('Control+a'); // Select all

    // Resize via transformer
    const handle = page.locator('.konva-transformer .handle-se');
    if (await handle.isVisible()) {
      const startTime = Date.now();
      await handle.hover();
      await page.mouse.down();
      await page.mouse.move(300, 300);
      await page.mouse.up();
      const endTime = Date.now();

      // Check time for smoothness
      expect(endTime - startTime).toBeLessThan(500);
    }

    // Verify proportional updates
    await expect(page).toHaveScreenshot('multi-resize.png');
  });
});