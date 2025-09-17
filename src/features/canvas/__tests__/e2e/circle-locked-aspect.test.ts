import { test, expect } from '@playwright/test';

test.describe('Circle Tool - locked aspect', () => {
  test('drag preview and commit creates locked-aspect circle and auto-selects', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Open shapes and pick Circle
    const shapesButton = page.locator('button[aria-label="Shapes"]');
    await shapesButton.click();
    const circleItem = page.locator('role=menu >> text=Circle');
    await circleItem.click();

    // Drag create
    await canvas.hover({ position: { x: 300, y: 200 } });
    await page.mouse.down();
    await page.mouse.move(360, 240);
    await page.mouse.up();

    // Auto switch to select expected
    // Visual assertion
    await expect(page).toHaveScreenshot('circle-locked.png');
  });
});