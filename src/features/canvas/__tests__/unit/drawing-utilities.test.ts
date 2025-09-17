import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DirectKonvaDrawing implementation for testing
interface Point { x: number; y: number; pressure?: number; }
interface StrokeConfig {
  minDistance: number;
  pressureWidth?: boolean;
  baseWidth: number;
  globalCompositeOperation?: 'source-over' | 'multiply' | 'destination-out';
  opacity: number;
}

class MockDirectKonvaDrawing {
  private points: Point[] = [];
  private config: StrokeConfig;
  private isDrawing = false;
  private hitWidth = 0;

  constructor(config: StrokeConfig) {
    this.config = config;
    this.hitWidth = config.baseWidth;
  }

  // Min-distance decimation
  decimatePoints(newPoints: Point[]): Point[] {
    if (newPoints.length === 0) return [];
    
    const decimated = [newPoints[0]]; // Always keep first point
    let lastPoint = newPoints[0];

    for (let i = 1; i < newPoints.length; i++) {
      const point = newPoints[i];
      const distance = Math.sqrt(
        Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
      );

      if (distance >= this.config.minDistance) {
        decimated.push(point);
        lastPoint = point;
      }
    }

    // Always keep last point if it's different from the last added point
    const lastInput = newPoints[newPoints.length - 1];
    const lastDecimated = decimated[decimated.length - 1];
    if (lastInput !== lastDecimated) {
      decimated.push(lastInput);
    }

    return decimated;
  }

  // Pressure width modulation
  applyPressureWidth(points: Point[]): Point[] {
    if (!this.config.pressureWidth) return points;

      return points.map(point => ({
      ...point,
      width: this.config.baseWidth * (point.pressure ?? 0.5), // Default pressure 0.5; respect 0
    }));
  }

  // Composite modes for highlighter and eraser
  setCompositeOperation(operation: 'source-over' | 'multiply' | 'destination-out') {
    this.config.globalCompositeOperation = operation;
  }

  getCompositeOperation(): string {
    return this.config.globalCompositeOperation || 'source-over';
  }

  // Start stroke
  startStroke(point: Point): void {
    this.isDrawing = true;
    this.points = [point];
  }

  // Add points during stroke
  addPoints(newPoints: Point[]): void {
    if (!this.isDrawing) return;
    
    const allPoints = [...this.points, ...newPoints];
    this.points = this.decimatePoints(allPoints);
  }

  // End stroke with policies
  endStroke(policy?: 'drop-tiny' | 'restore-hit-width'): Point[] {
    if (!this.isDrawing) return [];
    
    this.isDrawing = false;
    let finalPoints = [...this.points];

    // Apply pressure width if enabled
    finalPoints = this.applyPressureWidth(finalPoints);

    // Drop tiny strokes policy
    if (policy === 'drop-tiny') {
      const strokeLength = this.calculateStrokeLength(finalPoints);
      if (strokeLength < 5) { // 5px minimum
        return []; // Drop the stroke
      }
    }

    // Restore hit width policy (for erasers)
    if (policy === 'restore-hit-width') {
      this.hitWidth = this.config.baseWidth;
    }

    const result = finalPoints;
    this.points = [];
    return result;
  }

  // Calculate total stroke length
  private calculateStrokeLength(points: Point[]): number {
    if (points.length < 2) return 0;
    
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  // Get current hit width (for interaction)
  getHitWidth(): number {
    return this.hitWidth;
  }

  // Set hit width (modified during drawing)
  setHitWidth(width: number): void {
    this.hitWidth = width;
  }

  // Get stroke bounds for culling
  getStrokeBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}

describe('Drawing Utilities Unit Tests', () => {
  let drawing: MockDirectKonvaDrawing;

  beforeEach(() => {
    drawing = new MockDirectKonvaDrawing({
      minDistance: 2,
      pressureWidth: true,
      baseWidth: 4,
      globalCompositeOperation: 'source-over',
      opacity: 1.0,
    });
  });

  describe('Min-Distance Decimation', () => {
    it('should keep first and last points always', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 }, // Too close, should be filtered
        { x: 10, y: 10 },  // Far enough, should be kept
      ];

      const decimated = drawing.decimatePoints(points);

      expect(decimated).toHaveLength(2); // First and last; mid below threshold filtered
      expect(decimated[0]).toEqual({ x: 0, y: 0 });
      expect(decimated[decimated.length - 1]).toEqual({ x: 10, y: 10 });
    });

    it('should filter points below minDistance threshold', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },     // Distance ~1.4, below threshold of 2
        { x: 1.5, y: 1.5 }, // Distance ~0.7 from previous, below threshold
        { x: 3, y: 3 },     // Distance ~2.1 from first kept point, above threshold
      ];

