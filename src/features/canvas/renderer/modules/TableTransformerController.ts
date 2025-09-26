// CORRECTED TableTransformerController that properly handles Konva's scale system
// Implements the correct scale→reset→resize pattern for complex table elements

import type Konva from "konva";
import type {
  TransformerControllerOptions} from "../TransformerController";
import {
  TransformerController
} from "../TransformerController";
import type { TableElement } from "../../types/table";
import {
  handleTableTransformEnd,
  handleTableTransformLive,
  createTableBoundBoxFunc,
} from "./tableTransform";

export interface TableTransformerControllerOptions
  extends Omit<
    TransformerControllerOptions,
    "boundBoxFunc" | "onTransform" | "onTransformEnd"
  > {
  element: TableElement;
  keepAspectRatio?: boolean;
  onTableUpdate?: (
    element: TableElement,
    resetAttrs?: {
      scaleX: number;
      scaleY: number;
      width: number;
      height: number;
      x: number;
      y: number;
    },
  ) => void;
}

/**
 * CORRECTED TableTransformerController that properly handles Konva's scale-based transforms
 * Key principles:
 * 1. During transform: let Konva scale the visual representation
 * 2. On transform end: reset scale to 1 and update actual table dimensions
 * 3. Update store with new table structure
 * 4. NEVER return oldBox from boundBoxFunc - always return constrained newBox
 */
export class TableTransformerController extends TransformerController {
  private element: TableElement;
  private readonly onTableUpdate?: (
    element: TableElement,
    resetAttrs?: {
      scaleX: number;
      scaleY: number;
      width: number;
      height: number;
      x: number;
      y: number;
    },
  ) => void;
  private isTransforming = false;

  constructor(options: TableTransformerControllerOptions) {
    const { element, onTableUpdate, keepAspectRatio, ...baseOptions } = options;

    // Create table-specific transformer configuration
    const tableOptions: TransformerControllerOptions = {
      ...baseOptions,
      // Table-specific settings
      rotateEnabled: false, // Tables shouldn't rotate
      keepRatio: keepAspectRatio || false, // Use provided keepAspectRatio or default to false

      // CRITICAL: Enable ALL horizontal and vertical anchors to prevent locking
      enabledAnchors: [
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],

      // Table-specific styling
      borderStroke: "#4F46E5",
      borderStrokeWidth: 2,
      anchorFill: "#4F46E5",
      anchorStroke: "#FFFFFF",
      anchorSize: 8,
      anchorCornerRadius: 2,

      // CRITICAL: Custom bound box function that NEVER returns oldBox
      // This is the key fix for horizontal locking
      boundBoxFunc: createTableBoundBoxFunc(element),

      // Transform handlers that implement correct scale handling
      onTransformStart: (nodes) => this.handleTransformStart(nodes),
      onTransform: (nodes) => this.handleTransform(nodes),
      onTransformEnd: (nodes) => this.handleTransformEnd(nodes),
    };

    super(tableOptions);

    this.element = element;
    this.onTableUpdate = onTableUpdate;
  }

  /**
   * Update the table element reference (call when table data changes externally)
   */
  updateElement(element: TableElement) {
    this.element = element;

    // Update the bound box function with the new element
    const transformer = this.getNode();
    transformer.boundBoxFunc(createTableBoundBoxFunc(element));
  }

  /**
   * Handle transform start - just mark that we're transforming
   */
  private handleTransformStart(_nodes: Konva.Node[]) {
    this.isTransforming = true;
  }

  /**
   * Handle ongoing transform - apply live aspect ratio enforcement if needed
   * CRITICAL: Don't modify children during transform - let Konva handle the scaling
   */
  private handleTransform(nodes: Konva.Node[]) {
    if (!this.isTransforming || nodes.length === 0) return;

    const node = nodes[0];

    // Apply live transform logic (aspect ratio enforcement only)
    const event = window.event as KeyboardEvent | undefined;
    const shiftKey = event?.shiftKey ?? false;

    // CRITICAL: Only apply aspect ratio during live transform
    // Do NOT update children or internal arrays here
    handleTableTransformLive(this.element, node, { shiftKey });
  }

