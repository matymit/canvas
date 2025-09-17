// Phase 11 Comprehensive E2E Tests
import { test, expect } from '@playwright/test';
import {
  launchTestCanvas,
  getCanvasStage,
  waitForCanvasReady,
  selectTool,
  drawOnCanvas,
  getElement,
  expectEventuallyTruthy
} from './test-utils';

test.describe('Phase 11: Final Implementation Gaps', () => {
  test.beforeEach(async ({ page }) => {
    await launchTestCanvas(page);
    await waitForCanvasReady(page);
  });

  test.describe('Sticky Note Color Changes', () => {
    test('should change sticky note color through UI', async ({ page }) => {
      // Select sticky note tool
      await selectTool(page, 'sticky-note');

      // Create a sticky note
      await page.mouse.click(400, 300);

      // Wait for sticky note to appear
      await page.waitForTimeout(500);

      // Select the sticky note
      await selectTool(page, 'select');
      await page.mouse.click(400, 300);

      // Open color portal
      const colorButton = await page.locator('[data-testid="sticky-color-button"]');
      await colorButton.click();

      // Select a different color (e.g., blue)
      const blueOption = await page.locator('[data-testid="sticky-color-blue"]');
      await blueOption.click();

      // Verify color changed in canvas
      const stage = await getCanvasStage(page);
      const stickyColor = await page.evaluate((stageId) => {
        const stage = window[stageId];
        const sticky = stage.findOne('.sticky-note');
        return sticky?.fill();
      }, stage);

      expect(stickyColor).toBe('#3B82F6'); // Blue color
    });

    test('should persist sticky note color through undo/redo', async ({ page }) => {
      // Create sticky note
      await selectTool(page, 'sticky-note');
      await page.mouse.click(400, 300);

      // Change color
      await selectTool(page, 'select');
      await page.mouse.click(400, 300);

      const colorButton = await page.locator('[data-testid="sticky-color-button"]');
      await colorButton.click();

      const greenOption = await page.locator('[data-testid="sticky-color-green"]');
      await greenOption.click();

      // Undo
      await page.keyboard.press('Control+z');

      // Verify original color restored
      const stage = await getCanvasStage(page);
      let stickyColor = await page.evaluate((stageId) => {
        const stage = window[stageId];
        const sticky = stage.findOne('.sticky-note');
        return sticky?.fill();
      }, stage);

      expect(stickyColor).toBe('#FEF3C7'); // Default yellow

      // Redo
      await page.keyboard.press('Control+y');

      // Verify color change reapplied
      stickyColor = await page.evaluate((stageId) => {
        const stage = window[stageId];
        const sticky = stage.findOne('.sticky-note');
        return sticky?.fill();
      }, stage);

      expect(stickyColor).toBe('#10B981'); // Green color
    });
  });

  test.describe('Text Editor Entry/Exit', () => {
    test('should enter text editor on double-click', async ({ page }) => {
      // Select text tool
      await selectTool(page, 'text');

      // Click to create text
      await page.mouse.click(400, 300);

      // Verify text editor appears
      const textEditor = await page.locator('[data-testid="text-portal-input"]');
      await expect(textEditor).toBeVisible();

      // Type some text
      await page.keyboard.type('Hello Canvas');

      // Press Enter to commit
      await page.keyboard.press('Enter');

      // Verify text editor is hidden
      await expect(textEditor).not.toBeVisible();

      // Double-click to re-enter edit mode
      await page.mouse.dblclick(400, 300);

      // Verify text editor reappears
      await expect(textEditor).toBeVisible();

      // Press Escape to cancel
      await page.keyboard.press('Escape');

      // Verify text editor is hidden without changes
      await expect(textEditor).not.toBeVisible();
    });

    test('should measure text width correctly', async ({ page }) => {
      await selectTool(page, 'text');
      await page.mouse.click(400, 300);

      const textEditor = await page.locator('[data-testid="text-portal-input"]');

      // Type text and verify width updates
      await page.keyboard.type('Short');
      let width = await textEditor.evaluate(el => el.style.width);
      const shortWidth = parseInt(width);

      await page.keyboard.type(' text that is much longer');
      width = await textEditor.evaluate(el => el.style.width);
      const longWidth = parseInt(width);

      expect(longWidth).toBeGreaterThan(shortWidth);

      // Commit and verify final size
      await page.keyboard.press('Enter');

      const stage = await getCanvasStage(page);
      const textWidth = await page.evaluate((stageId) => {
        const stage = window[stageId];
        const text = stage.findOne('Text');
        return text?.width();
      }, stage);

      expect(textWidth).toBeCloseTo(longWidth, -1);
    });
  });

  test.describe('Grid Crispness at Different Zoom Levels', () => {
    test('should maintain grid crispness at various zoom levels', async ({ page }) => {
      // Enable grid
      const gridToggle = await page.locator('[data-testid="grid-toggle"]');
      await gridToggle.click();

      const zoomLevels = [0.5, 1, 1.5, 2, 4];

      for (const zoom of zoomLevels) {
        // Set zoom level
        await page.evaluate((z) => {
          const store = window.useUnifiedCanvasStore?.getState();
          store?.viewport?.setZoom(z);
        }, zoom);

        // Take screenshot for visual comparison
        await page.screenshot({
          path: `test-results/grid-zoom-${zoom}.png`,
          clip: { x: 200, y: 200, width: 400, height: 400 }
        });

        // Verify grid lines are rendered with correct DPR
        const gridQuality = await page.evaluate(() => {
          const stage = window.canvasStage;
          const bgLayer = stage?.getLayers()[0];
          const grid = bgLayer?.findOne('.grid');
          return {
            pixelRatio: bgLayer?.getCanvas().pixelRatio,
            strokeWidth: grid?.strokeWidth(),
            opacity: grid?.opacity()
          };
        });

        expect(gridQuality.pixelRatio).toBeGreaterThanOrEqual(1);
        expect(gridQuality.strokeWidth).toBeLessThanOrEqual(1);
        expect(gridQuality.opacity).toBeLessThanOrEqual(0.2);
      }
    });
  });

  test.describe('Connector Live Routing', () => {
    test('should update connector routing when endpoints move', async ({ page }) => {
      // Create two shapes
      await selectTool(page, 'draw-rectangle');
      await drawOnCanvas(page, { x: 200, y: 200 }, { x: 300, y: 300 });
      await drawOnCanvas(page, { x: 500, y: 200 }, { x: 600, y: 300 });

      // Create connector between them
      await selectTool(page, 'connector-arrow');
      await page.mouse.click(250, 250); // Center of first rectangle
      await page.mouse.click(550, 250); // Center of second rectangle

      // Move first shape
      await selectTool(page, 'select');
      await page.mouse.move(250, 250);
      await page.mouse.down();
      await page.mouse.move(250, 400);
      await page.mouse.up();

      // Verify connector updated
      const connectorPath = await page.evaluate(() => {
        const stage = window.canvasStage;
        const connector = stage?.findOne('.connector');
        return connector?.points();
      });

      expect(connectorPath).toBeTruthy();
      expect(connectorPath[1]).toBeCloseTo(400, 50); // Y position updated
    });

    test('should maintain connector anchors during shape resize', async ({ page }) => {
      // Create shapes with connector
      await selectTool(page, 'draw-rectangle');
      await drawOnCanvas(page, { x: 200, y: 200 }, { x: 300, y: 300 });
      await drawOnCanvas(page, { x: 500, y: 200 }, { x: 600, y: 300 });

      await selectTool(page, 'connector-arrow');
      await page.mouse.click(300, 250); // Right edge of first rectangle
      await page.mouse.click(500, 250); // Left edge of second rectangle

      // Select and resize first shape
      await selectTool(page, 'select');
      await page.mouse.click(250, 250);

      // Drag resize handle
      const handle = await page.locator('.konva-transformer-handle-SE');
      await handle.dragTo(page.locator('body'), {
        sourcePosition: { x: 0, y: 0 },
        targetPosition: { x: 350, y: 350 }
      });

      // Verify connector still attached to edge
      const connectorStart = await page.evaluate(() => {
        const stage = window.canvasStage;
        const connector = stage?.findOne('.connector');
        const points = connector?.points();
        return { x: points?.[0], y: points?.[1] };
      });

      expect(connectorStart.x).toBeCloseTo(350, 20); // Updated to new edge position
    });
  });

  test.describe('Undo/Redo Atomicity', () => {
    test('should batch transform operations atomically', async ({ page }) => {
      // Create multiple shapes
      await selectTool(page, 'draw-rectangle');
      await drawOnCanvas(page, { x: 200, y: 200 }, { x: 300, y: 300 });
      await drawOnCanvas(page, { x: 400, y: 200 }, { x: 500, y: 300 });

      // Multi-select
      await selectTool(page, 'select');
      await page.keyboard.down('Shift');
      await page.mouse.click(250, 250);
      await page.mouse.click(450, 250);
      await page.keyboard.up('Shift');

      // Transform both
      await page.mouse.move(350, 250);
      await page.mouse.down();
      await page.mouse.move(350, 400);
      await page.mouse.up();

      // Undo should revert both shapes
      await page.keyboard.press('Control+z');

      const positions = await page.evaluate(() => {
        const stage = window.canvasStage;
        const shapes = stage?.find('.shape');
        return shapes?.map(s => ({ x: s.x(), y: s.y() }));
      });

      expect(positions[0].y).toBeCloseTo(200, 10);
      expect(positions[1].y).toBeCloseTo(200, 10);

      // Redo should reapply to both
      await page.keyboard.press('Control+y');

      const newPositions = await page.evaluate(() => {
        const stage = window.canvasStage;
        const shapes = stage?.find('.shape');
        return shapes?.map(s => ({ x: s.x(), y: s.y() }));
      });

      expect(newPositions[0].y).toBeCloseTo(350, 10);
      expect(newPositions[1].y).toBeCloseTo(350, 10);
    });

    test('should batch drawing strokes atomically', async ({ page }) => {
      // Draw with pen
      await selectTool(page, 'pen');

      await page.mouse.move(200, 200);
      await page.mouse.down();
      await page.mouse.move(300, 300);
      await page.mouse.move(400, 200);
      await page.mouse.up();

      // Draw another stroke
      await page.mouse.move(200, 400);
      await page.mouse.down();
      await page.mouse.move(300, 400);
      await page.mouse.move(400, 400);
      await page.mouse.up();

      // Each stroke should be one undo operation
      const countBefore = await page.evaluate(() => {
        const stage = window.canvasStage;
        return stage?.find('Line').length;
      });

      expect(countBefore).toBe(2);

      // Undo first stroke
      await page.keyboard.press('Control+z');

      const countAfterUndo1 = await page.evaluate(() => {
        const stage = window.canvasStage;
        return stage?.find('Line').length;
      });

      expect(countAfterUndo1).toBe(1);

      // Undo second stroke
      await page.keyboard.press('Control+z');

      const countAfterUndo2 = await page.evaluate(() => {
        const stage = window.canvasStage;
        return stage?.find('Line').length;
      });

      expect(countAfterUndo2).toBe(0);
    });
  });

  test.describe('Selection Marquee', () => {
    test('should select multiple elements with marquee', async ({ page }) => {
      // Create multiple shapes
      await selectTool(page, 'draw-rectangle');
      await drawOnCanvas(page, { x: 200, y: 200 }, { x: 250, y: 250 });
      await drawOnCanvas(page, { x: 300, y: 200 }, { x: 350, y: 250 });
      await drawOnCanvas(page, { x: 400, y: 200 }, { x: 450, y: 250 });

      // Marquee select
      await selectTool(page, 'select');
      await page.mouse.move(150, 150);
      await page.mouse.down();
      await page.mouse.move(500, 300);
      await page.mouse.up();

      // Verify all shapes selected
      const selectedCount = await page.evaluate(() => {
        const store = window.useUnifiedCanvasStore?.getState();
        return store?.selection?.selected?.length || 0;
      });

      expect(selectedCount).toBe(3);

      // Verify transformer attached to all
      const transformerNodes = await page.evaluate(() => {
        const stage = window.canvasStage;
        const transformer = stage?.findOne('Transformer');
        return transformer?.nodes().length;
      });

      expect(transformerNodes).toBe(3);
    });

    test('should update marquee preview during drag', async ({ page }) => {
      await selectTool(page, 'select');

      // Start marquee
      await page.mouse.move(100, 100);
      await page.mouse.down();

      // Move to create marquee
      await page.mouse.move(300, 300);

      // Check marquee rect exists on overlay
      const marqueeExists = await page.evaluate(() => {
        const stage = window.canvasStage;
        const overlay = stage?.getLayers()[3]; // Overlay layer
        const marquee = overlay?.findOne('.selection-marquee');
        return marquee !== undefined && marquee !== null;
      });

      expect(marqueeExists).toBe(true);

      // Complete marquee
      await page.mouse.up();

      // Marquee should be cleared
      const marqueeCleared = await page.evaluate(() => {
        const stage = window.canvasStage;
        const overlay = stage?.getLayers()[3];
        const marquee = overlay?.findOne('.selection-marquee');
        return marquee === undefined || marquee === null;
      });

      expect(marqueeCleared).toBe(true);
    });
  });
});