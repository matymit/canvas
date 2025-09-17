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
      id: sticky.id, // FIXED: Use native id() method instead of elementId attr
      x: sticky.x,
      y: sticky.y,
      draggable: true,
    });

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
    // FIXED: Add click handler for selection
    group.on('click', (e) => {
      e.cancelBubble = true; // Prevent stage click
      if (!this.storeCtx) return;
      
      const store = this.storeCtx.store.getState();
      const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
      
      if (store.selection) {
        if (isAdditive) {
          store.selection.toggle?.(elementId);
        } else {
          store.selection.set?.([elementId]);
        }
      }
    });

    // Drag handling with store updates and proper transform commits
    let dragStartPos: { x: number; y: number } | null = null;
    
    group.on('dragstart', () => {
      dragStartPos = { x: group.x(), y: group.y() };
      
      // Begin transform in store if available
      if (this.storeCtx) {
        const store = this.storeCtx.store.getState();
        store.selection?.beginTransform?.();
      }
    });

    group.on('dragend', () => {
      if (!this.storeCtx || !dragStartPos) return;
      
      const pos = group.position();
      const store = this.storeCtx.store.getState();
      
      // Use withUndo for proper history management
      const withUndo = store.withUndo || store.history?.withUndo;
      const updateElement = store.element?.update || store.updateElement;
      
      if (updateElement) {
        const updateFn = () => {
          updateElement(elementId, { x: pos.x, y: pos.y });
          console.log('[StickyNoteModule] Updated position for', elementId, pos);
        };
        
        if (withUndo) {
          withUndo('Move sticky note', updateFn);
        } else {
          updateFn();
        }
      }
      
      // End transform in store
      store.selection?.endTransform?.();
      dragStartPos = null;
    });

    // Double-click to edit text
    group.on('dblclick', (e) => {
      e.cancelBubble = true;
      console.log('[StickyNoteModule] Double-click on sticky note:', elementId);
      
      if (!this.storeCtx) return;
      
      // Get stage and calculate position for text editor
      const stage = group.getStage();
      if (!stage) return;
      
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const groupPos = group.absolutePosition();
      
      // Create text editor overlay
      this.createTextEditor(
        rect.left + groupPos.x,
        rect.top + groupPos.y,
        group.width(),
        group.height(),
        elementId
      );
    });

    // Hover effects
    group.on('mouseenter', () => {
      document.body.style.cursor = 'move';
    });

    group.on('mouseleave', () => {
      document.body.style.cursor = 'default';
    });
  }

  private createTextEditor(pageX: number, pageY: number, width: number, height: number, elementId: string) {
    // Remove any existing editor
    const existing = document.querySelector('[data-sticky-editor]');
    if (existing) {
      existing.remove();
    }

    const editor = document.createElement('textarea');
    editor.setAttribute('data-sticky-editor', 'true');
    editor.setAttribute('data-testid', 'sticky-note-input');
    
    // Get current text from store
    const store = this.storeCtx?.store.getState();
    const element = store?.elements?.get?.(elementId) || store?.element?.getById?.(elementId);
    const currentText = element?.text || element?.data?.text || '';
    
    editor.value = currentText;
    
    editor.style.cssText = `
      position: absolute;
      left: ${pageX + 12}px;
      top: ${pageY + 12}px;
      width: ${width - 24}px;
      height: ${height - 24}px;
      border: 2px solid #007acc;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.95);
      z-index: 1000;
      font-family: Inter, system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      resize: none;
      outline: none;
      padding: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(editor);
    editor.focus();
    editor.select();

    const commit = () => {
      const newText = editor.value;
      
      if (this.storeCtx) {
        const store = this.storeCtx.store.getState();
        const updateElement = store.element?.update || store.updateElement;
        const withUndo = store.withUndo || store.history?.withUndo;
        
        if (updateElement) {
          const updateFn = () => {
            updateElement(elementId, { text: newText });
          };
          
          if (withUndo) {
            withUndo('Edit sticky note text', updateFn);
          } else {
            updateFn();
          }
        }
      }
      
      // Clean up editor
      try {
        editor.remove();
      } catch {}
    };

    // Event handlers
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        commit(); 
      }
      if (e.key === 'Escape') { 
        e.preventDefault(); 
        commit(); 
      }
    });

    editor.addEventListener('blur', commit, { once: true });
    
    // Click outside to commit
    const clickOutside = (e: Event) => {
      if (!editor.contains(e.target as Node)) {
        commit();
        document.removeEventListener('click', clickOutside, true);
      }
    };
    
    // Small delay to prevent immediate close
    setTimeout(() => {
      document.addEventListener('click', clickOutside, true);
    }, 100);
  }
}