import { test, expect } from '@playwright/test';

// Ensures style for stable screenshots is injected
async function applyStableStyles(page) {
  await page.addStyleTag({ path: 'src/features/canvas/__tests__/e2e/screenshots.css' });
}

test.describe('Visual Baselines: post-transform geometry', () => {
  test('scale and rotate rectangle produces stable snapshot', async ({ page }) => {
    await page.goto('/');
    await applyStableStyles(page);

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create a rectangle via tool interaction
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 200, y: 200 } });
      await page.mouse.move(260, 240);
      await page.mouse.up();
    }

    // Programmatically transform the node via Konva API for determinism
    await page.evaluate(() => {
      const stage = (window as any).canvasStage as import('konva').Stage;
      const layers = (window as any).canvasLayers as { main: import('konva').Layer };
      const main = layers?.main || stage.getLayers()[1];
      const node = main?.getChildren()?.find((n: any) => typeof n.id === 'function' && n.id());
      if (!node) return;
      // Apply transforms deterministically
      node.x(220);
      node.y(210);
      node.scaleX(1.5);
      node.scaleY(1.25);
      node.rotation(18);
      // Normalize by committing scale to width/height
      const w = Math.max(1, Math.round(node.width() * node.scaleX()));
      const h = Math.max(1, Math.round(node.height() * node.scaleY()));
      node.scaleX(1);
      node.scaleY(1);
      node.width(w);
      node.height(h);
    });

    // Snapshot after deterministic transform
    await expect(page).toHaveScreenshot('post-transform-geometry.png');
  });
});


test.describe('Visual Baselines: guides during drag', () => {
  test('dragging a rectangle shows SmartGuides consistently', async ({ page }) => {
    await page.goto('/');
    await applyStableStyles(page);

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create two rectangles
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      // First
      await canvas.click({ position: { x: 150, y: 200 } });
      await page.mouse.move(210, 240);
      await page.mouse.up();
      // Second
      await canvas.click({ position: { x: 400, y: 220 } });
      await page.mouse.move(460, 260);
      await page.mouse.up();
    }

    // Select tool and drag the second toward the first to trigger guides
    const selectTool = page.locator('[data-testid="tool-select"]');
    if (await selectTool.isVisible()) {
      await selectTool.click();
    }

    // Click second rect center-ish and drag left to align center with first
    await page.mouse.move(430, 240);
    await page.mouse.down();
    await page.mouse.move(300, 240);
    await page.mouse.up();

    // Snapshot with guides drawn (style sheet hides volatile overlays)
    await expect(page).toHaveScreenshot('guides-during-drag.png');
  });
});
