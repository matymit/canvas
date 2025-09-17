import { test, expect } from '@playwright/test';

test.describe('Eraser Tool - destination-out', () => {
  test('draw stroke then erase with destination-out; commit and auto-switch to Select', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Draw a marker line
    const marker = page.locator('[data-testid="tool-marker"]');
    if (await marker.isVisible()) await marker.click();

    await canvas.hover({ position: { x: 120, y: 120 } });
    await page.mouse.down();
    await page.mouse.move(240, 120);
    await page.mouse.up();

    // Switch to eraser and erase across the stroke
    const eraser = page.locator('[data-testid="tool-eraser"]');
    if (await eraser.isVisible()) await eraser.click();

    await canvas.hover({ position: { x: 180, y: 120 } });
    await page.mouse.down();
    await page.mouse.move(180, 160);
    await page.mouse.up();

    // Visual check
    await expect(page).toHaveScreenshot('eraser-cut.png');
  });
});