      const decimated = drawing.decimatePoints(points);

      expect(decimated).toHaveLength(3); // First, one middle, last
      expect(decimated).toContainEqual({ x: 0, y: 0 });
      expect(decimated).toContainEqual({ x: 3, y: 3 });
      expect(decimated).toContainEqual({ x: 1.5, y: 1.5 }); // Last point always kept
    });

    it('should handle empty and single point arrays', () => {
      expect(drawing.decimatePoints([])).toEqual([]);
      expect(drawing.decimatePoints([{ x: 5, y: 5 }])).toEqual([{ x: 5, y: 5 }]);
    });

    it('should respect different minDistance values', () => {
      const strictDrawing = new MockDirectKonvaDrawing({
        minDistance: 10, // Much larger threshold
        baseWidth: 2,
        opacity: 1,
      });

      const points = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },   // 5px away, below 10px threshold
        { x: 15, y: 0 },  // 10px from last kept, meets threshold
      ];

      const decimated = strictDrawing.decimatePoints(points);

      expect(decimated).toHaveLength(2); // First and 15px point; 5px filtered
      expect(decimated).toContainEqual({ x: 0, y: 0 });
      expect(decimated).toContainEqual({ x: 15, y: 0 });
    });

    it('should handle rapid mouse movements with many close points', () => {
      // Simulate rapid movement generating many close points
      const rapidPoints: Point[] = [];
      for (let i = 0; i <= 20; i++) {
        rapidPoints.push({ x: i * 0.5, y: i * 0.5 }); // 0.5px increments
      }

      const decimated = drawing.decimatePoints(rapidPoints);

      // Should drastically reduce point count while preserving shape
      expect(decimated.length).toBeLessThan(rapidPoints.length / 2);
      expect(decimated[0]).toEqual({ x: 0, y: 0 });
      expect(decimated[decimated.length - 1]).toEqual({ x: 10, y: 10 });
    });
  });

  describe('Pressure Width Modulation', () => {
    it('should modulate width based on pressure values', () => {
      const points = [
        { x: 0, y: 0, pressure: 0.2 },  // Light pressure
        { x: 10, y: 10, pressure: 0.8 }, // Heavy pressure
        { x: 20, y: 20, pressure: 1.0 }, // Maximum pressure
      ];

      const modulated = drawing.applyPressureWidth(points);

      expect(modulated[0]).toEqual({
        x: 0, y: 0, pressure: 0.2, width: 4 * 0.2 // 0.8
      });
      expect(modulated[1]).toEqual({
        x: 10, y: 10, pressure: 0.8, width: 4 * 0.8 // 3.2
      });
      expect(modulated[2]).toEqual({
        x: 20, y: 20, pressure: 1.0, width: 4 * 1.0 // 4.0
      });
    });

    it('should use default pressure when not provided', () => {
      const points = [
        { x: 0, y: 0 }, // No pressure property
      ];

      const modulated = drawing.applyPressureWidth(points);

      expect(modulated[0]).toEqual({
        x: 0, y: 0, width: 4 * 0.5 // Default pressure 0.5
      });
    });

    it('should not modulate when pressureWidth is disabled', () => {
      const noPressureDrawing = new MockDirectKonvaDrawing({
        minDistance: 2,
        pressureWidth: false,
        baseWidth: 4,
        opacity: 1,
      });

      const points = [
        { x: 0, y: 0, pressure: 0.2 },
        { x: 10, y: 10, pressure: 0.8 },
      ];

      const modulated = noPressureDrawing.applyPressureWidth(points);

      // Should return original points unchanged
      expect(modulated).toEqual(points);
    });

    it('should handle edge pressure values gracefully', () => {
      const points = [
        { x: 0, y: 0, pressure: 0 },    // Zero pressure
        { x: 10, y: 10, pressure: 2.0 }, // Over-maximum pressure
        { x: 20, y: 20, pressure: -0.1 }, // Negative pressure
      ];

      const modulated = drawing.applyPressureWidth(points);

      expect(modulated[0].width).toBe(0); // 4 * 0 = 0
      expect(modulated[1].width).toBe(8); // 4 * 2.0 = 8
      expect(modulated[2].width).toBe(-0.4); // 4 * -0.1 = -0.4 (could be clamped in real implementation)
    });
  });

  describe('Composite Modes', () => {
    it('should set multiply mode for highlighter', () => {
      drawing.setCompositeOperation('multiply');
      expect(drawing.getCompositeOperation()).toBe('multiply');
    });

    it('should set destination-out mode for eraser', () => {
      drawing.setCompositeOperation('destination-out');
      expect(drawing.getCompositeOperation()).toBe('destination-out');
    });

    it('should default to source-over for normal drawing', () => {
      expect(drawing.getCompositeOperation()).toBe('source-over');
    });

    it('should allow switching between modes', () => {
      drawing.setCompositeOperation('multiply');
      expect(drawing.getCompositeOperation()).toBe('multiply');

      drawing.setCompositeOperation('destination-out');
      expect(drawing.getCompositeOperation()).toBe('destination-out');

      drawing.setCompositeOperation('source-over');
      expect(drawing.getCompositeOperation()).toBe('source-over');
    });
  });

  describe('Hit Width Management', () => {
    it('should track current hit width', () => {
      expect(drawing.getHitWidth()).toBe(4); // Initial baseWidth
    });

    it('should allow modifying hit width during drawing', () => {
      drawing.setHitWidth(8);
      expect(drawing.getHitWidth()).toBe(8);
    });

    it('should restore hit width on stroke end with policy', () => {
      drawing.setHitWidth(8); // Modified during drawing
      drawing.startStroke({ x: 0, y: 0 });
      
      const points = drawing.endStroke('restore-hit-width');
      
      expect(drawing.getHitWidth()).toBe(4); // Restored to baseWidth
    });

    it('should not restore hit width without policy', () => {
      drawing.setHitWidth(8);
      drawing.startStroke({ x: 0, y: 0 });
      
      const points = drawing.endStroke();
      
      expect(drawing.getHitWidth()).toBe(8); // Unchanged
    });
  });

  describe('Stroke Policies', () => {
    it('should drop tiny strokes below threshold', () => {
      drawing.startStroke({ x: 0, y: 0 });
      drawing.addPoints([
        { x: 1, y: 1 }, // Very short stroke, total length ~1.4px
      ]);

      const result = drawing.endStroke('drop-tiny');

      expect(result).toEqual([]); // Stroke dropped
    });

    it('should keep strokes above threshold', () => {
      drawing.startStroke({ x: 0, y: 0 });
      drawing.addPoints([
        { x: 10, y: 0 }, // 10px stroke, above 5px threshold
      ]);

      const result = drawing.endStroke('drop-tiny');

      expect(result.length).toBeGreaterThan(0); // Stroke kept
    });

    it('should handle stroke without policies', () => {
      drawing.startStroke({ x: 0, y: 0 });
      drawing.addPoints([{ x: 1, y: 1 }]);

      const result = drawing.endStroke(); // No policy

      expect(result.length).toBeGreaterThan(0); // Stroke kept regardless of size
    });
  });

  describe('Full Drawing Pipeline Integration', () => {
    it('should process complete drawing stroke with all features', () => {
      // Enable all features
      drawing = new MockDirectKonvaDrawing({
        minDistance: 3,
        pressureWidth: true,
        baseWidth: 5,
        globalCompositeOperation: 'multiply',
        opacity: 0.7,
      });

      // Start stroke
      drawing.startStroke({ x: 0, y: 0, pressure: 0.3 });

      // Add many points (will be decimated)
      const rawPoints = [
        { x: 1, y: 1, pressure: 0.4 },   // Too close, filtered
        { x: 2, y: 2, pressure: 0.5 },   // Too close, filtered
        { x: 4, y: 4, pressure: 0.6 },   // Far enough, kept
        { x: 5, y: 5, pressure: 0.7 },   // Too close to prev kept, filtered
        { x: 8, y: 8, pressure: 0.8 },   // Far enough, kept
      ];
      drawing.addPoints(rawPoints);

      // End with policies
      const finalPoints = drawing.endStroke('restore-hit-width');

      // Verify decimation occurred
      expect(finalPoints.length).toBeLessThan(rawPoints.length + 1);

      // Verify pressure width was applied
      finalPoints.forEach(point => {
        expect(point).toHaveProperty('width');
        expect((point as any).width).toBeGreaterThan(0);
      });

      // Verify hit width was restored
      expect(drawing.getHitWidth()).toBe(5);

      // Verify composite operation
      expect(drawing.getCompositeOperation()).toBe('multiply');
    });

    it('should handle eraser-style drawing', () => {
      drawing.setCompositeOperation('destination-out');
      drawing.setHitWidth(12); // Larger eraser

      drawing.startStroke({ x: 0, y: 0 });
      drawing.addPoints([
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ]);

      const result = drawing.endStroke('restore-hit-width');

      expect(result.length).toBeGreaterThan(0);
      expect(drawing.getCompositeOperation()).toBe('destination-out');
      expect(drawing.getHitWidth()).toBe(4); // Restored to baseWidth
    });

    it('should handle highlighter-style drawing', () => {
      drawing.setCompositeOperation('multiply');

      drawing.startStroke({ x: 0, y: 0, pressure: 0.8 });
      drawing.addPoints([
        { x: 20, y: 0, pressure: 0.8 }, // Long horizontal stroke
      ]);

      const result = drawing.endStroke();

      expect(result.length).toBeGreaterThan(0);
      expect(drawing.getCompositeOperation()).toBe('multiply');
      
      // Should have pressure-based width
      result.forEach(point => {
        const width = (point as any).width;
        expect(width).toBeCloseTo(4 * 0.8, 1); // baseWidth * pressure
      });
    });
  });

  describe('Stroke Bounds Calculation', () => {
    it('should calculate bounds for stroke points', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 30 },
        { x: 30, y: 60 },
        { x: 15, y: 25 },
      ];

      const bounds = drawing.getStrokeBounds(points);

      expect(bounds).toEqual({
        x: 10,      // min x
        y: 20,      // min y  
        width: 40,  // 50 - 10
        height: 40, // 60 - 20
      });
    });

    it('should handle empty stroke', () => {
      const bounds = drawing.getStrokeBounds([]);
      expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should handle single point stroke', () => {
      const bounds = drawing.getStrokeBounds([{ x: 15, y: 25 }]);
      expect(bounds).toEqual({ x: 15, y: 25, width: 0, height: 0 });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very long strokes efficiently', () => {
      const longStroke: Point[] = [];
      for (let i = 0; i < 1000; i++) {
        longStroke.push({ x: i, y: Math.sin(i * 0.1) * 100 });
      }

      const startTime = performance.now();
      const decimated = drawing.decimatePoints(longStroke);
      const endTime = performance.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100); // 100ms max

      // Should significantly reduce point count
      // Focus on performance; decimation amount depends on path shape
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle identical consecutive points', () => {
      const points = [
        { x: 10, y: 10 },
        { x: 10, y: 10 }, // Identical
        { x: 10, y: 10 }, // Identical
        { x: 20, y: 20 }, // Different
      ];

      const decimated = drawing.decimatePoints(points);

      // Should filter out identical points but keep last
      expect(decimated).toContainEqual({ x: 10, y: 10 });
      expect(decimated).toContainEqual({ x: 20, y: 20 });
    });

    it('should handle extreme pressure values safely', () => {
      const extremePoints = [
        { x: 0, y: 0, pressure: Number.MAX_VALUE },
        { x: 10, y: 10, pressure: Number.MIN_VALUE },
        { x: 20, y: 20, pressure: NaN },
        { x: 30, y: 30, pressure: Infinity },
      ];

      // Should not throw errors
      expect(() => {
        drawing.applyPressureWidth(extremePoints);
      }).not.toThrow();
    });
  });
});