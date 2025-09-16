import { test, expect } from '@playwright/test';

test.describe('Accessibility End-to-End', () => {
  test('keyboard-only navigation to select/move elements and switch tools; screen reader announcements for tool changes', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Create an element
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
      await canvas.click({ position: { x: 100, y: 100 } });
      await page.mouse.move(150, 150);
      await page.mouse.up();
    }

    // Keyboard navigation: tab to canvas
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Assume focus on canvas

    // Select element with keyboard
    await page.keyboard.press('Enter'); // Select

    // Move with arrow keys
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');

    // Switch tools with keyboard
    await page.keyboard.press('s'); // Select tool

    // Check for screen reader announcements (assume aria-live)
    const announcement = page.locator('[aria-live="polite"]');
    await expect(announcement).toContainText('Select tool activated');
  });
});