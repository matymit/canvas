// StickyRenderingEngine.ts
// Rendering engine for sticky notes

import Konva from "konva";
import { getTextConfig } from "../../../constants/TextConstants";
import { getWorldViewportBounds } from "../../../utils/viewBounds";

type Id = string;

export type StickySnapshot = {
  id: Id;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  text?: string;
};

export interface StickyRenderingEngineOptions {
  layer: Konva.Layer;
  setupStickyInteractions: (group: Konva.Group, elementId: string) => void;
  getEditorElementId: () => string | null;
  repositionActiveEditor: (group: Konva.Group) => void;
  maybeStartPendingEdit: (elementId: string, group?: Konva.Group) => void;
  isPanToolActive: () => boolean;
}

/**
 * Rendering engine subsystem for sticky notes
 * Manages Konva groups, reconciliation, and visual updates
 */
export class StickyRenderingEngine {
  private readonly nodes = new Map<Id, Konva.Group>();
  private readonly options: StickyRenderingEngineOptions;

  constructor(options: StickyRenderingEngineOptions) {
    this.options = options;
  }

  /**
   * Get all node groups
   */
  getNodes(): Map<Id, Konva.Group> {
    return this.nodes;
  }

  /**
   * Reconcile sticky notes with current state
   */
  reconcile(stickyNotes: Map<Id, StickySnapshot>): void {
    const layer = this.options.layer;
    if (!layer) return;

    const seen = new Set<Id>();
    const stage = layer.getStage();
    const viewRect = stage ? getWorldViewportBounds(stage) : null;

    // Add/update existing sticky notes
    for (const [id, sticky] of stickyNotes) {
      seen.add(id);

      // Check if sticky is in viewport (with padding)
      const inViewport = viewRect
        ? !(
            sticky.x + sticky.width < (viewRect as any).x - 500 ||
            sticky.x > (viewRect as any).x + (viewRect as any).width + 500 ||
            sticky.y + sticky.height < (viewRect as any).y - 500 ||
            sticky.y > (viewRect as any).y + (viewRect as any).height + 500
          )
        : true;

      const existing = this.nodes.get(id);

      if (existing) {
        // Update existing group
        this.updateStickyGroup(existing, sticky);

        // Handle visibility based on viewport
        if (!inViewport && existing.visible()) {
          existing.visible(false);
        } else if (inViewport && !existing.visible()) {
          existing.visible(true);
        }
      } else if (inViewport) {
        // Create new group only if in viewport
        const group = this.createStickyGroup(sticky);
        this.nodes.set(id, group);
        layer.add(group);

        // Setup interactions after adding to layer
        this.options.setupStickyInteractions(group, id);

        // Check for pending immediate edit
        this.options.maybeStartPendingEdit(id, group);
      }
    }

    // Remove stale groups
    for (const [id, group] of this.nodes) {
      if (!seen.has(id)) {
        group.destroy();
        this.nodes.delete(id);
      }
    }

    layer.batchDraw();
  }

  /**
   * Create a new sticky note Konva group
   */
  private createStickyGroup(sticky: StickySnapshot): Konva.Group {
    const group = new Konva.Group({
      id: sticky.id,
      x: sticky.x,
      y: sticky.y,
      width: sticky.width,
      height: sticky.height,
      draggable: !this.options.isPanToolActive(),
    });

    // CRITICAL: Set attributes for proper integration
    group.setAttr("elementId", sticky.id);
    group.setAttr("nodeType", "sticky-note");
    group.setAttr("elementType", "sticky-note");
    group.setAttr("keepAspectRatio", true);

    // Background rectangle
    const rect = new Konva.Rect({
      name: "sticky-bg",
      x: 0,
      y: 0,
      width: sticky.width,
      height: sticky.height,
      fill: sticky.fill || "#FEF08A",
      cornerRadius: 8,
      shadowColor: "#000000",
      shadowBlur: 8,
      shadowOpacity: 0.2,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
    });

    // Text
    const textConfig = getTextConfig("STICKY_NOTE");
    const text = new Konva.Text({
      name: "sticky-text",
      x: 12,
      y: 12,
      width: Math.max(0, sticky.width - 24),
      height: Math.max(0, sticky.height - 24),
      text: sticky.text || "",
      fontSize: textConfig.fontSize,
      fontFamily: textConfig.fontFamily,
      fontWeight: textConfig.fontWeight,
      lineHeight: textConfig.lineHeight,
      fill: "#374151",
      wrap: "word",
      verticalAlign: "top",
    });

    group.add(rect);
    group.add(text);

    return group;
  }

    /**
   * Update an existing sticky note group
   */
  private updateStickyGroup(group: Konva.Group, sticky: StickySnapshot) {
    // Update position and size
    group.position({ x: sticky.x, y: sticky.y });
    group.size({ width: sticky.width, height: sticky.height });
    group.draggable(!this.options.isPanToolActive());

    // Ensure attributes are maintained
    group.setAttr("elementId", sticky.id);
    group.setAttr("nodeType", "sticky-note");
    group.setAttr("elementType", "sticky-note");
    group.setAttr("keepAspectRatio", true);

    // Update rectangle
    const rect = group.findOne(".sticky-bg") as Konva.Rect;
    if (rect) {
      rect.setAttrs({
        width: sticky.width,
        height: sticky.height,
        fill: sticky.fill || "#FEF08A",
      });
    }

    // Update text
    const text = group.findOne(".sticky-text") as Konva.Text;
    if (text) {
      text.setAttrs({
        width: Math.max(0, sticky.width - 24),
        height: Math.max(0, sticky.height - 24),
        text: sticky.text || "",
      });
    }

    // Update active editor if editing this element
    const editorElementId = this.options.getEditorElementId();
    if (editorElementId === sticky.id) {
      this.options.repositionActiveEditor(group);
    }
  }

  /**
   * Destroy all nodes (for cleanup)
   */
  destroy(): void {
    for (const group of this.nodes.values()) {
      group.destroy();
    }
    this.nodes.clear();
  }
}
