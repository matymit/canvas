// Mindmap element types for FigJam-style node and branch functionality
// Provides serializable data model for nodes with curved, tapered branches

export type ElementId = string;

export interface MindmapNodeStyle {
  fill: string;         // e.g., "#FFFFFF"
  stroke: string;       // e.g., "#9CA3AF"  
  strokeWidth: number;  // e.g., 1
  cornerRadius: number; // e.g., 14
  fontFamily: string;   // e.g., "Inter"
  fontSize: number;     // e.g., 20
  fontStyle?: string;   // e.g., "bold" | "normal"
  textColor: string;    // e.g., "#111827"
  paddingX: number;     // e.g., 14
  paddingY: number;     // e.g., 10
}

export interface MindmapNodeElement {
  id: ElementId;
  type: "mindmap-node";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style: MindmapNodeStyle;
  parentId?: ElementId | null; // optional for quick traversal (not required)
  textWidth?: number;
  textHeight?: number;
}

export interface BranchStyle {
  color: string;        // stroke/fill color
  widthStart: number;   // base/taper start width (px)
  widthEnd: number;     // taper end width (px), often smaller than start
  curvature: number;    // 0..1 curvature factor
}

export interface MindmapEdgeElement {
  id: ElementId;
  type: "mindmap-edge";
  fromId: ElementId;    // parent node id
  toId: ElementId;      // child node id
  style: BranchStyle;
}

// Default styles for consistent mindmap appearance
export const DEFAULT_NODE_STYLE: MindmapNodeStyle = {
  fill: "transparent",
  stroke: "transparent",
  strokeWidth: 0,
  cornerRadius: 4,
  fontFamily: "Inter",
  fontSize: 20,
  fontStyle: "bold",
  textColor: "#111827",
  paddingX: 8,
  paddingY: 4,
};

export const DEFAULT_BRANCH_STYLE: BranchStyle = {
  color: "#4B5563",
  widthStart: 8,
  widthEnd: 2,
  curvature: 0.35,
};

// Configuration constants
export const MINDMAP_CONFIG = {
  defaultNodeWidth: 160,
  defaultNodeHeight: 36,
  minNodeWidth: 56,
  minNodeHeight: 28,
  childOffsetX: 180,
  childOffsetY: 56,
  defaultText: "Topic",
  childText: "Idea",
  lineHeight: 1.25,
} as const;

// Helper functions for mindmap operations
export function createMindmapNode(
  x: number, 
  y: number, 
  text: string = MINDMAP_CONFIG.defaultText,
  parentId?: ElementId | null
): Omit<MindmapNodeElement, "id"> {
  return {
    type: "mindmap-node",
    x,
    y,
    width: MINDMAP_CONFIG.defaultNodeWidth,
    height: MINDMAP_CONFIG.defaultNodeHeight,
    text,
    style: { ...DEFAULT_NODE_STYLE },
    parentId,
  };
}

export function createMindmapEdge(
  fromId: ElementId,
  toId: ElementId,
  style?: Partial<BranchStyle>
): Omit<MindmapEdgeElement, "id"> {
  return {
    type: "mindmap-edge",
    fromId,
    toId,
    style: { ...DEFAULT_BRANCH_STYLE, ...style },
  };
}

export function calculateChildPosition(
  parent: MindmapNodeElement,
  index: number = 0
): { x: number; y: number } {
  // Position children to the right with vertical offset
  const dx = Math.max(MINDMAP_CONFIG.childOffsetX, parent.width + 140);
  const dy = index * MINDMAP_CONFIG.childOffsetY;
  
  return {
    x: parent.x + dx,
    y: parent.y + dy,
  };
}

export function getNodeCenter(node: MindmapNodeElement): { x: number; y: number } {
  return {
    x: node.x + node.width * 0.5,
    y: node.y + node.height * 0.5,
  };
}

export function getNodeConnectionPoint(
  node: MindmapNodeElement,
  side: 'left' | 'right' | 'top' | 'bottom' = 'right'
): { x: number; y: number } {
  const center = getNodeCenter(node);
  
  switch (side) {
    case 'left':
      return { x: node.x, y: center.y };
    case 'right':
      return { x: node.x + node.width, y: center.y };
    case 'top':
      return { x: center.x, y: node.y };
    case 'bottom':
      return { x: center.x, y: node.y + node.height };
    default:
      return center;
  }
}

export function resizeMindmapNode(
  node: MindmapNodeElement,
  newWidth: number,
  newHeight: number
): MindmapNodeElement {
  return {
    ...node,
    width: Math.max(MINDMAP_CONFIG.minNodeWidth, newWidth),
    height: Math.max(MINDMAP_CONFIG.minNodeHeight, newHeight),
  };
}

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D context for mindmap measurement");
  }
  return ctx;
}

/**
 * Measure rendered text dimensions for mindmap nodes using Canvas 2D API.
 */
export function measureMindmapLabel(
  text: string,
  style: MindmapNodeStyle,
  lineHeight: number = MINDMAP_CONFIG.lineHeight
): { width: number; height: number } {
  const ctx = getMeasureContext();
  const fontWeight = style.fontStyle?.includes("bold") ? "700" : "400";
  const fontStyle = style.fontStyle?.includes("italic") ? "italic" : "normal";
  ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;

  const lines = text ? text.split(/\r?\n/) : [""];
  let maxWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
  }
  const textHeight = Math.max(
    style.fontSize,
    lines.length * style.fontSize * lineHeight
  );

  return {
    width: Math.ceil(maxWidth),
    height: Math.ceil(textHeight),
  };
}
