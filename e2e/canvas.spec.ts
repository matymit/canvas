import { test, expect } from '@playwright/test';

test('User can draw, select, move, and undo on the canvas', async ({ page }) => {
  await page.goto('http://localhost:1421/');

  await page.click('button[aria-label="Pen Tool"]');
  const canvas = page.locator('canvas').first();
  const bbox = await canvas.boundingBox();
  if (!bbox) throw new Error('Canvas not found');

  await page.mouse.move(bbox.x + 100, bbox.y + 100);
  await page.mouse.down();
  await page.mouse.move(bbox.x + 150, bbox.y + 150);
  await page.mouse.up();

  await page.click('button[aria-label="Select Tool"]');
  await page.mouse.click(bbox.x + 140, bbox.y + 140);

  const transformer = await page.locator('div.transformer').first();
  await expect(transformer).toBeVisible();

  await page.keyboard.press('Delete');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');

  const elementsCount = await page.evaluate(() => window.useUnifiedCanvasStore.getState().elements.size);
  expect(elementsCount).toBe(1);
});
