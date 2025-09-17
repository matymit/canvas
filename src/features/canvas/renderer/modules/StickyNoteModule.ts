// features/canvas/renderer/modules/StickyNoteModule.ts
import Konva from 'konva';
import type { ModuleRendererCtx, RendererModule } from '../index';

type Id = string;

type StickySnapshot = {
  id: Id;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  text?: string;
};

export class StickyNoteModule implements RendererModule {
  private nodes = new Map<Id, Konva.Group>();
  private layers?: Konva.Layer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log('[StickyNoteModule] Mounting...');
    this.layers = ctx.layers.main;
    
    // Subscribe to store changes - watch only sticky-note elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract sticky-note elements
      (state) => {
        const stickyNotes = new Map<Id, StickySnapshot>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === 'sticky-note') {
            stickyNotes.set(id, {
              id,
              x: element.x,
              y: element.y,
              width: element.width || 200,
              height: element.height || 100,
              fill: element.style?.fill,
              text: element.text,
            });
          }
        }
        return stickyNotes;
      },
      // Callback: reconcile changes
      (stickyNotes) => this.reconcile(stickyNotes)
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialStickies = new Map<Id, StickySnapshot>();
    for (const [id, element] of initialState.elements.entries()) {
      if (element.type === 'sticky-note') {
        initialStickies.set(id, {
          id,
          x: element.x,
          y: element.y,
          width: element.width || 200,
          height: element.height || 100,
          fill: element.style?.fill,
          text: element.text,
        });
      }
    }
    this.reconcile(initialStickies);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log('[StickyNoteModule] Unmounting...');
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    for (const group of this.nodes.values()) {
      group.destroy();
    }
    this.nodes.clear();
    if (this.layers) {
      this.layers.batchDraw();
    }
  }

  private reconcile(stickyNotes: Map<Id, StickySnapshot>) {
    console.log('[StickyNoteModule] Reconciling', stickyNotes.size, 'sticky notes');
    
    if (!this.layers) return;

    const seen = new Set<Id>();

    // Add/update existing sticky notes
    for (const [id, sticky] of stickyNotes) {
      seen.add(id);
      let group = this.nodes.get(id);
      
      if (!group) {
        // Create new sticky note
        console.log('[StickyNoteModule] Creating sticky note:', id, 'fill:', sticky.fill);
        group = this.createStickyGroup(sticky);
        this.nodes.set(id, group);
        this.layers.add(group);
      } else {
        // Update existing sticky note
        this.updateStickyGroup(group, sticky);
      }
    }

    // Remove deleted sticky notes
    for (const [id, group] of this.nodes) {
      if (!seen.has(id)) {
        console.log('[StickyNoteModule] Removing sticky note:', id);
        group.destroy();
        this.nodes.delete(id);
      }
    }

    this.layers.batchDraw();
  }

  private createStickyGroup(sticky: StickySnapshot): Konva.Group {
    const group = new Konva.Group({
      id: sticky.id,
      x: sticky.x,
      y: sticky.y,
      draggable: true, // enable dragging
    });

    // Add dragend handler for position commit
    group.on('dragend', (e) => {
      const grp = e.target as Konva.Group;
      const nx = grp.x();
      const ny = grp.y();
      (window as any).__canvasStore?.element?.updateElement?.(sticky.id, { x: nx, y: ny }, { pushHistory: true });
    });

    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: sticky.width,
      height: sticky.height,
      fill: sticky.fill || '#FEF08A', // Default yellow
      stroke: '#E5E7EB',
      strokeWidth: 1,
      cornerRadius: 8,
    });

    const text = new Konva.Text({
      x: 12,
      y: 12,
      width: sticky.width - 24,
      text: sticky.text || '',
      fontSize: 14,
      fontFamily: 'Arial, sans-serif',
      fill: '#374151',
      wrap: 'word',
    });

    group.add(rect);
    group.add(text);

    return group;
  }

  private updateStickyGroup(group: Konva.Group, sticky: StickySnapshot) {
    // Update position
    group.setAttrs({
      x: sticky.x,
      y: sticky.y,
    });

    // Update rectangle
    const rect = group.getChildren()[0] as Konva.Rect;
    rect.setAttrs({
      width: sticky.width,
      height: sticky.height,
      fill: sticky.fill || '#FEF08A',
    });

    // Update text
    const text = group.getChildren()[1] as Konva.Text;
    text.setAttrs({
      width: sticky.width - 24,
      text: sticky.text || '',
    });
  }
}
