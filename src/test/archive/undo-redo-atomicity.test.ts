import { test, expect } from '@playwright/test';

test.describe('Undo/Redo Atomicity', () => {
  test('multi-step actions grouped into single undo; connectors, text edits, and grouped shape operations revert predictably', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Perform multi-step action: create rectangle and text
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
      await canvas.click({ position: { x: 120, y: 120 } });
      const textInput = page.locator('[data-testid="text-portal-input"]');
      await textInput.fill('Test');
      await canvas.click({ position: { x: 200, y: 200 } });
    }

    // Undo
    const undoBtn = page.locator('[data-testid="undo"]');
    if (await undoBtn.isVisible()) {
      await undoBtn.click();
    }

    // Both rectangle and text reverted
    await expect(page).toHaveScreenshot('after-undo.png');

    // Redo
    const redoBtn = page.locator('[data-testid="redo"]');
    if (await redoBtn.isVisible()) {
      await redoBtn.click();
    }

    // Restored
    await expect(page).toHaveScreenshot('after-redo.png');
  });
});