// Adapter for ImageRenderer to implement RendererModule interface
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { ImageRenderer } from "./ImageRenderer";
import type ImageElement from "../../types/image";

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
        console.log("[ImageRendererAdapter] Store subscription triggered with", images.size, "images");
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
      // Log position details for debugging position updates
      for (const [id, image] of images) {
        console.log(`[ImageRendererAdapter] Image ${id} at position (${image.x}, ${image.y})`);
      }
    }

    // DEBUG: Track timing of reconcile calls
    const reconcileStart = performance.now();

    if (!this.renderer) return;

    const seen = new Set<Id>();

    // Render/update images (async due to image loading)
    for (const [id, image] of images) {
      seen.add(id);
      console.log(`[ImageRendererAdapter] Calling renderer.render() for image ${id} at (${image.x}, ${image.y})`);
      // Fire and forget async rendering
      this.renderer.render(image).then(() => {
        console.log(`[ImageRendererAdapter] Successfully rendered image ${id}`);
      }).catch((err) => {
        console.error(
          "[ImageRendererAdapter] Failed to render image:",
          id,
          err,
        );
      });
    }

    // DEBUG: Log timing
    const reconcileEnd = performance.now();
    console.log(`[ImageRendererAdapter] Reconcile took ${reconcileEnd - reconcileStart}ms`);

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
