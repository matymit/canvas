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
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
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
  level?: number;
  color?: string;
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
  fill: "#E5E7EB",
  stroke: "#9CA3AF",
  strokeWidth: 1,
  cornerRadius: 14,
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: 16,
  fontStyle: "bold",
  textColor: "#111827",
  paddingX: 14,
  paddingY: 10,
  shadowColor: "rgba(17, 24, 39, 0.08)",
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
};

export const DEFAULT_BRANCH_STYLE: BranchStyle = {
  color: "#6B7280",
  widthStart: 5,
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

export const MINDMAP_THEME = {
  nodeColors: ["#E5E7EB", "#DBEAFE", "#DCFCE7", "#FEF3C7", "#FDE2E7"],
  branchColors: ["#6B7280", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
  textColor: "#111827",
  nodeRadius: 14,
} as const;

export interface MindmapNodeOptions {
  parentId?: ElementId | null;
  level?: number;
  color?: string;
  style?: Partial<MindmapNodeStyle>;
}

// Helper functions for mindmap operations
export function createMindmapNode(
  x: number,
  y: number,
  text: string = MINDMAP_CONFIG.defaultText,
  options: MindmapNodeOptions = {}
): Omit<MindmapNodeElement, "id"> {
  const {
    parentId = null,
    level = parentId ? 1 : 0,
    color,
    style: styleOverrides,
  } = options;

  const themeColor = color ?? MINDMAP_THEME.nodeColors[level % MINDMAP_THEME.nodeColors.length];
  const style: MindmapNodeStyle = {
    ...DEFAULT_NODE_STYLE,
    ...styleOverrides,
    fill: styleOverrides?.fill ?? themeColor,
    textColor: styleOverrides?.textColor ?? DEFAULT_NODE_STYLE.textColor,
    fontStyle: styleOverrides?.fontStyle ?? (level === 0 ? "bold" : "normal"),
    fontSize: styleOverrides?.fontSize ?? (level === 0 ? 16 : 14),
    stroke:
      styleOverrides?.stroke ?? (level === 0 ? "#374151" : DEFAULT_NODE_STYLE.stroke),
    strokeWidth: styleOverrides?.strokeWidth ?? (level === 0 ? 2 : DEFAULT_NODE_STYLE.strokeWidth),
    cornerRadius: styleOverrides?.cornerRadius ?? MINDMAP_THEME.nodeRadius,
  };

  return {
    type: "mindmap-node",
    x,
    y,
    width: MINDMAP_CONFIG.defaultNodeWidth,
    height: MINDMAP_CONFIG.defaultNodeHeight,
    text,
    style,
    parentId,
    level,
    color: themeColor,
  };
}

export function createMindmapEdge(
  fromId: ElementId,
  toId: ElementId,
  style?: Partial<BranchStyle>
): Omit<MindmapEdgeElement, "id"> {
  const baseColor = style?.color ?? MINDMAP_THEME.branchColors[0];
  return {
    type: "mindmap-edge",
    fromId,
    toId,
    style: { ...DEFAULT_BRANCH_STYLE, ...style, color: baseColor },
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

/**
 * Measure text dimensions with word wrapping support.
 * Calculates how text will wrap within a maximum width constraint.
 */
export function measureMindmapLabelWithWrap(
  text: string,
  style: MindmapNodeStyle,
  maxWidth: number,
  lineHeight: number = MINDMAP_CONFIG.lineHeight
): { width: number; height: number; wrappedLines: string[] } {
  const ctx = getMeasureContext();
  const fontWeight = style.fontStyle?.includes("bold") ? "700" : "400";
  const fontStyle = style.fontStyle?.includes("italic") ? "italic" : "normal";
  ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;

  // Handle empty text
  if (!text || text.trim() === "") {
    return {
      width: 0,
      height: style.fontSize,
      wrappedLines: [""]
    };
  }

  const wrappedLines: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  let actualMaxWidth = 0;

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      wrappedLines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine !== "") {
        // Current line is too long, save it and start a new line
        const lineMetrics = ctx.measureText(currentLine);
        actualMaxWidth = Math.max(actualMaxWidth, lineMetrics.width);
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    // Add the last line of the paragraph
    if (currentLine) {
      const lineMetrics = ctx.measureText(currentLine);
      actualMaxWidth = Math.max(actualMaxWidth, lineMetrics.width);
      wrappedLines.push(currentLine);
    }
  }

  const textHeight = Math.max(
    style.fontSize,
    wrappedLines.length * style.fontSize * lineHeight
  );

  return {
    width: Math.ceil(actualMaxWidth),
    height: Math.ceil(textHeight),
    wrappedLines
  };
}
