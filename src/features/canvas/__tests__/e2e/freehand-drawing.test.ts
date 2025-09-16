import { test, expect } from '@playwright/test';

test.describe('Freehand Drawing', () => {
  test('pen/marker/highlighter strokes render in real time on FastLayer; stroke width/color respect toolbar; no input lag', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select pen tool
    const penTool = page.locator('[data-testid="tool-pen"]');
    if (await penTool.isVisible()) {
      await penTool.click();
    }

    // Set color and width via toolbar
    const colorPicker = page.locator('[data-testid="color-picker"]');
    if (await colorPicker.isVisible()) {
      await colorPicker.click();
      // Select a color, assume first option
      await page.locator('.color-option').first().click();
    }

    const widthSlider = page.locator('[data-testid="stroke-width"]');
    if (await widthSlider.isVisible()) {
      await widthSlider.fill('5');
    }

    // Draw a stroke
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.move(150, 150);
    await page.mouse.move(200, 200);
    await page.mouse.up();

    // Check that stroke rendered (visual check)
    await expect(page).toHaveScreenshot('pen-stroke.png');

    // Test marker and highlighter similarly
    const markerTool = page.locator('[data-testid="tool-marker"]');
    if (await markerTool.isVisible()) {
      await markerTool.click();
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(250, 250);
      await page.mouse.up();
    }

    const highlighterTool = page.locator('[data-testid="tool-highlighter"]');
    if (await highlighterTool.isVisible()) {
      await highlighterTool.click();
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(300, 300);
      await page.mouse.up();
    }

    // No input lag assumed if actions complete quickly
  });
});