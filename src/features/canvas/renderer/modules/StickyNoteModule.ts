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
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log('[StickyNoteModule] Mounting...');
    this.layers = ctx.layers.main;
    this.storeCtx = ctx;
    
    // Subscribe to store changes - watch only sticky-note elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract sticky-note elements
      (state) => {
        const stickyNotes = new Map<Id, StickySnapshot>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === 'sticky-note') {
            stickyNotes.set(id, {
              id,
              x: element.x || 0,
              y: element.y || 0,
              width: element.width || 240,
              height: element.height || 180,
              fill: element.style?.fill || element.fill,
              text: element.text || element.data?.text || '',
            });
          }
        }
        return stickyNotes;
      },
      // Callback: reconcile changes
      (stickyNotes) => this.reconcile(stickyNotes),
      // Options: shallow compare and fire immediately
      {
        fireImmediately: true,
        equalityFn: (a: Map<Id, StickySnapshot>, b: Map<Id, StickySnapshot>) => {
          if (a.size !== b.size) return false;
          for (const [id, aSticky] of a) {
            const bSticky = b.get(id);
            if (!bSticky) return false;
            if (JSON.stringify(aSticky) !== JSON.stringify(bSticky)) return false;
          }
          return true;
        }
      }
    );

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log('[StickyNoteModule] Unmounting...');
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
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
    
    if (!this.layers) {
      console.warn('[StickyNoteModule] No main layer available');
      return;
    }

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
        console.log('[StickyNoteModule] Updating sticky note:', id, 'fill:', sticky.fill);
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
      draggable: true,
    });

    // CRITICAL: Set elementId for selection handling
    group.setAttr('elementId', sticky.id);

    // Add interaction handlers
    this.setupStickyInteractions(group, sticky.id);

    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: sticky.width,
      height: sticky.height,
      fill: sticky.fill || '#FEF08A', // Default sticky yellow
      stroke: '#E5E7EB',
      strokeWidth: 1,
      cornerRadius: 8,
      shadowColor: 'black',
      shadowBlur: 10,
      shadowOpacity: 0.1,
      shadowOffset: { x: 0, y: 2 },
    });

    const text = new Konva.Text({
      x: 12,
      y: 12,
      width: Math.max(0, sticky.width - 24),
      text: sticky.text || '',
      fontSize: 14,
      fontFamily: 'Inter, system-ui, sans-serif',
      fill: '#374151',
      wrap: 'word',
      lineHeight: 1.4,
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
    if (rect) {
      rect.setAttrs({
        width: sticky.width,
        height: sticky.height,
        fill: sticky.fill || '#FEF08A',
      });
    }

    // Update text
    const text = group.getChildren()[1] as Konva.Text;
    if (text) {
      text.setAttrs({
        width: Math.max(0, sticky.width - 24),
        text: sticky.text || '',
      });
    }
  }

  private setupStickyInteractions(group: Konva.Group, elementId: string) {
    // Drag handling with store updates
    group.on('dragend', () => {
      if (!this.storeCtx) return;
      
      const pos = group.position();
      const updateElement = this.storeCtx.store.getState().element?.update;
      
      if (updateElement) {
        try {
          updateElement(elementId, { x: pos.x, y: pos.y });
          console.log('[StickyNoteModule] Updated position for', elementId, pos);
        } catch (error) {
          console.error('[StickyNoteModule] Failed to update position:', error);
        }
      }
    });

    // Double-click to edit text (optional - can be handled by tools)
    group.on('dblclick', () => {
      console.log('[StickyNoteModule] Double-click on sticky note:', elementId);
      // Could trigger text editing mode here
    });

    // Hover effects
    group.on('mouseenter', () => {
      document.body.style.cursor = 'move';
    });

    group.on('mouseleave', () => {
      document.body.style.cursor = 'default';
    });
  }
}