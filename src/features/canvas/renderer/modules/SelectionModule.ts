// features/canvas/renderer/modules/SelectionModule.ts
import type { ModuleRendererCtx, RendererModule } from '../index';
import { TransformerManager } from '../../managers/TransformerManager';

export class SelectionModule implements RendererModule {
  private transformerManager?: TransformerManager;
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;
  private selectedElementIds = new Set<string>();

  mount(ctx: ModuleRendererCtx): () => void {
    console.log('[SelectionModule] Mounting...');
    this.storeCtx = ctx;

    // Create transformer manager on overlay layer
    this.transformerManager = new TransformerManager(ctx.stage, {
      overlayLayer: ctx.layers.overlay,
      enabledAnchors: [
        'top-left',
        'top-right', 
        'bottom-left',
        'bottom-right',
        'middle-left',
        'middle-right',
        'top-center',
        'bottom-center',
      ],
      rotateEnabled: true,
      padding: 4,
      anchorSize: 8,
      borderStroke: '#4F46E5',
      borderStrokeWidth: 2,
      anchorStroke: '#FFFFFF',
      anchorFill: '#4F46E5',
      ignoreStroke: false,
      keepRatioKey: 'Shift',
      rotationSnapDeg: 15,
      onTransformStart: (nodes) => {
        console.log('[SelectionModule] Transform start:', nodes.length, 'nodes');
      },
      onTransform: (nodes) => {
        // Real-time updates during transform for smoother UX
        this.updateElementsFromNodes(nodes, false);
      },
      onTransformEnd: (nodes) => {
        console.log('[SelectionModule] Transform end, committing changes');
        this.updateElementsFromNodes(nodes, true); // Commit with history
      },
    });

    // Subscribe to selection changes
    this.unsubscribe = ctx.store.subscribe(
      // Selector: get selected element IDs
      (state) => state.selectedElementIds,
      // Callback: update transformer
      (selectedIds) => this.updateSelection(selectedIds),
      // Fire immediately to handle initial selection
      { fireImmediately: true }
    );

    return () => this.unmount();
  }

  private unmount() {
    console.log('[SelectionModule] Unmounting...');
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.transformerManager) {
      this.transformerManager.destroy();
      this.transformerManager = undefined;
    }
  }

  private updateSelection(selectedIds: Set<string>) {
    this.selectedElementIds = selectedIds;
    console.log('[SelectionModule] Selection updated:', selectedIds.size, 'elements');

    if (!this.transformerManager || !this.storeCtx) return;

    if (selectedIds.size === 0) {
      this.transformerManager.detach();
      return;
    }

    // Find Konva nodes for selected elements across all layers
    const nodes = this.resolveElementsToNodes(selectedIds);
    
    if (nodes.length > 0) {
      console.log('[SelectionModule] Attaching transformer to', nodes.length, 'nodes');
      this.transformerManager.attachToNodes(nodes);
      this.transformerManager.show();
    } else {
      console.warn('[SelectionModule] Could not find nodes for selected elements:', Array.from(selectedIds));
      this.transformerManager.detach();
    }
  }

  private resolveElementsToNodes(elementIds: Set<string>): import('konva/lib/Node').Node[] {
    if (!this.storeCtx) return [];

    const nodes: import('konva/lib/Node').Node[] = [];
    const layers = [this.storeCtx.layers.main, this.storeCtx.layers.highlighter];

    for (const elementId of elementIds) {
      let found = false;
      
      // Search in main layers for nodes with elementId attribute or matching id
      for (const layer of layers) {
        const candidates = layer.find((node) => {
          const nodeElementId = node.getAttr('elementId') || node.id();
          return nodeElementId === elementId;
        });
        
        if (candidates.length > 0) {
          // Prefer groups over individual shapes for better transform experience
          const group = candidates.find(n => n.className === 'Group');
          nodes.push(group || candidates[0]);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.warn('[SelectionModule] Could not find node for element:', elementId);
      }
    }

    return nodes;
  }

  private updateElementsFromNodes(nodes: import('konva/lib/Node').Node[], commitWithHistory: boolean) {
    if (!this.storeCtx) return;

    const updateElement = this.storeCtx.store.getState().element?.update;
    const withUndo = this.storeCtx.store.getState().withUndo;
    
    if (!updateElement) {
      console.error('[SelectionModule] No element update method available');
      return;
    }

    const updates: Array<{ id: string; changes: any }> = [];

    for (const node of nodes) {
      const elementId = node.getAttr('elementId') || node.id();
      if (!elementId) continue;

      const pos = node.position();
      const size = node.size();
      const rotation = node.rotation();
      const scale = node.scale();

      updates.push({
        id: elementId,
        changes: {
          x: Math.round(pos.x * 100) / 100, // Round to avoid precision issues
          y: Math.round(pos.y * 100) / 100,
          // Apply scale to width/height if scaled
          width: Math.round((size.width * (scale?.x || 1)) * 100) / 100,
          height: Math.round((size.height * (scale?.y || 1)) * 100) / 100,
          rotation: Math.round(rotation * 100) / 100,
        }
      });

      // Reset scale after applying to dimensions
      if (scale && (scale.x !== 1 || scale.y !== 1)) {
        node.scale({ x: 1, y: 1 });
        node.size({ 
          width: size.width * scale.x, 
          height: size.height * scale.y 
        });
      }
    }

    // Apply all updates
    const applyUpdates = () => {
      for (const { id, changes } of updates) {
        try {
          updateElement(id, changes);
        } catch (error) {
          console.error('[SelectionModule] Failed to update element', id, ':', error);
        }
      }
    };

    if (commitWithHistory && withUndo && updates.length > 0) {
      const actionName = updates.length === 1 ? 'Transform element' : `Transform ${updates.length} elements`;
      withUndo(actionName, applyUpdates);
    } else {
      applyUpdates();
    }
  }

  // Public API for other modules to trigger selection
  selectElement(elementId: string) {
    if (!this.storeCtx) return;
    const setSelection = this.storeCtx.store.getState().setSelection;
    if (setSelection) {
      setSelection([elementId]);
    }
  }

  // Auto-select element (useful for tools after creation)
  autoSelectElement(elementId: string) {
    console.log('[SelectionModule] Auto-selecting element:', elementId);
    // Small delay to ensure element is rendered first
    setTimeout(() => {
      this.selectElement(elementId);
    }, 100);
  }
}