  /**
   * CRITICAL: Handle transform end - this is where the magic happens
   * We reset the scale and update the actual table dimensions
   */
  private handleTransformEnd(nodes: Konva.Node[]) {
    if (!this.isTransforming || nodes.length === 0) {
      this.isTransforming = false;
      return;
    }

    const node = nodes[0];

    // Get keyboard state
    const event = window.event as KeyboardEvent | undefined;
    const shiftKey = event?.shiftKey ?? false;
    const altKey = event?.altKey ?? false;
    const ctrlKey = event?.ctrlKey ?? false;

    // Apply the correct transform end logic
    const { element: newElement, resetAttrs } = handleTableTransformEnd(
      this.element,
      node,
      { shiftKey, altKey, ctrlKey },
    );

    // CRITICAL: Apply the reset attributes to the node FIRST
    // This resets scale to 1 and updates width/height
    node.setAttrs(resetAttrs);

    // Update our internal element reference
    this.element = newElement;

    // Notify the parent about the update (this triggers store update and re-render)
    if (this.onTableUpdate) {
      this.onTableUpdate(newElement, resetAttrs);
    }

    // Update the transformer's bound box function with the new element
    const transformer = this.getNode();
    transformer.boundBoxFunc(createTableBoundBoxFunc(newElement));

    // Force update the transformer
    this.forceUpdate();

    this.isTransforming = false;
  }

  /**
   * Check if currently transforming
   */
  isCurrentlyTransforming(): boolean {
    return this.isTransforming;
  }

  /**
   * Get the current element
   */
  getCurrentElement(): TableElement {
    return this.element;
  }

  /**
   * Override attach to ensure proper setup
   */
  attach(nodes: Konva.Node[]) {
    super.attach(nodes);

    // CRITICAL: Ensure all attached nodes have scale = 1 initially
    // This prevents cumulative scaling issues
    nodes.forEach((node) => {
      if (node.scaleX() !== 1 || node.scaleY() !== 1) {
        // Calculate current actual size
        const actualWidth = node.width() * node.scaleX();
        const actualHeight = node.height() * node.scaleY();

        // Reset scale and set actual dimensions
        node.setAttrs({
          scaleX: 1,
          scaleY: 1,
          width: actualWidth,
          height: actualHeight,
        });
      }
    });
  }

  /**
   * Override to ensure proper table-specific settings
   */
  updateStyle(options: Partial<TransformerControllerOptions>) {
    // Always ensure critical table settings are maintained
    const tableSpecificOptions = {
      ...options,
      rotateEnabled: false, // Tables should never rotate
      enabledAnchors: [
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ], // Always ensure all anchors are enabled
    };

    super.updateStyle(tableSpecificOptions);

    // Update bound box function if element changed
    const transformer = this.getNode();
    transformer.boundBoxFunc(createTableBoundBoxFunc(this.element));
  }

  /**
   * Cleanup method
   */
  destroy() {
    // Remove event handlers from any attached nodes
    const transformer = this.getNode();
    const nodes = transformer.nodes();
    nodes.forEach((node) => {
      node.off("transformend.tableTransform");
    });

    super.destroy();
  }
}

/**
 * Factory function to create a table transformer controller with proper setup
 */
export function createTableTransformerController(
  element: TableElement,
  stage: Konva.Stage,
  layer: Konva.Layer,
  options: {
    onTableUpdate?: (
      element: TableElement,
      resetAttrs?: {
        scaleX: number;
        scaleY: number;
        width: number;
        height: number;
        x: number;
        y: number;
      },
    ) => void;
  } = {},
): TableTransformerController {
  return new TableTransformerController({
    element,
    stage,
    layer,
    onTableUpdate: options.onTableUpdate,
  });
}

/**
 * Utility to check if a node needs scale reset
 */
export function nodeNeedsScaleReset(node: Konva.Node): boolean {
  return (
    Math.abs(node.scaleX() - 1) > 0.001 || Math.abs(node.scaleY() - 1) > 0.001
  );
}

/**
 * Utility to reset node scale and update dimensions
 */
export function resetNodeScale(node: Konva.Node): void {
  if (!nodeNeedsScaleReset(node)) return;

  const newWidth = node.width() * node.scaleX();
  const newHeight = node.height() * node.scaleY();

  node.setAttrs({
    scaleX: 1,
    scaleY: 1,
    width: newWidth,
    height: newHeight,
  });
}
