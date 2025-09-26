// features/canvas/utils/performance/ProductionKonvaOptimizer.ts

import Konva from 'konva';

/**
 * Production-ready Konva performance optimization utilities
 * Implements the checklist requirements for layer management, memory, and performance
 */

export interface KonvaPerformanceBudgets {
  maxLayers: number;           // 3-5 layers max
  maxNodesPerLayer: number;    // Nodes per layer threshold
  memoryPeakMB: number;        // 500MB memory budget
  targetFPS: number;           // 60fps target
  maxCanvasSize: number;       // Maximum canvas dimension
}

export const DEFAULT_BUDGETS: KonvaPerformanceBudgets = {
  maxLayers: 4,
  maxNodesPerLayer: 1000,
  memoryPeakMB: 500,
  targetFPS: 60,
  maxCanvasSize: 8192,
};

export interface LayerOptimizationResult {
  optimized: boolean;
  layerCount: number;
  staticLayersConfigured: number;
  nodesOptimized: number;
  cacheApplied: number;
  warnings: string[];
}

/**
 * Production Konva optimizer that enforces performance budgets
 */
export class ProductionKonvaOptimizer {
  private readonly budgets: KonvaPerformanceBudgets;
  private performanceWarnings: string[] = [];

  constructor(budgets: Partial<KonvaPerformanceBudgets> = {}) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets };
  }

  /**
   * Optimize stage for production with four-layer pipeline
   */
  optimizeStageForProduction(stage: Konva.Stage): LayerOptimizationResult {
    const result: LayerOptimizationResult = {
      optimized: false,
      layerCount: 0,
      staticLayersConfigured: 0,
      nodesOptimized: 0,
      cacheApplied: 0,
      warnings: [],
    };

    try {
      // Enforce layer count limits
      const layers = stage.getLayers();
      result.layerCount = layers.length;

      if (layers.length > this.budgets.maxLayers) {
        result.warnings.push(`Layer count (${layers.length}) exceeds budget (${this.budgets.maxLayers})`);
      }

      // Optimize each layer
      layers.forEach((layer, index) => {
        const layerResult = this.optimizeLayer(layer, index);
        result.staticLayersConfigured += layerResult.staticConfigured ? 1 : 0;
        result.nodesOptimized += layerResult.nodesOptimized;
        result.cacheApplied += layerResult.cacheApplied;
        result.warnings.push(...layerResult.warnings);
      });

      // Apply stage-level optimizations
      this.applyStageOptimizations(stage);

      result.optimized = true;
    } catch (error) {
      result.warnings.push(`Optimization failed: ${error}`);
    }

    return result;
  }

  /**
   * Optimize individual layer based on four-layer convention
   */
  private optimizeLayer(layer: Konva.Layer, index: number): {
    staticConfigured: boolean;
    nodesOptimized: number;
    cacheApplied: number;
    warnings: string[];
  } {
    const result = {
      staticConfigured: false,
      nodesOptimized: 0,
      cacheApplied: 0,
      warnings: [],
    };

    const nodes = layer.getChildren();
    
    // Check node count against budget
    if (nodes.length > this.budgets.maxNodesPerLayer) {
      (result.warnings as string[]).push(`Layer ${index} has ${nodes.length} nodes, exceeds budget (${this.budgets.maxNodesPerLayer})`);
    }

    // Configure static background layer (index 0)
    if (index === 0) {
      this.configureStaticLayer(layer);
      result.staticConfigured = true;
    }

    // Optimize nodes in this layer
    nodes.forEach(node => {
      const optimized = this.optimizeNode(node);
      if (optimized.cached) result.cacheApplied++;
      if (optimized.optimized) result.nodesOptimized++;
    });

    return result;
  }

  /**
   * Configure layer as static (non-interactive)
   */
  private configureStaticLayer(layer: Konva.Layer): void {
    // Disable listening to reduce hit-testing overhead
    layer.listening(false);
    
    // Do NOT use deprecated hitGraphEnabled; rely on listening(false)
    
    layer.batchDraw();
  }

  /**
   * Optimize individual node for performance
   */
  private optimizeNode(node: Konva.Node): { optimized: boolean; cached: boolean } {
    let optimized = false;
    let cached = false;

    try {
      const anyNode = node as unknown as {
        perfectDrawEnabled?: (enabled: boolean) => void;
        shadowForStrokeEnabled?: (enabled: boolean) => void;
        filters?: () => unknown[];
        text?: () => string;
      };

      // Disable perfect draw for performance
      if (typeof anyNode.perfectDrawEnabled === 'function') {
        anyNode.perfectDrawEnabled(false);
        optimized = true;
      }

      // Disable shadow for stroke to reduce overdraw
      if (typeof anyNode.shadowForStrokeEnabled === 'function') {
        anyNode.shadowForStrokeEnabled(false);
        optimized = true;
      }

      // Apply caching for complex shapes
      if (this.shouldCacheNode(node)) {
        this.cacheNodeSafely(node);
        cached = true;
      }

      // Setup drag layer optimization if draggable
      if (node.draggable()) {
        this.setupDragOptimization(node);
        optimized = true;
      }

    } catch (error) {
      // Ignore individual node optimization failures
    }

    return { optimized, cached };
  }

  /**
   * Determine if node should be cached based on complexity
   */
  private shouldCacheNode(node: Konva.Node): boolean {
    // Cache complex shapes, groups with many children, or nodes with filters
    if (node instanceof Konva.Group && node.getChildren().length > 10) return true;
    const filters = (node as unknown as { filters?: () => unknown[] }).filters?.();
    if (filters && filters.length > 0) return true;
    if (node instanceof Konva.Path) return true;
    if (node instanceof Konva.Text && ((node as unknown as { text?: () => string }).text?.()?.length ?? 0) > 100) return true;
    
    return false;
  }

  /**
   * Safely cache a node with error handling
   */
  private cacheNodeSafely(node: Konva.Node): void {
    try {
      if (typeof node.cache === 'function') {
        // Higher pixel ratio for HiDPI displays
        const dpr = window.devicePixelRatio || 1;
        node.cache({ pixelRatio: Math.min(dpr, 2) }); // Cap at 2x for performance
      }
    } catch (error) {
      // Ignore cache failures
    }
  }

  /**
   * Setup drag layer optimization for smoother interaction
   */
  private setupDragOptimization(node: Konva.Node): void {
    let originalParent: Konva.Container | null = null;
    let dragLayer: Konva.Layer | null = null;

    node.on('dragstart', () => {
      originalParent = node.getParent();
      const stage = node.getStage();
      
      if (stage && originalParent) {
        // Create or find drag layer (should be managed externally)
        dragLayer = stage.findOne('.drag-layer') as Konva.Layer;
        if (dragLayer) {
          node.moveTo(dragLayer);
          dragLayer.batchDraw();
        }
      }
    });

    node.on('dragend', () => {
      if (originalParent && dragLayer) {
        node.moveTo(originalParent);
        originalParent.getLayer()?.batchDraw();
        dragLayer.batchDraw();
      }
    });
  }

  /**
   * Apply stage-level optimizations
   */
  private applyStageOptimizations(stage: Konva.Stage): void {
    // Enforce canvas size limits
    const size = stage.size();
    if (size.width > this.budgets.maxCanvasSize || size.height > this.budgets.maxCanvasSize) {
      this.performanceWarnings.push(
        `Canvas size (${size.width}x${size.height}) exceeds budget (${this.budgets.maxCanvasSize})`
      );
    }

    // Apply container optimizations
    try {
      const container = stage.container();
      container.style.contain = 'layout paint size';
      container.style.willChange = 'transform';
      
      // Enable GPU compositing
      container.style.transform = 'translateZ(0)';
    } catch (error) {
      // Ignore container optimization failures
    }
  }

  /**
   * Get performance warnings accumulated during optimization
   */
  getPerformanceWarnings(): string[] {
    return [...this.performanceWarnings];
  }

  /**
   * Clear accumulated warnings
   */
  clearWarnings(): void {
    this.performanceWarnings = [];
  }

  /**
   * Validate stage against performance budgets
   */
  validatePerformanceBudgets(stage: Konva.Stage): {
    passed: boolean;
    violations: string[];
    metrics: {
      layerCount: number;
      totalNodes: number;
      canvasSize: { width: number; height: number };
    };
  } {
    const violations: string[] = [];
    const layers = stage.getLayers();
    const totalNodes = layers.reduce((sum, layer) => sum + layer.getChildren().length, 0);
    const canvasSize = stage.size();

    // Check layer count
    if (layers.length > this.budgets.maxLayers) {
      violations.push(`Layer count (${layers.length}) exceeds budget (${this.budgets.maxLayers})`);
    }

    // Check total nodes
    const maxTotalNodes = this.budgets.maxNodesPerLayer * this.budgets.maxLayers;
    if (totalNodes > maxTotalNodes) {
      violations.push(`Total nodes (${totalNodes}) exceeds budget (${maxTotalNodes})`);
    }

    // Check canvas size
    if (canvasSize.width > this.budgets.maxCanvasSize || canvasSize.height > this.budgets.maxCanvasSize) {
      violations.push(`Canvas size exceeds budget (${this.budgets.maxCanvasSize}x${this.budgets.maxCanvasSize})`);
    }

    return {
      passed: violations.length === 0,
      violations,
      metrics: {
        layerCount: layers.length,
        totalNodes,
        canvasSize,
      },
    };
  }
}

/**
 * Global production optimizer instance
 */
export const productionKonvaOptimizer = new ProductionKonvaOptimizer();

/**
 * Quick production optimization for existing stages
 */
export function optimizeStageForProduction(stage: Konva.Stage): LayerOptimizationResult {
  return productionKonvaOptimizer.optimizeStageForProduction(stage);
}

/**
 * Validate stage performance in production
 */
export function validateStagePerformance(stage: Konva.Stage) {
  return productionKonvaOptimizer.validatePerformanceBudgets(stage);
}