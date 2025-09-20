import { test, expect } from '@playwright/test';

// A deterministic visual baseline: rectangle with centered text
// We use a CSS (stylePath) to hide volatile UI overlays so snapshots are stable.

const hideDynamicUI = {
  stylePath: 'src/features/canvas/__tests__/e2e/screenshots.css',
  // Playwright toHaveScreenshot supports stylePath; we also keep inline to be safe in older versions
  style: `
    /* Hide cursors, transformers, and dynamic overlays if they have data-testid */
    [data-testid="cursor"],
    [data-testid^="transformer"],
    [data-testid^="overlay-"] {
      visibility: hidden !important;
    }
  `,
};

async function ensureStage(page: any) {
  await page.goto('/');
  const canvas = page.locator('[data-testid="konva-stage-container"]');
  await expect(canvas).toBeVisible();
  return canvas;
}

test.describe('Canvas Visual Baselines', () => {
  test('rectangle idle with centered text', async ({ page }) => {
    const canvas = await ensureStage(page);

    // Select rectangle tool and create a rectangle
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
    }
    await canvas.click({ position: { x: 200, y: 200 } });
    await page.mouse.move(300, 260);
    await page.mouse.up();

    // Immediately the text editor overlay should open; type some text and commit
    await page.keyboard.type('Hello');
    await page.keyboard.press('Enter');

    // Baseline screenshot
    await expect(page).toHaveScreenshot('rectangle-idle-with-text.png', hideDynamicUI as any);
  });

  test('rectangle selected with transformer', async ({ page }) => {
    const canvas = await ensureStage(page);

    // Create rectangle
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) await rectTool.click();
    await canvas.click({ position: { x: 120, y: 140 } });
    await page.mouse.move(240, 220);
    await page.mouse.up();

    // Select tool
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) await selectTool.click();

    // Click the rectangle area to attach transformer (assumes hit graph is active)
    await canvas.click({ position: { x: 180, y: 180 } });

    await expect(page).toHaveScreenshot('rectangle-selected-with-transformer.png', hideDynamicUI as any);
  });
});