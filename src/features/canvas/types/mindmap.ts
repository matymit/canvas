// Mindmap element types for FigJam-style node and branch functionality
// Provides serializable data model for nodes with curved, tapered branches

import type { CanvasElement } from "../../../../types";

const ROOT_FONT_SIZE = 18;
const CHILD_FONT_SIZE = 15;
const BASE_TEXT_COLOR = "#0F172A";
const DEFAULT_PADDING_X = 18;
const DEFAULT_PADDING_Y = 14;
const DEFAULT_CORNER_RADIUS = 18;
const DEFAULT_SHADOW_COLOR = "rgba(15, 23, 42, 0.14)";
const DEFAULT_SHADOW_BLUR = 24;
const DEFAULT_SHADOW_OFFSET_X = 0;
const DEFAULT_SHADOW_OFFSET_Y = 8;

export type ElementId = string;

export interface MindmapNodeStyle {
  fill: string; // e.g., "#FFFFFF"
  stroke: string; // e.g., "#9CA3AF"
  strokeWidth: number; // e.g., 1
  cornerRadius: number; // e.g., 14
  fontFamily: string; // e.g., "Inter"
  fontSize: number; // e.g., 20
  fontStyle?: string; // e.g., "bold" | "normal"
  textColor: string; // e.g., "#111827"
  paddingX: number; // e.g., 14
  paddingY: number; // e.g., 10
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
  color: string; // stroke/fill color
  widthStart: number; // base/taper start width (px)
  widthEnd: number; // taper end width (px), often smaller than start
  curvature: number; // 0..1 curvature factor
}

export type MindmapEdgeElement = CanvasElement & {
  type: "mindmap-edge";
  fromId: ElementId; // parent node id
  toId: ElementId; // child node id
  style: BranchStyle;
};

// Default styles for consistent mindmap appearance
export const DEFAULT_NODE_STYLE: MindmapNodeStyle = {
  fill: "#EEF2FF",
  stroke: "#4F46E5",
  strokeWidth: 1.5,
  cornerRadius: DEFAULT_CORNER_RADIUS,
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: ROOT_FONT_SIZE,
  fontStyle: "bold",
  textColor: BASE_TEXT_COLOR,
  paddingX: DEFAULT_PADDING_X,
  paddingY: DEFAULT_PADDING_Y,
  shadowColor: DEFAULT_SHADOW_COLOR,
  shadowBlur: DEFAULT_SHADOW_BLUR,
  shadowOffsetX: DEFAULT_SHADOW_OFFSET_X,
  shadowOffsetY: DEFAULT_SHADOW_OFFSET_Y,
};

export const DEFAULT_BRANCH_STYLE: BranchStyle = {
  color: "#4338CA",
  widthStart: 6,
  widthEnd: 2.4,
  curvature: 0.42,
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
  lineHeight: 1.35,
} as const;

