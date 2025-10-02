// Adapter for ImageRenderer to implement RendererModule interface
import type Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { ImageRenderer, type RendererLayers } from "./ImageRenderer";
import { getWorldViewportBounds } from "../../utils/viewBounds";
import type ImageElement from "../../types/image";
import { debug } from "../../../../utils/debug";

const LOG_CATEGORY = "renderer/image-adapter";

type Id = string;

export class ImageRendererAdapter implements RendererModule {
  private renderer?: ImageRenderer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    // Create ImageRenderer instance
    this.renderer = new ImageRenderer(ctx.layers);

    // Subscribe to store changes - watch image elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract image elements AND selectedTool (for draggable state)
      (state) => {
        const images = new Map<Id, ImageElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === "image") {
            images.set(id, element as ImageElement);
          }
        }
        // CRITICAL FIX: Include selectedTool so draggable state updates when tool changes
        return { images, selectedTool: state.ui?.selectedTool };
      },
      // Callback: reconcile changes (extract images from returned object)
      ({ images }) => {
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
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Cleanup images manually
    const layer = (this.renderer as unknown as { layers: RendererLayers }).layers.main;
    if (layer) {
      layer.find(".image").forEach((node: Konva.Node) => node.destroy());
      layer.batchDraw();
    }
  }

  private reconcile(images: Map<Id, ImageElement>) {
    if (!this.renderer) return;

    const seen = new Set<Id>();
    const layers = (this.renderer as unknown as { layers?: RendererLayers }).layers;
    const stage = layers?.main?.getStage ? layers.main.getStage() : null;
    const bounds = stage ? getWorldViewportBounds(stage) : null;

    // Render/update images (async due to image loading)
    for (const [id, image] of images) {
      seen.add(id);
      if (bounds) {
        const right = (image.x ?? 0) + image.width;
        const bottom = (image.y ?? 0) + image.height;
        const isOffscreen =
          right < bounds.minX ||
          bottom < bounds.minY ||
          (image.x ?? 0) > bounds.maxX ||
          (image.y ?? 0) > bounds.maxY;

        debug("ImageRendererAdapter: checking bounds", {
          category: LOG_CATEGORY,
          data: {
            id,
            imageX: image.x,
            imageY: image.y,
            imageW: image.width,
            imageH: image.height,
            right,
            bottom,
            bounds,
            isOffscreen,
          },
        });

        if (isOffscreen) {
          debug("ImageRendererAdapter: image hidden due to offscreen", {
            category: LOG_CATEGORY,
            data: { id },
          });
          this.renderer.setVisibility(id, false);
          continue;
        }
      }

      this.renderer.setVisibility(id, true);
      // Fire and forget async rendering
      this.renderer.render(image).catch((_err) => {
        // Error: [ImageRendererAdapter] Failed to render image: ${id}
      });
    }

    // Remove deleted images manually
    const layer = (this.renderer as unknown as { layers: RendererLayers }).layers.main;
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
