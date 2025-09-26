import type { ModuleRendererCtx, RendererModule } from '../types';

export class ViewportRenderer implements RendererModule {
  private unsubscribe?: () => void;
  mount(ctx: ModuleRendererCtx): () => void {
    const stage = ctx.stage;
    const store = ctx.store;
    // Subscribe to viewport state changes (x, y, scale)
    this.unsubscribe = store.subscribe(
      (state) => state.viewport,
      (viewportState) => {
        // Apply viewport changes to stage in a batched frame
        requestAnimationFrame(() => {
          stage.scale({ x: viewportState.scale, y: viewportState.scale });
          stage.position({ x: viewportState.x, y: viewportState.y });
          stage.batchDraw();
        });
      },
      { fireImmediately: true }
    );
    return () => {
      this.unsubscribe?.();
    };
  }
}
