// Enhanced TransformerController specifically for table elements
// Provides aspect ratio locking, proper bounds, and prevents cell malformation

import Konva from 'konva';
import { TransformerController, TransformerControllerOptions } from '../TransformerController';
import type { TableElement } from '../../types/table';
import { DEFAULT_TABLE_CONFIG } from '../../types/table';

export interface TableTransformerControllerOptions extends Omit<TransformerControllerOptions, 'boundBoxFunc'> {
  element: TableElement;
  onTableTransform?: (element: TableElement, newBounds: { x: number; y: number; width: number; height: number }) => void;
  onTableTransformEnd?: (element: TableElement, finalBounds: { x: number; y: number; width: number; height: number }) => void;
}

/**
 * Specialized TransformerController for table elements that:
 * - Supports aspect ratio locking with Shift key
 * - Prevents cell malformation during resize
 * - Maintains minimum table dimensions
 * - Provides proper table-specific bounds calculation
 */
export class TableTransformerController extends TransformerController {
  private element: TableElement;
  private onTableTransform?: (element: TableElement, newBounds: any) => void;
  private onTableTransformEnd?: (element: TableElement, finalBounds: any) => void;
  private isTransforming = false;
  private startElement?: TableElement;

  constructor(options: TableTransformerControllerOptions) {
    const {
      element,
      onTableTransform,
      onTableTransformEnd,
      ...baseOptions
    } = options;

    // Create table-specific transformer configuration
    const tableOptions: TransformerControllerOptions = {
      ...baseOptions,
      // Disable rotation for tables
      rotateEnabled: false,
      // Don't keep ratio by default (user can hold Shift)
      keepRatio: false,
      // Table-specific styling
      borderStroke: '#4F46E5',
      borderStrokeWidth: 2,
      anchorFill: '#4F46E5',
      anchorStroke: '#FFFFFF',
      anchorStrokeWidth: 2,
      anchorSize: 8,
      anchorCornerRadius: 2,
      // Custom bound box function for tables
      boundBoxFunc: (oldBox, newBox) => this.handleTableBounds(oldBox, newBox),
      // Enhanced transform handlers
      onTransformStart: (nodes) => this.handleTransformStart(nodes),
      onTransform: (nodes) => this.handleTransform(nodes),
      onTransformEnd: (nodes) => this.handleTransformEnd(nodes),
    };

    super(tableOptions);
    
    this.element = element;
    this.onTableTransform = onTableTransform;
    this.onTableTransformEnd = onTableTransformEnd;
  }

  /**
   * Update the table element reference (call when table data changes)
   */
  updateElement(element: TableElement) {
    this.element = element;
  }

  /**
   * Custom bounds handler for table elements
   */
  private handleTableBounds(oldBox: Konva.NodeConfig, newBox: Konva.NodeConfig): Konva.NodeConfig {
    // Get current keyboard state for aspect ratio locking
    const event = window.event as KeyboardEvent | undefined;
    const shiftKey = event?.shiftKey ?? false;
    const altKey = event?.altKey ?? false;
    const ctrlKey = event?.ctrlKey ?? false;

    // Calculate minimum dimensions based on table structure
    const minTableWidth = this.element.colWidths.length * DEFAULT_TABLE_CONFIG.minCellWidth;
    const minTableHeight = this.element.rowHeights.length * DEFAULT_TABLE_CONFIG.minCellHeight;
    
    // Constrain to minimum dimensions
    let constrainedWidth = Math.max(minTableWidth, newBox.width || 0);
    let constrainedHeight = Math.max(minTableHeight, newBox.height || 0);
    
    // Handle aspect ratio locking when Shift is held
    if (shiftKey) {
      const originalAspect = this.element.width / this.element.height;
      
      // Determine which dimension changed more to decide lock direction
      const widthChange = Math.abs((newBox.width || 0) - this.element.width);
      const heightChange = Math.abs((newBox.height || 0) - this.element.height);
      
      if (widthChange > heightChange) {
        // Width changed more, lock height to width
        constrainedHeight = Math.max(minTableHeight, constrainedWidth / originalAspect);
      } else {
        // Height changed more, lock width to height
        constrainedWidth = Math.max(minTableWidth, constrainedHeight * originalAspect);
      }
    }
    
    // Return the constrained bounds
    return {
      x: newBox.x || 0,
      y: newBox.y || 0,
      width: constrainedWidth,
      height: constrainedHeight,
      rotation: newBox.rotation || 0,
    };
  }

