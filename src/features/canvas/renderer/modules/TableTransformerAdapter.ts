// Table-specific transformer adapter that integrates with TransformerController
// Handles proper bounds calculation, aspect ratio locking, and prevents position jumping

import type Konva from "konva";
import type { TableElement } from "../../types/table";
import { handleTableTransform, validateTableIntegrity } from "./tableTransform";

export interface TableTransformerOptions {
  onTransformStart?: (element: TableElement) => void;
  onTransform?: (element: TableElement) => void;
  onTransformEnd?: (element: TableElement, finalElement: TableElement) => void;
}

/**
 * Creates a boundBoxFunc for table transformers that:
 * 1. Handles aspect ratio locking with Shift key
 * 2. Prevents cell malformation
 * 3. Maintains minimum table dimensions
 * 4. Preserves table position properly
 */
export function createTableBoundBoxFunc(
  element: TableElement,
  _options: TableTransformerOptions = {},
) {
  return (_oldBox: Konva.NodeConfig, newBox: Konva.NodeConfig) => {
    // Get current keyboard state
    const shiftKey = window.event
      ? (window.event as KeyboardEvent).shiftKey
      : false;

    // Minimum dimensions to prevent malformed tables
    const minWidth = element.colWidths.length * 40; // Minimum 40px per column
    const minHeight = element.rowHeights.length * 28; // Minimum 28px per row

    // Constrain to minimum dimensions
    let constrainedWidth = Math.max(minWidth, newBox.width || 0);
    let constrainedHeight = Math.max(minHeight, newBox.height || 0);

    // Handle aspect ratio locking when Shift is held
    if (shiftKey) {
      const originalAspect = element.width / element.height;

      // Determine which dimension changed more to decide lock direction
      const widthChange = Math.abs((newBox.width || 0) - element.width);
      const heightChange = Math.abs((newBox.height || 0) - element.height);

      if (widthChange > heightChange) {
        // Width changed more, lock height to width
        constrainedHeight = Math.max(
          minHeight,
          constrainedWidth / originalAspect,
        );
      } else {
        // Height changed more, lock width to height
        constrainedWidth = Math.max(
          minWidth,
          constrainedHeight * originalAspect,
        );
      }
    }

    // Return the constrained bounds
    const result = {
      x: newBox.x || 0,
      y: newBox.y || 0,
      width: constrainedWidth,
      height: constrainedHeight,
      rotation: newBox.rotation || 0,
    };

    return result;
  };
}

/**
 * Creates transformer event handlers for table elements
 */
export function createTableTransformerHandlers(
  element: TableElement,
  updateElement: (id: string, updates: Partial<TableElement>) => void,
  options: TableTransformerOptions = {},
) {
  let transformStartElement: TableElement | null = null;

  return {
    onTransformStart: (_nodes: Konva.Node[]) => {
      // Store the initial state
      transformStartElement = { ...element };
      options.onTransformStart?.(element);
    },

    onTransform: (nodes: Konva.Node[]) => {
      if (!transformStartElement || nodes.length === 0) return;

      const node = nodes[0];
      const currentBounds = {
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
      };

      // Get keyboard state for transform modifiers
      const shiftKey = window.event
        ? (window.event as KeyboardEvent).shiftKey
        : false;
      const altKey = window.event
        ? (window.event as KeyboardEvent).altKey
        : false;
      const ctrlKey = window.event
        ? (window.event as KeyboardEvent).ctrlKey
        : false;

      // Apply table-specific transform logic
      const transformedElement = handleTableTransform(
        transformStartElement,
        currentBounds,
        { shiftKey, altKey, ctrlKey },
      );

      // Validate integrity to prevent malformation
      const validatedElement = validateTableIntegrity(transformedElement);

      // Update the element in store during transform (for live preview)
      updateElement(element.id, {
        x: validatedElement.x,
        y: validatedElement.y,
        width: validatedElement.width,
        height: validatedElement.height,
        colWidths: validatedElement.colWidths,
        rowHeights: validatedElement.rowHeights,
      });

      options.onTransform?.(validatedElement);
    },

    onTransformEnd: (nodes: Konva.Node[]) => {
      if (!transformStartElement || nodes.length === 0) return;

      const node = nodes[0];
      const finalBounds = {
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
      };

      // Get keyboard state for final transform
      const shiftKey = window.event
        ? (window.event as KeyboardEvent).shiftKey
        : false;
      const altKey = window.event
        ? (window.event as KeyboardEvent).altKey
        : false;
      const ctrlKey = window.event
        ? (window.event as KeyboardEvent).ctrlKey
        : false;

      // Apply final table transform
      const finalElement = handleTableTransform(
        transformStartElement,
        finalBounds,
        { shiftKey, altKey, ctrlKey },
      );

      // Validate final state
      const validatedFinalElement = validateTableIntegrity(finalElement);

      // Final update to store with full element data
      updateElement(element.id, validatedFinalElement);

      options.onTransformEnd?.(element, validatedFinalElement);

      // Clean up
      transformStartElement = null;
    },
  };
}

/**
 * Configuration for table-specific transformer settings
 */
export function getTableTransformerConfig(
  element: TableElement,
): Partial<Konva.TransformerConfig> {
  return {
    // Enable all resize anchors for full table control
    enabledAnchors: [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "middle-left",
      "middle-right",
      "top-center",
      "bottom-center",
    ],

    // Disable rotation for tables (tables shouldn't rotate)
    rotateEnabled: false,

    // Don't keep ratio by default (user can hold Shift)
    keepRatio: false,

    // Table-specific styling
    borderStroke: "#4F46E5",
    borderStrokeWidth: 2,
    anchorFill: "#4F46E5",
    anchorStroke: "#FFFFFF",
    anchorStrokeWidth: 2,
    anchorSize: 8,
    anchorCornerRadius: 2,

    // Custom bound box function
    boundBoxFunc: createTableBoundBoxFunc(element),
  };
}

/**
 * Utility to check if a transformer is currently transforming a table
 */
export function isTransformingTable(transformer: Konva.Transformer): boolean {
  const nodes = transformer.nodes();
  return nodes.some((node) => {
    const elementType = node.getAttr("elementType");
    return elementType === "table";
  });
}

/**
 * Get table element from transformer node
 */
export function getTableElementFromNode(node: Konva.Node): string | null {
  const elementId = node.getAttr("elementId");
  const elementType = node.getAttr("elementType");
  return elementType === "table" && elementId ? elementId : null;
}
