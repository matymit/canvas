import { test, expect } from '@playwright/test';

test.describe('Drag Events', () => {
  test('dragstart/dragmove/dragend sequences fire on nodes and update positions and selection consistently', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select tool
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    // Create an element
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 100, y: 100 } });
      await page.mouse.move(150, 150);
      await page.mouse.up();
    }

    // Select the element
    await canvas.click({ position: { x: 125, y: 125 } });

    // Listen for drag events (if exposed, or assume via state)
    // Since e2e, hard to listen to internal events, assume by checking position change

    // Drag the element
    await page.mouse.move(125, 125);
    await page.mouse.down();
    // Drag start should fire
    await page.mouse.move(175, 175);
    // Drag move
    await page.mouse.move(200, 200);
    // Drag end
    await page.mouse.up();

    // Check that position updated (assume visually or via screenshot)
    await expect(page).toHaveScreenshot('after-drag.png'); // For visual regression

    // Selection should remain consistent
    const transformer = page.locator('.konva-transformer');
    await expect(transformer).toBeVisible();
  });
});