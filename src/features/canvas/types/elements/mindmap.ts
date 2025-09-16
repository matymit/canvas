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
  fill: "#FFFFFF",
  stroke: "#9CA3AF",
  strokeWidth: 1.5,
  cornerRadius: 14,
  fontFamily: "Inter",
  fontSize: 20,
  fontStyle: "bold",
  textColor: "#111827",
  paddingX: 14,
  paddingY: 10,
};

export const DEFAULT_BRANCH_STYLE: BranchStyle = {
  color: "#4B5563",
  widthStart: 12,
  widthEnd: 3,
  curvature: 0.4,
};

// Configuration constants
export const MINDMAP_CONFIG = {
  defaultNodeWidth: 220,
  defaultNodeHeight: 44,
  minNodeWidth: 80,
  minNodeHeight: 28,
  childOffsetX: 240,
  childOffsetY: 60,
  defaultText: "Topic",
  childText: "Idea",
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
  const dx = Math.max(MINDMAP_CONFIG.childOffsetX, parent.width + 160);
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