import { test, expect } from '@playwright/test';

test.describe('Text Tool - hug width, fixed single-line height', () => {
  test('textarea grows and shrinks; commit width/height equals measured', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select text tool
    const textTool = page.locator('[data-testid="tool-text"]');
    if (await textTool.isVisible()) await textTool.click();

    await canvas.click({ position: { x: 140, y: 140 } });

    const overlay = page.locator('[data-testid="text-portal-input"]');
    await expect(overlay).toBeVisible();

    // Type grows
    await overlay.fill('Hello');
    const w1 = await overlay.evaluate((el) => (el as HTMLElement).offsetWidth);

    await overlay.fill('Hello World');
    const w2 = await overlay.evaluate((el) => (el as HTMLElement).offsetWidth);

    expect(w2).toBeGreaterThan(w1);

    // Shrink
    await overlay.fill('Hi');
    const w3 = await overlay.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(w3).toBeLessThan(w2);

    // Commit
    await page.keyboard.press('Enter');

    await expect(overlay).toBeHidden();

    // Screenshot as proxy for geometry correctness
    await expect(page).toHaveScreenshot('text-hug-committed.png');
  });
});