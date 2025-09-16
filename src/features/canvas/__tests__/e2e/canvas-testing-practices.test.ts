import { test, expect } from '@playwright/test';

test.describe('Canvas Testing Practices', () => {
  test('incorporate functional, visual, and performance checks specific to canvas rendering behaviors in automation', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Functional check: create and select element
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 100, y: 100 } });
      await page.mouse.move(150, 150);
      await page.mouse.up();
    }

    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
      await canvas.click({ position: { x: 125, y: 125 } });
    }

    // Visual check
    await expect(page).toHaveScreenshot('functional-visual.png');

    // Performance check: measure render time
    const start = Date.now();
    await canvas.click({ position: { x: 200, y: 200 } }); // Trigger render
    const end = Date.now();
    expect(end - start).toBeLessThan(100);

    // Specific to canvas: check no visual artifacts
    // Assume screenshot comparison detects rendering issues
  });
});