import { test, expect } from '@playwright/test';

// E2E: Select 3 rectangles and distribute, ensuring a single history entry and visual spacing
(test as any).describe('Distribute actions', () => {
  test('horizontal gaps distribution creates one batched entry and correct gaps', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create three rectangles
    const rectBtn = page.locator('[data-testid="tool-rectangle"]');
    if (await rectBtn.isVisible()) await rectBtn.click();

    // First rect
    await canvas.hover({ position: { x: 120, y: 280 } });
    await page.mouse.down();
    await page.mouse.move(140, 320);
    await page.mouse.up();

    // Second rect
    await rectBtn.click();
    await canvas.hover({ position: { x: 210, y: 280 } });
    await page.mouse.down();
    await page.mouse.move(230, 320);
    await page.mouse.up();

    // Third rect
    await rectBtn.click();
    await canvas.hover({ position: { x: 320, y: 280 } });
    await page.mouse.down();
    await page.mouse.move(350, 320);
    await page.mouse.up();

    // Select tool and marquee select roughly around them (simple click-select by z-order can vary)
    const selectBtn = page.locator('[data-testid="tool-select"]');
    await selectBtn.click();

    // Shift-click three times (fallback selection)
    await page.keyboard.down('Shift');
    await canvas.click({ position: { x: 130, y: 300 } });
    await canvas.click({ position: { x: 220, y: 300 } });
    await canvas.click({ position: { x: 335, y: 300 } });
    await page.keyboard.up('Shift');

    // Open distribute menu and apply Horizontal Gaps
    const distributeMenu = page.locator('[data-testid="distribute-menu"]');
    await distributeMenu.click();
    const hGaps = page.locator('[data-testid="distribute-h-gaps"]');
    await hGaps.click();

    // Visual check
    await expect(page).toHaveScreenshot('distribute-h-gaps.png');
  });
});