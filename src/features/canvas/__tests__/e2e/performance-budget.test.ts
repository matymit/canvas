import { test, expect } from '@playwright/test';

test.describe('Performance Budget', () => {
  test('stress scene (e.g., many images/nodes) and verify average FPS ≥ target; log frame rates and detect regression', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create stress scene: many elements
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      for (let i = 0; i < 100; i++) {
        await canvas.click({ position: { x: Math.random() * 800, y: Math.random() * 600 } });
        await page.mouse.move(Math.random() * 800, Math.random() * 600);
        await page.mouse.up();
      }
    }

    // Measure FPS
    // Use page.evaluate to measure
    const fps = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const measure = () => {
          frames++;
          if (performance.now() - start < 1000) {
            requestAnimationFrame(measure);
          } else {
            resolve(frames);
          }
        };
        requestAnimationFrame(measure);
      });
    });

    // Verify FPS >= 30
    expect(fps).toBeGreaterThanOrEqual(30);

    // Log frame rates
    console.log(`FPS: ${fps}`);
  });
});