  /**
   * Handle transform start - store initial state
   */
  private handleTransformStart(nodes: Konva.Node[]) {
    this.isTransforming = true;
    this.startElement = { ...this.element };
    
    // Call original handler if provided
    if (this.onTableTransform) {
      const node = nodes[0];
      if (node) {
        this.onTableTransform(this.element, {
          x: node.x(),
          y: node.y(),
          width: node.width(),
          height: node.height(),
        });
      }
    }
  }

  /**
   * Handle ongoing transform - update table proportionally
   */
  private handleTransform(nodes: Konva.Node[]) {
    if (!this.isTransforming || !this.startElement || nodes.length === 0) return;
    
    const node = nodes[0];
    const currentBounds = {
      x: node.x(),
      y: node.y(),
      width: node.width(),
      height: node.height(),
    };
    
    // Notify about ongoing transform
    if (this.onTableTransform) {
      this.onTableTransform(this.element, currentBounds);
    }
  }

  /**
   * Handle transform end - finalize table resize
   */
  private handleTransformEnd(nodes: Konva.Node[]) {
    if (!this.isTransforming || !this.startElement || nodes.length === 0) {
      this.isTransforming = false;
      this.startElement = undefined;
      return;
    }
    
    const node = nodes[0];
    const finalBounds = {
      x: node.x(),
      y: node.y(),
      width: node.width(),
      height: node.height(),
    };
    
    // Notify about final transform
    if (this.onTableTransformEnd) {
      this.onTableTransformEnd(this.element, finalBounds);
    }
    
    // Clean up
    this.isTransforming = false;
    this.startElement = undefined;
  }

  /**
   * Check if the transformer is currently transforming
   */
  isCurrentlyTransforming(): boolean {
    return this.isTransforming;
  }

  /**
   * Get the starting element state (available during transform)
   */
  getStartElement(): TableElement | undefined {
    return this.startElement;
  }

  /**
   * Enable/disable aspect ratio locking programmatically
   */
  setKeepRatio(keepRatio: boolean) {
    this.updateStyle({ keepRatio });
  }

  /**
   * Update table-specific styling
   */
  updateTableStyle(options: {
    borderColor?: string;
    anchorColor?: string;
    anchorSize?: number;
  }) {
    const styleUpdate: Partial<TransformerControllerOptions> = {};
    
    if (options.borderColor) {
      styleUpdate.borderStroke = options.borderColor;
    }
    if (options.anchorColor) {
      styleUpdate.anchorFill = options.anchorColor;
    }
    if (options.anchorSize) {
      styleUpdate.anchorSize = options.anchorSize;
    }
    
    this.updateStyle(styleUpdate);
  }
}

/**
 * Factory function to create a table transformer controller
 */
export function createTableTransformerController(
  element: TableElement,
  stage: Konva.Stage,
  layer: Konva.Layer,
  options: {
    onTableTransform?: (element: TableElement, newBounds: any) => void;
    onTableTransformEnd?: (element: TableElement, finalBounds: any) => void;
  } = {}
): TableTransformerController {
  return new TableTransformerController({
    element,
    stage,
    layer,
    onTableTransform: options.onTableTransform,
    onTableTransformEnd: options.onTableTransformEnd,
  });
}

/**
 * Utility to apply proportional table resize based on transform bounds
 */
export function applyTableTransformResize(
  element: TableElement,
  newBounds: { width: number; height: number },
  options: { preserveAspectRatio?: boolean } = {}
): { colWidths: number[]; rowHeights: number[]; width: number; height: number } {
  const { width: newWidth, height: newHeight } = newBounds;
  const { preserveAspectRatio = false } = options;
  
  let targetWidth = newWidth;
  let targetHeight = newHeight;
  
  // Handle aspect ratio preservation
  if (preserveAspectRatio) {
    const originalAspect = element.width / element.height;
    const newAspect = newWidth / newHeight;
    
    if (newAspect > originalAspect) {
      // New bounds are wider than original aspect ratio
      targetWidth = newHeight * originalAspect;
    } else {
      // New bounds are taller than original aspect ratio
      targetHeight = newWidth / originalAspect;
    }
  }
  
  // Calculate scale factors
  const wScale = targetWidth / element.width;
  const hScale = targetHeight / element.height;
  
  // Apply scaling to column widths and row heights
  const colWidths = element.colWidths.map(w => {
    const scaledWidth = Math.round(w * wScale);
    return Math.max(DEFAULT_TABLE_CONFIG.minCellWidth, scaledWidth);
  });
  
  const rowHeights = element.rowHeights.map(h => {
    const scaledHeight = Math.round(h * hScale);
    return Math.max(DEFAULT_TABLE_CONFIG.minCellHeight, scaledHeight);
  });
  
  // Calculate actual dimensions after constraint application
  const actualWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const actualHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  
  return {
    colWidths,
    rowHeights,
    width: actualWidth,
    height: actualHeight,
  };
}