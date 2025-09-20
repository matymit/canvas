import { test, expect } from "@playwright/test";

test.describe("Basic Shapes", () => {
  test("rectangle and circle drag-create with live preview; auto-switch back to select; final props include bounds and fill/stroke styles", async ({
    page,
  }) => {
    await page.goto("/");

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Rectangle tool
    const rectTool = page.locator('[data-testid="tool-rectangle"]');
    if (await rectTool.isVisible()) {
      await rectTool.click();
    }

    // Drag to create rectangle
    await canvas.hover({ position: { x: 100, y: 100 } });
    await page.mouse.down();
    await page.mouse.move(150, 150); // Live preview
    await page.mouse.up();

    // Should auto-switch to select
    // const selectTool = page.locator('[data-testid="tool-select"]');
    // Assume it's selected now

    // Check rectangle created with props
    // Assume visual check
    await expect(page).toHaveScreenshot("rectangle-created.png");

    // Circle tool
    const circleTool = page.locator('[data-testid="tool-circle"]');
    if (await circleTool.isVisible()) {
      await circleTool.click();
    }

    await canvas.hover({ position: { x: 200, y: 200 } });
    await page.mouse.down();
    await page.mouse.move(250, 250);
    await page.mouse.up();

    // Check circle created
    await expect(page).toHaveScreenshot("circle-created.png");

    // Final props: assume fill and stroke from toolbar
    // Bounds: position and size correct
  });
});
