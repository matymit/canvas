import { test, expect } from '@playwright/test';

test.describe('Connector Creation', () => {
  test('two-click line/arrow between elements; live preview; snapping and smart routing; path updates when endpoints move', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create two shapes first
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 100, y: 100 } });
      await page.mouse.move(150, 150);
      await page.mouse.up();

      await canvas.click({ position: { x: 200, y: 200 } });
      await page.mouse.move(250, 250);
      await page.mouse.up();
    }

    // Select connector tool
    const connectorTool = page.locator('[data-testid="tool-connector"]');
    if (await connectorTool.isVisible()) {
      await connectorTool.click();
    }

    // Click first element
    await canvas.click({ position: { x: 125, y: 125 } });

    // Live preview as mouse moves
    await page.mouse.move(225, 225);

    // Click second element
    await canvas.click({ position: { x: 225, y: 225 } });

    // Connector created
    await expect(page).toHaveScreenshot('connector-created.png');

    // Move one element, path updates
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    await canvas.click({ position: { x: 125, y: 125 } });
    await page.mouse.move(125, 125);
    await page.mouse.down();
    await page.mouse.move(150, 150);
    await page.mouse.up();

    // Connector path updated
    await expect(page).toHaveScreenshot('connector-updated.png');
  });
});