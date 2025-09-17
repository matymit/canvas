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

    // FIXED: Make module globally accessible for tool integration
    (window as any).selectionModule = this;
    console.log('[SelectionModule] Module registered globally');

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
        // Begin transform in store if available
        const store = this.storeCtx?.store.getState();
        if (store?.selection?.beginTransform) {
          store.selection.beginTransform();
        }
      },
      onTransform: (nodes) => {
        // Real-time updates during transform for smoother UX
        this.updateElementsFromNodes(nodes, false);
      },
      onTransformEnd: (nodes) => {
        console.log('[SelectionModule] Transform end, committing changes');
        this.updateElementsFromNodes(nodes, true); // Commit with history
        
        // End transform in store if available
        const store = this.storeCtx?.store.getState();
        if (store?.selection?.endTransform) {
          store.selection.endTransform();
        }
      },
    });

    // Subscribe to selection changes with proper fallbacks for different store structures
    this.unsubscribe = ctx.store.subscribe(
      // Selector: get selected element IDs with fallbacks for different store structures
      (state) => {
        // Try different possible selection state locations
        const selection = state.selectedElementIds || 
                         state.selection?.selectedIds ||
                         state.selection?.selected ||
                         new Set<string>();
        
        // Convert array to Set if needed
        if (Array.isArray(selection)) {
          return new Set(selection);
        }
        
        // Return as Set
        return selection instanceof Set ? selection : new Set<string>();
      },
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
    
    // Clean up global reference
    if ((window as any).selectionModule === this) {
      (window as any).selectionModule = null;
    }
  }

  private updateSelection(selectedIds: Set<string>) {
    this.selectedElementIds = selectedIds;
    console.log('[SelectionModule] Selection updated:', selectedIds.size, 'elements', Array.from(selectedIds));

    if (!this.transformerManager || !this.storeCtx) return;

    if (selectedIds.size === 0) {
      this.transformerManager.detach();
      return;
    }

    // Small delay to ensure elements are fully rendered
    setTimeout(() => {
      // Find Konva nodes for selected elements across all layers
      const nodes = this.resolveElementsToNodes(selectedIds);
      
      if (nodes.length > 0) {
        console.log('[SelectionModule] Attaching transformer to', nodes.length, 'nodes');
        this.transformerManager?.attachToNodes(nodes);
        this.transformerManager?.show();
      } else {
        console.warn('[SelectionModule] Could not find nodes for selected elements:', Array.from(selectedIds));
        this.transformerManager?.detach();
      }
    }, 50);
  }

  private resolveElementsToNodes(elementIds: Set<string>): import('konva/lib/Node').Node[] {
    if (!this.storeCtx) return [];

    const nodes: import('konva/lib/Node').Node[] = [];

    // Collect all available layers and filter out undefined/null ones
    const allLayers = [
      { name: 'main', layer: this.storeCtx.layers.main },
      { name: 'highlighter', layer: this.storeCtx.layers.highlighter }
    ];

    const validLayers = allLayers.filter(({ name, layer }) => {
      if (!layer) {
        console.warn(`[SelectionModule] Layer '${name}' is undefined, skipping search`);
        return false;
      }
      return true;
    }).map(({ layer }) => layer);

    if (validLayers.length === 0) {
      console.error('[SelectionModule] No valid layers available for element resolution');
      return [];
    }

    for (const elementId of elementIds) {
      let found = false;

      // Search in valid layers for nodes with elementId attribute or matching id
      for (const layer of validLayers) {
        // Additional safety check before calling find()
        if (!layer || typeof layer.find !== 'function') {
          console.warn('[SelectionModule] Invalid layer encountered, skipping');
          continue;
        }

        const candidates = layer.find((node) => {
          const nodeElementId = node.getAttr('elementId') || node.id();
          return nodeElementId === elementId;
        });
        
        if (candidates.length > 0) {
          // Prefer groups over individual shapes for better transform experience
          const group = candidates.find(n => n.className === 'Group');
          nodes.push(group || candidates[0]);
          found = true;
          console.log('[SelectionModule] Found node for element', elementId, ':', group ? 'Group' : candidates[0].className);
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

  // FIXED: Public API for other modules to trigger selection with proper store integration
  selectElement(elementId: string) {
    if (!this.storeCtx) {
      console.error('[SelectionModule] No store context available for selection');
      return;
    }
    
    const store = this.storeCtx.store.getState();
    console.log('[SelectionModule] Selecting element via store:', elementId);
    
    // Try different store selection methods with proper error handling
    try {
      if (store.setSelection) {
        store.setSelection([elementId]);
        console.log('[SelectionModule] Selection set via setSelection method');
      } else if (store.selection?.set) {
        store.selection.set([elementId]);
        console.log('[SelectionModule] Selection set via selection.set method');
      } else if (store.selectedElementIds) {
        // Handle Set-based selection
        if (store.selectedElementIds instanceof Set) {
          store.selectedElementIds.clear();
          store.selectedElementIds.add(elementId);
          console.log('[SelectionModule] Selection set via Set manipulation');
        } else if (Array.isArray(store.selectedElementIds)) {
          store.selectedElementIds.length = 0;
          store.selectedElementIds.push(elementId);
          console.log('[SelectionModule] Selection set via Array manipulation');
        }
        // Trigger state update if using Zustand
        this.storeCtx.store.setState?.({ selectedElementIds: store.selectedElementIds });
      } else {
        console.error('[SelectionModule] No valid selection method found in store');
      }
    } catch (error) {
      console.error('[SelectionModule] Error during element selection:', error);
    }
  }

  // FIXED: Enhanced auto-select element with better timing and error recovery
  autoSelectElement(elementId: string) {
    console.log('[SelectionModule] Auto-selecting element:', elementId);
    
    // Immediate selection attempt
    this.selectElement(elementId);
    
    // Enhanced retry mechanism with exponential backoff for better reliability
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 25; // Start with shorter delay
    
    const attemptSelection = () => {
      attempts++;
      const delay = baseDelay * Math.pow(1.5, attempts - 1); // Exponential backoff
      
      setTimeout(() => {
        // Check if element is now available
        const nodes = this.resolveElementsToNodes(new Set([elementId]));
        
        if (nodes.length > 0) {
          console.log(`[SelectionModule] Element found on attempt ${attempts}, selection successful`);
          // Force transformer update to ensure visibility
          if (this.transformerManager) {
            this.transformerManager.attachToNodes(nodes);
            this.transformerManager.show();
          }
          return; // Success, stop retrying
        }
        
        if (attempts < maxAttempts) {
          console.log(`[SelectionModule] Attempt ${attempts} failed, retrying in ${delay}ms...`);
          // Retry selection in store as element might not be rendered yet
          this.selectElement(elementId);
          attemptSelection(); // Recursive retry
        } else {
          console.warn(`[SelectionModule] Auto-selection failed after ${maxAttempts} attempts for element:`, elementId);
        }
      }, delay);
    };
    
    // Start the retry mechanism
    attemptSelection();
  }

  // Public method to clear selection
  clearSelection() {
    if (!this.storeCtx) return;
    
    const store = this.storeCtx.store.getState();
    
    if (store.setSelection) {
      store.setSelection([]);
    } else if (store.selection?.clear) {
      store.selection.clear();
    } else if (store.selectedElementIds) {
      if (store.selectedElementIds instanceof Set) {
        store.selectedElementIds.clear();
      } else if (Array.isArray(store.selectedElementIds)) {
        store.selectedElementIds.length = 0;
      }
      this.storeCtx.store.setState?.({ selectedElementIds: store.selectedElementIds });
    }
  }
}