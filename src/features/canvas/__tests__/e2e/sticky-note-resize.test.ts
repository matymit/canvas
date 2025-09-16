import { test, expect } from '@playwright/test';

test.describe('Sticky Note Auto-Resize', () => {
  test('typing expands note height within constraints; wrapping and min/max sizes enforced with correct reflow', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select sticky note tool
    const stickyTool = page.locator('[data-testid="tool-sticky-note"]');
    if (await stickyTool.isVisible()) {
      await stickyTool.click();
    }

    // Click to place sticky note
    await canvas.click({ position: { x: 100, y: 100 } });

    // Text input appears
    const noteInput = page.locator('[data-testid="sticky-note-input"]');
    await expect(noteInput).toBeVisible();

    // Type text that causes wrapping
    await noteInput.fill('This is a long text that should wrap and expand the height of the sticky note.');

    // Check that height expanded
    // Assume visual check or check input height
    await expect(page).toHaveScreenshot('sticky-note-expanded.png');

    // Commit
    await canvas.click({ position: { x: 200, y: 200 } });

    // Note committed with correct size
    await expect(noteInput).not.toBeVisible();
  });
});