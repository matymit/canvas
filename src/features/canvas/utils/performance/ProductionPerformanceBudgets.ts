// features/canvas/utils/performance/ProductionPerformanceBudgets.ts

/**
 * Production performance budgets and monitoring system
 * Implements the checklist requirements for performance validation
 */

export interface PerformanceBudgets {
  // Core performance metrics from technical report
  firstContentfulPaint: number;     // 1.5s FCP target
  timeToInteractive: number;        // 3s TTI target
  targetFPS: number;                // 60fps sustained
  memoryPeakMB: number;             // 500MB memory budget
  
  // Canvas-specific budgets
  maxLayers: number;                // 3-5 layers max
  maxNodesPerLayer: number;         // Nodes per layer threshold
  maxCanvasSize: number;            // Maximum canvas dimension
  maxDrawOperationsPerFrame: number; // Draw ops per frame
  
  // Bundle size budgets
  totalBundleSize: number;          // Total JS bundle size (KB)
  chunkSizeWarning: number;         // Individual chunk warning (KB)
  assetSizeLimit: number;           // Individual asset limit (KB)
}

export const PRODUCTION_BUDGETS: PerformanceBudgets = {
  // Performance budgets from checklist
  firstContentfulPaint: 1500,       // 1.5s
  timeToInteractive: 3000,          // 3s  
  targetFPS: 60,                    // 60fps
  memoryPeakMB: 500,                // 500MB
  
  // Canvas budgets
  maxLayers: 4,                     // background, main, preview, overlay
  maxNodesPerLayer: 1000,           // 1k nodes per layer
  maxCanvasSize: 8192,              // 8k max dimension
  maxDrawOperationsPerFrame: 100,   // 100 draw ops per frame
  
  // Bundle budgets aligned with Vite config
  totalBundleSize: 4096,            // 4MB total
  chunkSizeWarning: 1024,           // 1MB chunk warning
  assetSizeLimit: 512,              // 512KB asset limit
};

export interface PerformanceMetrics {
  timestamp: number;
  fcp?: number;
  tti?: number;
  fps: number;
  memoryUsedMB: number;
  canvasMetrics: {
    layerCount: number;
    totalNodes: number;
    canvasSize: { width: number; height: number };
    drawOperations: number;
  };
  bundleMetrics?: {
    totalSize: number;
    chunkSizes: Record<string, number>;
    assetSizes: Record<string, number>;
  };
}

export interface BudgetViolation {
  metric: keyof PerformanceBudgets;
  actual: number;
  budget: number;
  severity: 'warning' | 'error';
  message: string;
}

export interface PerformanceReport {
  passed: boolean;
  score: number; // 0-100
  violations: BudgetViolation[];
  metrics: PerformanceMetrics;
  recommendations: string[];
}

/**
 * Production performance budget validator
 */
export class ProductionPerformanceBudgets {
  private readonly budgets: PerformanceBudgets;
  private metricsHistory: PerformanceMetrics[] = [];
  private observer?: PerformanceObserver;
  private readonly fpsCounter: FPSCounter;

  constructor(customBudgets: Partial<PerformanceBudgets> = {}) {
    this.budgets = { ...PRODUCTION_BUDGETS, ...customBudgets };
    this.fpsCounter = new FPSCounter();
    
    if (typeof window !== 'undefined') {
      this.setupPerformanceObserver();
    }
  }

  /**
   * Validate current performance against budgets
   */
  async validatePerformance(canvasMetrics?: PerformanceMetrics['canvasMetrics']): Promise<PerformanceReport> {
    const metrics = await this.gatherMetrics(canvasMetrics);
    const violations = this.checkBudgets(metrics);
    const score = this.calculateScore(violations);
    const recommendations = this.generateRecommendations(violations);

    return {
      passed: violations.filter(v => v.severity === 'error').length === 0,
      score,
      violations,
      metrics,
      recommendations,
    };
  }

