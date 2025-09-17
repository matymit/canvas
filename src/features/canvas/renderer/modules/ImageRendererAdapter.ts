// Adapter for ImageRenderer to implement RendererModule interface
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { ImageRenderer } from "./ImageRenderer";
import type ImageElement from "../../types/elements/image";

type Id = string;

export class ImageRendererAdapter implements RendererModule {
  private renderer?: ImageRenderer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log("[ImageRendererAdapter] Mounting...");

    // Create ImageRenderer instance
    this.renderer = new ImageRenderer(ctx.layers);

    // Subscribe to store changes - watch image elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract image elements
      (state) => {
        const images = new Map<Id, ImageElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === "image") {
            images.set(id, element as ImageElement);
          }
        }
        return images;
      },
      // Callback: reconcile changes
      (images) => {
        this.reconcile(images);
      },
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialImages = new Map<Id, ImageElement>();
    for (const [id, element] of initialState.elements.entries()) {
      if (element.type === "image") {
        initialImages.set(id, element as ImageElement);
      }
    }
    this.reconcile(initialImages);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log("[ImageRendererAdapter] Unmounting...");
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Cleanup images manually
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer.find(".image").forEach((node: Konva.Node) => node.destroy());
      layer.batchDraw();
    }
  }

  private reconcile(images: Map<Id, ImageElement>) {
    // Only log when there are actual images to reconcile (reduce console spam)
    if (images.size > 0) {
      console.log("[ImageRendererAdapter] Reconciling", images.size, "images");
    }

    if (!this.renderer) return;

    const seen = new Set<Id>();

    // Render/update images (async due to image loading)
    for (const [id, image] of images) {
      seen.add(id);
      // Fire and forget async rendering
      this.renderer.render(image).catch((err) => {
        console.error(
          "[ImageRendererAdapter] Failed to render image:",
          id,
          err,
        );
      });
    }

    // Remove deleted images manually
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer.find(".image").forEach((node: Konva.Node) => {
        const nodeId = node.id();
        if (nodeId && !seen.has(nodeId)) {
          node.destroy();
        }
      });
      layer.batchDraw();
    }
  }
}
