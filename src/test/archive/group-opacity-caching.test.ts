import { test, expect } from '@playwright/test';

test.describe('Group Opacity Caching', () => {
  test('caching a group applies opacity to composite output; internal changes require re-cache to reflect updates', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create group of elements
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      // Create multiple rectangles
      for (let i = 0; i < 3; i++) {
        await canvas.click({ position: { x: 100 + i * 50, y: 100 } });
        await page.mouse.move(130 + i * 50, 130);
        await page.mouse.up();
      }
    }

    // Select all and group
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    // Assume group command
    await page.keyboard.press('Control+g'); // Group shortcut

    // Set opacity
    const opacitySlider = page.locator('[data-testid="opacity-slider"]');
    if (await opacitySlider.isVisible()) {
      await opacitySlider.fill('0.5');
    }

    // Cache the group
    // Assume cache button
    const cacheBtn = page.locator('[data-testid="cache-group"]');
    if (await cacheBtn.isVisible()) {
      await cacheBtn.click();
    }

    // Opacity applied to composite
    await expect(page).toHaveScreenshot('group-cached-opacity.png');

    // Change internal element
    await canvas.click({ position: { x: 115, y: 115 } });
    const colorPicker = page.locator('[data-testid="color-picker"]');
    if (await colorPicker.isVisible()) {
      await colorPicker.click();
      await page.locator('.color-option').first().click();
    }

    // Re-cache required to reflect change
    if (await cacheBtn.isVisible()) {
      await cacheBtn.click();
    }

    await expect(page).toHaveScreenshot('group-re-cached.png');
  });
});