// MindmapNodeRenderer - Node rendering and lifecycle
// Extracted from MindmapRenderer.ts as part of modularization

import Konva from "konva";
import type { RendererLayers } from "../../layers";
import type { CanvasElement } from "../../../../../../types";
import { getTextConfig } from "../../../constants/TextConstants";
import {
  type MindmapNodeElement,
  type MindmapNodeStyle,
  DEFAULT_NODE_STYLE,
  MINDMAP_THEME,
  MINDMAP_CONFIG,
  measureMindmapLabelWithWrap,
} from "@/features/canvas/types/mindmap";
import type { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";

// Store state interfaces
interface StoreState {
  elements?: Map<string, CanvasElement> | Record<string, CanvasElement>;
  element?: {
    all?: Map<string, CanvasElement> | Record<string, CanvasElement>;
    getById?: (id: string) => CanvasElement | undefined;
  };
  getElement?: (id: string) => CanvasElement | undefined;
  ui?: {
    selectedTool?: string;
  };
}

// Mindmap element interfaces
interface MindmapNodeData extends Record<string, unknown> {
  text?: string;
  parentId?: string | null;
  level?: number;
  color?: string;
  textWidth?: number;
  textHeight?: number;
  style?: MindmapNodeStyle;
}

interface MindmapCanvasElement extends CanvasElement {
  data?: MindmapNodeData;
  text?: string;
  parentId?: string | null;
  level?: number;
  color?: string;
  textWidth?: number;
  textHeight?: number;
  style?: MindmapNodeStyle | Record<string, unknown>;
}

export interface MindmapNodeRendererOptions {
  cacheNodes?: boolean;
}

export class MindmapNodeRenderer {
  private readonly layers: RendererLayers;
  private readonly store: typeof useUnifiedCanvasStore;
  private readonly nodeGroups: Map<string, Konva.Group>;
  private options: MindmapNodeRendererOptions;
  private readonly bindNodeEventsCallback: (
    group: Konva.Group,
    node: MindmapNodeElement,
  ) => void;

  constructor(
    layers: RendererLayers,
    store: typeof useUnifiedCanvasStore,
    nodeGroups: Map<string, Konva.Group>,
    options: MindmapNodeRendererOptions,
    bindNodeEventsCallback: (
      group: Konva.Group,
      node: MindmapNodeElement,
    ) => void,
  ) {
    this.layers = layers;
    this.store = store;
    this.nodeGroups = nodeGroups;
    this.options = options;
    this.bindNodeEventsCallback = bindNodeEventsCallback;
  }

  updateOptions(newOptions: Partial<MindmapNodeRendererOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  mergeNodeStyle(style?: Partial<MindmapNodeStyle>): MindmapNodeStyle {
    return { ...DEFAULT_NODE_STYLE, ...style };
  }

  lookupNode(elementId: string): MindmapNodeElement | null {
    const state = this.store.getState() as StoreState;
    const getElement: ((id: string) => CanvasElement | undefined) | undefined =
      state.getElement ?? state.element?.getById;
    const raw = getElement?.(elementId);
    if (!raw || raw.type !== "mindmap-node") return null;

    const mindmapElement = raw as MindmapCanvasElement;
    const nodeData = mindmapElement.data as MindmapNodeData | undefined;

    const level =
      mindmapElement.level ??
      nodeData?.level ??
      ((mindmapElement.parentId ?? (nodeData as MindmapNodeData)?.parentId)
        ? 1
        : 0);
    const color =
      mindmapElement.color ??
      nodeData?.color ??
      MINDMAP_THEME.nodeColors[level % MINDMAP_THEME.nodeColors.length];

    const paletteIndex = level % MINDMAP_THEME.nodeColors.length;
    const borderPalette = MINDMAP_THEME.nodeBorderColors ?? [];
    const themeBorder = borderPalette[paletteIndex] ?? DEFAULT_NODE_STYLE.stroke;
    const textConfig = getTextConfig(
      level === 0 ? "MINDMAP_ROOT" : "MINDMAP_CHILD",
    );

    const style = this.mergeNodeStyle(
      (mindmapElement.style as MindmapNodeStyle | undefined) ?? nodeData?.style,
    );
    const hydratedStyle: MindmapNodeStyle = {
      ...style,
      fill: style.fill ?? color,
      textColor: style.textColor ?? MINDMAP_THEME.textColor,
      fontStyle: style.fontStyle ?? (level === 0 ? "bold" : "normal"),
      fontSize: style.fontSize ?? textConfig.fontSize,
      cornerRadius: style.cornerRadius ?? MINDMAP_THEME.nodeRadius,
      stroke: style.stroke ?? themeBorder,
      strokeWidth: style.strokeWidth ?? (level === 0 ? 2 : 1.5),
      shadowColor: style.shadowColor ?? MINDMAP_THEME.shadow.color,
      shadowBlur: style.shadowBlur ?? MINDMAP_THEME.shadow.blur,
      shadowOffsetX: style.shadowOffsetX ?? MINDMAP_THEME.shadow.offsetX,
      shadowOffsetY: style.shadowOffsetY ?? MINDMAP_THEME.shadow.offsetY,
    };
    return {
      id: raw.id,
      type: "mindmap-node",
      x: raw.x ?? 0,
      y: raw.y ?? 0,
      width: raw.width ?? MINDMAP_CONFIG.defaultNodeWidth,
      height: raw.height ?? MINDMAP_CONFIG.defaultNodeHeight,
      text: mindmapElement.text ?? (nodeData as MindmapNodeData)?.text ?? "",
      style: hydratedStyle,
      parentId:
        mindmapElement.parentId ??
        (nodeData as MindmapNodeData)?.parentId ??
        null,
      level,
      color,
      // CRITICAL: Preserve textWidth and textHeight from the raw element
      textWidth:
        mindmapElement.textWidth ?? (nodeData as MindmapNodeData)?.textWidth,
      textHeight:
        mindmapElement.textHeight ?? (nodeData as MindmapNodeData)?.textHeight,
    };
  }

  renderNode(element: MindmapNodeElement) {
    const style = this.mergeNodeStyle(element.style);

    // Use provided dimensions if they exist (from editor updates), otherwise calculate
    let totalWidth = element.width || MINDMAP_CONFIG.defaultNodeWidth;
    let totalHeight = element.height || MINDMAP_CONFIG.defaultNodeHeight;
    let textWidth = element.textWidth;
    let textHeight = element.textHeight;

    // If dimensions aren't provided, calculate them with wrapping
    if (!textWidth || !textHeight) {
      const maxTextWidth =
        Math.max(MINDMAP_CONFIG.defaultNodeWidth, totalWidth) -
        style.paddingX * 2;
      const metrics = measureMindmapLabelWithWrap(
        element.text ?? "",
        style,
        maxTextWidth,
        MINDMAP_CONFIG.lineHeight,
      );
      textWidth = metrics.width;
      textHeight = metrics.height;
      totalWidth = Math.max(
        textWidth + style.paddingX * 2,
        MINDMAP_CONFIG.minNodeWidth,
      );
      totalHeight = Math.max(
        textHeight + style.paddingY * 2,
        MINDMAP_CONFIG.minNodeHeight,
      );
    }

    const normalized: MindmapNodeElement = {
      ...element,
      style,
      width: totalWidth,
      height: totalHeight,
      textWidth: textWidth || 1,
      textHeight: textHeight || style.fontSize,
    };

    let group = this.nodeGroups.get(element.id);

    // Create group if it doesn't exist or needs recreation
    if (!group || group.getLayer() !== this.layers.main) {
      if (group) {
        group.remove();
        this.nodeGroups.delete(element.id);
      }
      // Check if pan tool is active - if so, disable dragging on elements
      const storeState = this.store.getState();
      const isPanToolActive = storeState?.ui?.selectedTool === "pan";

      group = new Konva.Group({
        id: element.id,
        name: "mindmap-node",
        x: element.x,
        y: element.y,
        width: totalWidth,
        height: totalHeight,
        listening: true,
        draggable: !isPanToolActive, // Mindmap uses native Konva drag, not MarqueeDrag
      });
      group.setAttr("elementId", element.id);
      group.setAttr("nodeType", "mindmap-node");

      this.layers.main.add(group);
      this.nodeGroups.set(element.id, group);
      
      // CRITICAL: Bind events only once when group is created, not on every render
      // Event handlers are additive in Konva - rebinding creates duplicates
      // Must bind here before any rendering happens
      this.bindNodeEventsCallback(group, normalized);
    }

    // Update position and size
    group.position({ x: normalized.x, y: normalized.y });
    group.size({ width: totalWidth, height: totalHeight });

    // Check if pan tool is active - if so, disable dragging on elements
    const storeState2 = this.store.getState();
    const isPanToolActive2 = storeState2?.ui?.selectedTool === "pan";
    group.draggable(!isPanToolActive2); // Mindmap uses native Konva drag
    group.listening(true);
    // Ensure the group can receive mouse events
    group.setAttr("cursor", "pointer");

    // Clear previous children and rebuild
    group.destroyChildren();

    const background = new Konva.Rect({
      x: 0,
      y: 0,
      width: totalWidth,
      height: totalHeight,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      cornerRadius: style.cornerRadius,
      shadowColor: style.shadowColor,
      shadowBlur: style.shadowBlur,
      shadowOffsetX: style.shadowOffsetX ?? 0,
      shadowOffsetY: style.shadowOffsetY ?? 0,
      listening: false,
      perfectDrawEnabled: false,
      name: "node-bg",
    });
    group.add(background);

    // Determine vertical alignment based on content height
    const contentHeight = totalHeight - style.paddingY * 2;
    const verticalAlign = contentHeight < style.fontSize * 2 ? "middle" : "top";

    const text = new Konva.Text({
      x: style.paddingX,
      y: style.paddingY,
      width: totalWidth - style.paddingX * 2,
      height: totalHeight - style.paddingY * 2,
      text: normalized.text ?? "",
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStyle: style.fontStyle ?? "normal",
      fill: style.textColor,
      align: "center",
      verticalAlign: verticalAlign,
      wrap: "word",
      lineHeight: MINDMAP_CONFIG.lineHeight,
      ellipsis: false, // Don't truncate, let it wrap
      listening: false,
      perfectDrawEnabled: false,
      name: "node-text",
    });
    group.add(text);

    // Add an invisible hit area for better event detection
    const hitRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: totalWidth,
      height: totalHeight,
      cornerRadius: style.cornerRadius,
      fill: "transparent",
      listening: true,
      perfectDrawEnabled: false,
      name: "node-hit",
    });
    group.add(hitRect);

    // Optional caching for performance
    if (this.options.cacheNodes) {
      group.cache();
    }

    // Event handlers already bound when group was created - don't rebind on every render
    // Rebinding would create duplicate handlers and stale closures

    this.layers.main.batchDraw();
  }
}
