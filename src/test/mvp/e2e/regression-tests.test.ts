import { test, expect } from "@playwright/test";

test.describe("Regression documentation (known failures)", () => {
  test.fixme("Sticky note selection transformer is not visible (known regression)", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 120, y: 120 } });
    await page.waitForTimeout(50);
    // Expected to be broken currently
    const transformerVisible = await page.evaluate(() => {
      const stage = (window as any).konvaStage;
      if (!stage) return false;
      const tr = stage.findOne("Transformer");
      return tr ? tr.visible() : false;
    });
    expect(transformerVisible).toBe(true);
  });

  test.fixme("Circle text edit portal does not open on double click (known regression)", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();
    await canvas.dblclick({ position: { x: 160, y: 160 } });
    await page.waitForTimeout(100);
    const portalOpen = await page.locator('[data-testid="text-edit-portal"]');
    await expect(portalOpen).toBeVisible();
  });

  test.fixme("Drawing tools render at cursor position (known offset regression)", async ({ page }) => {
    await page.goto("/");
    const pen = page.locator('[data-testid="tool-pen"]');
    if (await pen.isVisible()) await pen.click();
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(240, 240);
    await page.mouse.up();
    await expect(page).toHaveScreenshot("pen-near-cursor.png");
  });
});
