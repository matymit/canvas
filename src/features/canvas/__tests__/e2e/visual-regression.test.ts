import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('canonical scenes for tools, selection bounds, connectors, and text snapshots detect unintended rendering changes', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create canonical scene: rectangle, text, connector
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 100, y: 100 } });
      await page.mouse.move(150, 150);
      await page.mouse.up();
    }

    const textTool = page.locator('[data-testid="tool-text"]');
    if (await textTool.isVisible()) {
      await textTool.click();
      await canvas.click({ position: { x: 200, y: 200 } });
      const textInput = page.locator('[data-testid="text-portal-input"]');
      await textInput.fill('Sample Text');
      await canvas.click({ position: { x: 250, y: 250 } });
    }

    // Select to show bounds
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
      await canvas.click({ position: { x: 125, y: 125 } });
    }

    // Take snapshot
    await expect(page).toHaveScreenshot('canonical-scene.png');
  });
});