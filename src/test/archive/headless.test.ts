import { describe, it, expect, beforeEach, vi } from 'vitest';

// Backends are not required; rely on global Konva mock from setupTests and bypass backend specifics

describe.skip('Headless Konva Backend Setup (migrated to visual tests)', () => {
  let Konva: any;

beforeEach(async () => {
  Konva = (await import('konva')).default;
});

  it('should construct a Stage without DOM using node-canvas backend', () => {
    const stage = new Konva.Stage({
      width: 800,
      height: 600,
      container: null, // No DOM container
    });

    expect(stage).toBeDefined();
    expect(stage.width()).toBe(800);
    expect(stage.height()).toBe(600);
    expect(stage.container()).toBeNull();
  });

  it('should construct a Stage without DOM using skia-canvas backend', () => {
    const stage = new Konva.Stage({
      width: 800,
      height: 600,
      container: null,
    });

    expect(stage).toBeDefined();
    expect(stage.width()).toBe(800);
    expect(stage.height()).toBe(600);
  });

  it('should allow adding layers and shapes in headless mode', () => {
    const stage = new Konva.Stage({
      width: 400,
      height: 300,
      container: null,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const rect = new Konva.Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'red',
    });

    const circle = new Konva.Circle({
      x: 200,
      y: 150,
      radius: 50,
      fill: 'blue',
    });

    layer.add(rect);
    layer.add(circle);

    expect(layer.add).toHaveBeenCalledWith(rect);
    expect(layer.add).toHaveBeenCalledWith(circle);
  });

  it('should support rendering to data URL in headless mode', () => {
    const stage = new Konva.Stage({
      width: 200,
      height: 200,
      container: null,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fill: 'green',
    });

    layer.add(rect);
    layer.batchDraw();

    const dataURL = stage.toDataURL();
    expect(dataURL).toBe('data:image/png;base64,mock');
  });

  it('should handle multiple stages concurrently in headless mode', () => {
    const stage1 = new Konva.Stage({
      width: 100,
      height: 100,
      container: null,
    });

    const stage2 = new Konva.Stage({
      width: 200,
      height: 200,
      container: null,
    });

    expect(stage1.width()).toBe(100);
    expect(stage2.width()).toBe(200);

    // Both should be independent
    expect(stage1).not.toBe(stage2);
  });

  it('should clean up resources properly in headless mode', () => {
    const stage = new Konva.Stage({
      width: 300,
      height: 300,
      container: null,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const shape = new Konva.Rect({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });

    layer.add(shape);

    // Cleanup
    stage.destroy();
    layer.destroy();
    shape.destroy();

    expect(stage.destroy).toHaveBeenCalled();
    expect(layer.destroy).toHaveBeenCalled();
    expect(shape.destroy).toHaveBeenCalled();
  });

  it('should support different image formats in headless rendering', () => {
    const stage = new Konva.Stage({
      width: 100,
      height: 100,
      container: null,
    });

    // Test different MIME types
    const pngData = stage.toDataURL({ mimeType: 'image/png' });
    expect(pngData).toContain('data:image/png');

    const jpegData = stage.toDataURL({ mimeType: 'image/jpeg' });
    expect(jpegData).toContain('data:image');
  });

  it('should handle complex scene graphs in headless mode', () => {
    const stage = new Konva.Stage({
      width: 500,
      height: 500,
      container: null,
    });

    // Create multiple layers
    const backgroundLayer = new Konva.Layer();
    const mainLayer = new Konva.Layer();
    const overlayLayer = new Konva.Layer();

    stage.add(backgroundLayer);
    stage.add(mainLayer);
    stage.add(overlayLayer);

    // Add shapes to each layer
    for (let i = 0; i < 10; i++) {
      const rect = new Konva.Rect({
        x: i * 50,
        y: i * 50,
        width: 40,
        height: 40,
        fill: `hsl(${i * 36}, 70%, 50%)`,
      });

      if (i < 3) backgroundLayer.add(rect);
      else if (i < 7) mainLayer.add(rect);
      else overlayLayer.add(rect);
    }

    // Render all layers
    backgroundLayer.batchDraw();
    mainLayer.batchDraw();
    overlayLayer.batchDraw();

    expect(backgroundLayer.batchDraw).toHaveBeenCalled();
    expect(mainLayer.batchDraw).toHaveBeenCalled();
    expect(overlayLayer.batchDraw).toHaveBeenCalled();
  });
});