export const MINDMAP_THEME = {
  nodeColors: ["#EEF2FF", "#E0F2FE", "#ECFDF5", "#FEF3C7", "#FCE7F3"],
  nodeBorderColors: ["#4F46E5", "#0284C7", "#059669", "#D97706", "#DB2777"],
  branchColors: ["#4338CA", "#0369A1", "#047857", "#B45309", "#BE185D"],
  textColor: BASE_TEXT_COLOR,
  nodeRadius: DEFAULT_CORNER_RADIUS,
  shadow: {
    color: DEFAULT_SHADOW_COLOR,
    blur: DEFAULT_SHADOW_BLUR,
    offsetX: DEFAULT_SHADOW_OFFSET_X,
    offsetY: DEFAULT_SHADOW_OFFSET_Y,
  },
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
  options: MindmapNodeOptions = {},
): Omit<MindmapNodeElement, "id"> {
  const {
    parentId = null,
    level = parentId ? 1 : 0,
    color,
    style: styleOverrides,
  } = options;

  const themeColor =
    color ?? MINDMAP_THEME.nodeColors[level % MINDMAP_THEME.nodeColors.length];
  const paletteIndex = level % MINDMAP_THEME.nodeColors.length;
  const borderPalette = MINDMAP_THEME.nodeBorderColors ?? [];
  const themeBorder = borderPalette[paletteIndex] ?? DEFAULT_NODE_STYLE.stroke;

  const style: MindmapNodeStyle = {
    ...DEFAULT_NODE_STYLE,
    ...styleOverrides,
    fill: styleOverrides?.fill ?? themeColor,
    textColor: styleOverrides?.textColor ?? MINDMAP_THEME.textColor,
    fontStyle: styleOverrides?.fontStyle ?? (level === 0 ? "bold" : "normal"),
    fontSize:
      styleOverrides?.fontSize ?? (level === 0 ? ROOT_FONT_SIZE : CHILD_FONT_SIZE),
    stroke: styleOverrides?.stroke ?? themeBorder,
    strokeWidth:
      styleOverrides?.strokeWidth ?? (level === 0 ? 2 : 1.5),
    cornerRadius: styleOverrides?.cornerRadius ?? MINDMAP_THEME.nodeRadius,
    shadowColor: styleOverrides?.shadowColor ?? MINDMAP_THEME.shadow.color,
    shadowBlur: styleOverrides?.shadowBlur ?? MINDMAP_THEME.shadow.blur,
    shadowOffsetX:
      styleOverrides?.shadowOffsetX ?? MINDMAP_THEME.shadow.offsetX,
    shadowOffsetY:
      styleOverrides?.shadowOffsetY ?? MINDMAP_THEME.shadow.offsetY,
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
  style?: Partial<BranchStyle>,
): Omit<MindmapEdgeElement, "id"> {
  const baseColor = style?.color ?? MINDMAP_THEME.branchColors[0];
  const branchStyle = { ...DEFAULT_BRANCH_STYLE, ...style, color: baseColor };
  return {
    type: "mindmap-edge",
    x: 0, // Edges are positioned relative to connected nodes
    y: 0, // Edges are positioned relative to connected nodes
    fromId,
    toId,
    style: branchStyle,
  };
}

export function calculateChildPosition(
  parent: MindmapNodeElement,
  index: number = 0,
): { x: number; y: number } {
  // Position children to the right with vertical offset
  const dx = Math.max(MINDMAP_CONFIG.childOffsetX, parent.width + 140);
  const dy = index * MINDMAP_CONFIG.childOffsetY;

  return {
    x: parent.x + dx,
    y: parent.y + dy,
  };
}

export function getNodeCenter(node: MindmapNodeElement): {
  x: number;
  y: number;
} {
  return {
    x: node.x + node.width * 0.5,
    y: node.y + node.height * 0.5,
  };
}

export function getNodeConnectionPoint(
  node: MindmapNodeElement,
  side: "left" | "right" | "top" | "bottom" = "right",
): { x: number; y: number } {
  const center = getNodeCenter(node);

  switch (side) {
    case "left":
      return { x: node.x, y: center.y };
    case "right":
      return { x: node.x + node.width, y: center.y };
    case "top":
      return { x: center.x, y: node.y };
    case "bottom":
      return { x: center.x, y: node.y + node.height };
    default:
      return center;
  }
}

export function resizeMindmapNode(
  node: MindmapNodeElement,
  newWidth: number,
  newHeight: number,
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
  lineHeight: number = MINDMAP_CONFIG.lineHeight,
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
    lines.length * style.fontSize * lineHeight,
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
  lineHeight: number = MINDMAP_CONFIG.lineHeight,
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
      wrappedLines: [""],
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
    wrappedLines.length * style.fontSize * lineHeight,
  );

  return {
    width: Math.ceil(actualMaxWidth),
    height: Math.ceil(textHeight),
    wrappedLines,
  };
}
