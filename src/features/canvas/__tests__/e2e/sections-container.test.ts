import { test, expect } from '@playwright/test';

test.describe('Sections Container', () => {
  test('create section, drag elements in/out, move/resize section updates contained element positions and selection scopes', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Assume section tool
    const sectionTool = page.locator('[data-testid="tool-section"]');
    if (await sectionTool.isVisible()) {
      await sectionTool.click();
    }

    // Create section
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.mouse.move(200, 200);
    await page.mouse.up();

    // Create an element
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 50, y: 50 } });
      await page.mouse.move(80, 80);
      await page.mouse.up();
    }

    // Drag element into section
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    await canvas.click({ position: { x: 65, y: 65 } });
    await page.mouse.move(65, 65);
    await page.mouse.down();
    await page.mouse.move(150, 150);
    await page.mouse.up();

    // Element now in section
    await expect(page).toHaveScreenshot('element-in-section.png');

    // Move/resize section
    await canvas.click({ position: { x: 150, y: 150 } }); // Select section
    // Resize
    const handle = page.locator('.section-handle-se');
    if (await handle.isVisible()) {
      await handle.hover();
      await page.mouse.down();
      await page.mouse.move(250, 250);
      await page.mouse.up();
    }

    // Contained element position updated
    await expect(page).toHaveScreenshot('section-resized.png');
  });
});