  /**
   * Gather current performance metrics
   */
  private async gatherMetrics(canvasMetrics?: PerformanceMetrics['canvasMetrics']): Promise<PerformanceMetrics> {
    const now = Date.now();
    
    // Web Vitals metrics
    const fcp = this.getFCP();
    const tti = this.getTTI();
    
    // Runtime metrics
    const fps = this.fpsCounter.getCurrentFPS();
    const memoryUsedMB = this.getMemoryUsage();

    // Default canvas metrics if not provided
    const defaultCanvasMetrics = {
      layerCount: 0,
      totalNodes: 0,
      canvasSize: { width: 0, height: 0 },
      drawOperations: 0,
    };

    const metrics: PerformanceMetrics = {
      timestamp: now,
      fcp,
      tti,
      fps,
      memoryUsedMB,
      canvasMetrics: canvasMetrics || defaultCanvasMetrics,
    };

    // Store in history
    this.metricsHistory.push(metrics);
    
    // Keep only last 100 entries
    if (this.metricsHistory.length > 100) {
      this.metricsHistory = this.metricsHistory.slice(-100);
    }

    return metrics;
  }

  /**
   * Check metrics against budgets
   */
  private checkBudgets(metrics: PerformanceMetrics): BudgetViolation[] {
    const violations: BudgetViolation[] = [];

    // FCP budget
    if (metrics.fcp && metrics.fcp > this.budgets.firstContentfulPaint) {
      violations.push({
        metric: 'firstContentfulPaint',
        actual: metrics.fcp,
        budget: this.budgets.firstContentfulPaint,
        severity: 'error',
        message: `First Contentful Paint (${metrics.fcp}ms) exceeds budget (${this.budgets.firstContentfulPaint}ms)`,
      });
    }

    // TTI budget
    if (metrics.tti && metrics.tti > this.budgets.timeToInteractive) {
      violations.push({
        metric: 'timeToInteractive',
        actual: metrics.tti,
        budget: this.budgets.timeToInteractive,
        severity: 'error',
        message: `Time to Interactive (${metrics.tti}ms) exceeds budget (${this.budgets.timeToInteractive}ms)`,
      });
    }

    // FPS budget
    if (metrics.fps < this.budgets.targetFPS) {
      const severity = metrics.fps < this.budgets.targetFPS * 0.8 ? 'error' : 'warning';
      violations.push({
        metric: 'targetFPS',
        actual: metrics.fps,
        budget: this.budgets.targetFPS,
        severity,
        message: `FPS (${metrics.fps.toFixed(1)}) below target (${this.budgets.targetFPS})`,
      });
    }

    // Memory budget
    if (metrics.memoryUsedMB > this.budgets.memoryPeakMB) {
      violations.push({
        metric: 'memoryPeakMB',
        actual: metrics.memoryUsedMB,
        budget: this.budgets.memoryPeakMB,
        severity: 'error',
        message: `Memory usage (${metrics.memoryUsedMB.toFixed(1)}MB) exceeds budget (${this.budgets.memoryPeakMB}MB)`,
      });
    }

    // Canvas-specific budgets
    const { canvasMetrics } = metrics;
    
    if (canvasMetrics.layerCount > this.budgets.maxLayers) {
      violations.push({
        metric: 'maxLayers',
        actual: canvasMetrics.layerCount,
        budget: this.budgets.maxLayers,
        severity: 'warning',
        message: `Layer count (${canvasMetrics.layerCount}) exceeds budget (${this.budgets.maxLayers})`,
      });
    }

    const maxDimension = Math.max(canvasMetrics.canvasSize.width, canvasMetrics.canvasSize.height);
    if (maxDimension > this.budgets.maxCanvasSize) {
      violations.push({
        metric: 'maxCanvasSize',
        actual: maxDimension,
        budget: this.budgets.maxCanvasSize,
        severity: 'warning',
        message: `Canvas size (${maxDimension}px) exceeds budget (${this.budgets.maxCanvasSize}px)`,
      });
    }

    if (canvasMetrics.drawOperations > this.budgets.maxDrawOperationsPerFrame) {
      violations.push({
        metric: 'maxDrawOperationsPerFrame',
        actual: canvasMetrics.drawOperations,
        budget: this.budgets.maxDrawOperationsPerFrame,
        severity: 'warning',
        message: `Draw operations (${canvasMetrics.drawOperations}) exceed budget (${this.budgets.maxDrawOperationsPerFrame})`,
      });
    }

    return violations;
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculateScore(violations: BudgetViolation[]): number {
    let score = 100;
    
    for (const violation of violations) {
      const penalty = violation.severity === 'error' ? 20 : 10;
      score -= penalty;
    }
    
    return Math.max(0, score);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(violations: BudgetViolation[]): string[] {
    const recommendations: string[] = [];
    
    for (const violation of violations) {
      switch (violation.metric) {
        case 'firstContentfulPaint':
          recommendations.push('Optimize bundle size, use code splitting, preload critical resources');
          break;
        case 'timeToInteractive':
          recommendations.push('Reduce main thread blocking, defer non-critical JS, optimize hydration');
          break;
        case 'targetFPS':
          recommendations.push('Use RAF batching, reduce layer count, cache complex shapes, disable perfect draw');
          break;
        case 'memoryPeakMB':
          recommendations.push('Cleanup unused nodes, dispose tweens, implement object pooling');
          break;
        case 'maxLayers':
          recommendations.push('Consolidate layers, use FastLayer for temporary operations');
          break;
        case 'maxCanvasSize':
          recommendations.push('Implement viewport culling, reduce canvas dimensions');
          break;
        case 'maxDrawOperationsPerFrame':
          recommendations.push('Batch draw operations, use dirty rectangle optimization');
          break;
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Setup performance observer for Web Vitals
   */
  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
            // Store FCP measurement
          }
        }
      });
      
      this.observer.observe({ entryTypes: ['paint', 'navigation'] });
    } catch (error) {
      // Ignore observer setup failures
    }
  }

  /**
   * Get First Contentful Paint
   */
  private getFCP(): number | undefined {
    if (typeof window === 'undefined') return undefined;
    
    try {
      const entries = performance.getEntriesByName('first-contentful-paint');
      return entries.length > 0 ? entries[0].startTime : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get Time to Interactive (approximation)
   */
  private getTTI(): number | undefined {
    if (typeof window === 'undefined') return undefined;
    
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        return nav.domInteractive - (nav.startTime || 0);
      }
    } catch {
      // Fallback to load event
      const loadEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (loadEntries.length > 0) {
        const nav = loadEntries[0];
        return nav.loadEventEnd - (nav.startTime || 0);
      }
    }
    
    return undefined;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    // Prefer globalThis to support both browser and jsdom/node test contexts
    const perf = (typeof globalThis !== 'undefined' && (globalThis as unknown as { performance?: { memory?: { usedJSHeapSize: number } } }).performance) ? (globalThis as unknown as { performance: { memory?: { usedJSHeapSize: number } } }).performance : undefined;
    if (!perf) return 0;

    try {
      if (perf.memory && typeof perf.memory.usedJSHeapSize === 'number') {
        return perf.memory.usedJSHeapSize / (1024 * 1024);
      }
    } catch {
      // ignore
    }

    return 0;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metricsHistory = [];
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.fpsCounter.dispose();
  }
}

/**
 * FPS Counter utility
 */
class FPSCounter {
  private frameCount = 0;
  private lastTime = 0;
  private fps = 0;
  private rafId = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.start();
    }
  }

  private start(): void {
    const loop = (time: number) => {
      if (this.lastTime) {
        this.frameCount++;
        if (time - this.lastTime >= 1000) {
          this.fps = Math.round((this.frameCount * 1000) / (time - this.lastTime));
          this.frameCount = 0;
          this.lastTime = time;
        }
      } else {
        this.lastTime = time;
      }
      
      this.rafId = requestAnimationFrame(loop);
    };
    
    this.rafId = requestAnimationFrame(loop);
  }

  getCurrentFPS(): number {
    return this.fps;
  }

  dispose(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

/**
 * Global production performance budgets instance
 */
export const productionPerformanceBudgets = new ProductionPerformanceBudgets();

/**
 * Quick performance validation
 */
export async function validateProductionPerformance(canvasMetrics?: PerformanceMetrics['canvasMetrics']): Promise<PerformanceReport> {
  return productionPerformanceBudgets.validatePerformance(canvasMetrics);
}