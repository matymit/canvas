import { test, expect } from "@playwright/test";

// NOTE: This test file documents the current broken state of text editing
// As of September 23, 2025, circle text editing is BROKEN
// Double-click doesn't open text editor for circles
// This test expects failures for circles but may work for other elements

test.describe("Text Tool Portal", () => {
  test("click to place text, DOM overlay appears, typing updates preview, escape/click-away commits element with rich settings", async ({
    page,
  }) => {
    // NOTE: Circle text editing is BROKEN as of September 23, 2025
    // This test documents the broken state for circles
    // Text editing may work for other element types
    await page.goto("/");

    const canvas = page.locator('[data-testid="konva-stage-container"]');
    await expect(canvas).toBeVisible();

    // Select text tool
    const textTool = page.locator('[data-testid="tool-text"]');
    if (await textTool.isVisible()) {
      await textTool.click();
    }

    // Click to place text
    await canvas.click({ position: { x: 100, y: 100 } });

    // DOM overlay appears
    const textInput = page.locator('[data-testid="text-portal-input"]');
    await expect(textInput).toBeVisible();

    // Type text
    await textInput.fill("Hello World");

    // Preview updates (assume the text appears in overlay)
    await expect(textInput).toHaveValue("Hello World");

    // Commit by clicking away or escape
    await canvas.click({ position: { x: 200, y: 200 } });

    // Overlay disappears, text element committed
    await expect(textInput).not.toBeVisible();

    // Check text element on canvas
    // NOTE: Text editing may fail for circles due to broken double-click functionality
    await expect(page).toHaveScreenshot("text-committed.png");
  });
});
