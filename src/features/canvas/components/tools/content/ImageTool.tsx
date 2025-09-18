// Image tool component with streamlined auto-placement workflow
import React, { useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { loadImageFromFile } from '../../../utils/image/ImageLoader';

type StageRef = React.RefObject<Konva.Stage>;

export interface ImageToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'image'
}


export const ImageTool: React.FC<ImageToolProps> = ({
  isActive,
  stageRef,
  toolId = 'image'
}) => {
  const selectedTool = useUnifiedCanvasStore((s: any) => s.selectedTool ?? s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s: any) => s.setSelectedTool ?? s.ui?.setSelectedTool);
  const addElement = useUnifiedCanvasStore((s: any) => s.element?.addElement || s.element?.createElement || s.elements?.addElement);
  const selectOnly = useUnifiedCanvasStore((s: any) => (s as any).replaceSelectionWithSingle ?? s.selection?.replaceSelectionWithSingle);
  const viewport = useUnifiedCanvasStore((s: any) => s.viewport);

  const stateRef = useRef<{
    start: { x: number; y: number } | null;
    preview: Konva.Image | null;
    dataUrl: string | null;
    natural: { w: number; h: number } | null;
  }>({ start: null, preview: null, dataUrl: null, natural: null });

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Track if file picker has been triggered for this tool activation
  const hasTriggeredPickerRef = useRef(false);
  const fileInputPromiseRef = useRef<Promise<void> | null>(null);

  // Reset trigger flag when tool changes
  useEffect(() => {
    if (selectedTool !== toolId) {
      hasTriggeredPickerRef.current = false;
      fileInputPromiseRef.current = null;
      // Clear any existing image data when switching away from tool
      stateRef.current.dataUrl = null;
      stateRef.current.natural = null;
    }
  }, [selectedTool, toolId]);

  // Trigger file picker only when explicitly requested
  const triggerFilePicker = useCallback(async () => {
    if (hasTriggeredPickerRef.current || fileInputPromiseRef.current) {
      return fileInputPromiseRef.current;
    }

    hasTriggeredPickerRef.current = true;

    const promise = new Promise<void>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';

      const onChange = async () => {
        try {
          const files = input.files;
          if (!files || files.length === 0) {
            // User cancelled - switch back to select tool
            setSelectedTool?.('select');
            resolve();
            return;
          }

          const { dataUrl, naturalWidth, naturalHeight } = await loadImageFromFile(files[0]);
          stateRef.current.dataUrl = dataUrl;
          stateRef.current.natural = { w: naturalWidth, h: naturalHeight };

          // Image loaded successfully, ready for auto-placement
          resolve();
        } catch (error) {
          console.error('Failed to load image:', error);
          setSelectedTool?.('select');
          reject(error);
        } finally {
          // Cleanup
          if (input.parentElement) {
            input.parentElement.removeChild(input);
          }
        }
      };

      input.addEventListener('change', onChange, { once: true });
      document.body.appendChild(input);
      inputRef.current = input;
      input.click();
    });

    fileInputPromiseRef.current = promise;
    return promise;
  }, [setSelectedTool]);

  // Commit image to store with proper history integration and immediate selection
  const commitImage = useCallback(async (x: number, y: number, w: number, h: number) => {
    const nat = stateRef.current.natural!;
    const src = stateRef.current.dataUrl!;

    const id = crypto?.randomUUID?.() || `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const element = {
      id,
      type: 'image' as const,
      x,
      y,
      width: w,
      height: h,
      src,
      naturalWidth: nat.w,
      naturalHeight: nat.h,
      keepAspectRatio: true,
    };

    console.log('[ImageTool.commitImage] Starting commit process', {
      elementId: id,
      position: { x, y },
      size: { w, h },
      timestamp: Date.now()
    });

    // Use store methods directly for better reliability
    const store = useUnifiedCanvasStore.getState();

    console.log('[ImageTool.commitImage] Store methods available:', {
      hasWithUndo: !!store.withUndo,
      hasElementUpsert: !!store.element?.upsert,
      hasElementsSet: !!store.elements?.set,
      hasAddElement: !!addElement,
      hasElements: !!store.elements,
      elementsSize: store.elements?.size || 'unknown'
    });

    // Helper to set selection using available store methods
    const setElementSelection = () => {
      if (store.setSelection) {
        store.setSelection([id]);
      } else if (store.selection?.set) {
        store.selection.set([id]);
      } else if (store.selection?.selectOne) {
        store.selection.selectOne(id);
      } else if (selectOnly) {
        selectOnly(id);
      } else {
        console.warn('[ImageTool] No selection method available');
      }
    };

    // Use withUndo for proper history integration
    if (store.withUndo) {
      console.log('[ImageTool.commitImage] Using withUndo for history integration');
      store.withUndo('Add image', () => {
        console.log('[ImageTool.commitImage] Inside withUndo mutator');
        // Try multiple store methods for adding elements
        if (store.element?.upsert) {
          console.log('[ImageTool.commitImage] Calling store.element.upsert');
          const returnedId = store.element.upsert(element);
          console.log('[ImageTool.commitImage] Upsert returned ID:', returnedId);
        } else if (store.elements?.set) {
          console.log('[ImageTool.commitImage] Calling store.elements.set');
          store.elements.set(id, element);
        } else if (addElement) {
          console.log('[ImageTool.commitImage] Calling addElement');
          addElement(element);
        } else {
          console.error('[ImageTool] No valid store method found for adding element');
          return;
        }

        // Immediately verify the element was stored
        const immediateCheck = useUnifiedCanvasStore.getState();
        const storedElement = immediateCheck.element?.getById(id) || immediateCheck.elements?.get(id);
        console.log('[ImageTool.commitImage] Immediate verification in mutator:', {
          elementExists: !!storedElement,
          storeElementsSize: immediateCheck.elements?.size,
          elementData: storedElement ? { id: storedElement.id, type: storedElement.type } : null
        });
      });
    } else {
      console.log('[ImageTool.commitImage] Using fallback without history');
      // Fallback without history
      if (store.element?.upsert) {
        console.log('[ImageTool.commitImage] Fallback: calling store.element.upsert');
        store.element.upsert(element);
      } else if (addElement) {
        console.log('[ImageTool.commitImage] Fallback: calling addElement');
        addElement(element);
      }
    }

    // Verify the element was persisted immediately after the store operation
    const postStoreState = useUnifiedCanvasStore.getState();
    const verifyElement = postStoreState.element?.getById(id) || postStoreState.elements?.get(id);
    console.log('[ImageTool.commitImage] Post-store verification:', {
      elementExists: !!verifyElement,
      storeElementsSize: postStoreState.elements?.size,
      elementData: verifyElement ? { id: verifyElement.id, type: verifyElement.type, x: verifyElement.x, y: verifyElement.y } : null,
      allElementIds: postStoreState.elementOrder || []
    });

    // Wait longer for the ImageRenderer to fully process the new element
    // Use multiple RAF cycles to ensure renderer has completed setup
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Use SelectionModule's auto-selection which has better retry logic
    const selectionModule = (window as any).selectionModule;
    if (selectionModule?.autoSelectElement) {
      console.log('[ImageTool] Using SelectionModule auto-selection for:', id);
      selectionModule.autoSelectElement(id);
    } else {
      // Fallback to manual selection methods
      console.log('[ImageTool] Fallback to manual selection for:', id);
      setElementSelection();
    }

    // Switch to select tool for immediate manipulation
    setSelectedTool?.('select');

    // Reset image data for next use
    stateRef.current.dataUrl = null;
    stateRef.current.natural = null;
  }, [setSelectedTool, selectOnly, addElement]);

  // Auto-place image at center of viewport
  const autoPlaceImage = useCallback(async () => {
    if (!stateRef.current.dataUrl || !stateRef.current.natural || !stageRef.current) {
      return;
    }

    const stage = stageRef.current;
    const stageSize = { width: stage.width(), height: stage.height() };
    const nat = stateRef.current.natural;

    // Calculate center position in stage coordinates
    const centerX = stageSize.width / 2;
    const centerY = stageSize.height / 2;

    // Convert stage center to world coordinates if viewport is available
    let worldX = centerX;
    let worldY = centerY;
    if (viewport?.stageToWorld) {
      const worldPos = viewport.stageToWorld(centerX, centerY);
      worldX = worldPos.x;
      worldY = worldPos.y;
    }

    // Calculate reasonable default size (max 300px, maintain aspect ratio)
    const maxSize = 300;
    const aspect = nat.w / nat.h;
    let width = Math.min(maxSize, nat.w);
    let height = width / aspect;

    if (height > maxSize) {
      height = maxSize;
      width = height * aspect;
    }

    // Position the image centered
    const x = worldX - width / 2;
    const y = worldY - height / 2;

    // Commit the image and wait for completion
    await commitImage(x, y, width, height);
  }, [stageRef, viewport, commitImage]);

  // Auto-trigger file picker when image tool becomes active
  useEffect(() => {
    const active = isActive && selectedTool === toolId;
    if (!active || hasTriggeredPickerRef.current) return;

    // Trigger file picker immediately when tool is selected
    const autoTrigger = async () => {
      try {
        await triggerFilePicker();
        // If image was loaded successfully, place it automatically
        if (stateRef.current.dataUrl && stageRef.current) {
          await autoPlaceImage();
        }
      } catch (error) {
        console.error('Failed to auto-trigger image picker:', error);
      }
    };

    autoTrigger();
  }, [isActive, selectedTool, toolId, stageRef, triggerFilePicker, autoPlaceImage]);

  // Cleanup effect for when tool is deactivated
  useEffect(() => {
    const active = isActive && selectedTool === toolId;
    if (active) return;

    // Clean up any preview elements when tool is deactivated
    const stage = stageRef.current;
    if (!stage) return;

    const layers = stage.getLayers();
    const previewLayer = layers[layers.length - 2] as Konva.Layer | undefined;
    if (!previewLayer) return;

    const ghost = stateRef.current.preview;
    if (ghost) {
      try {
        ghost.destroy();
      } catch {}
      stateRef.current.preview = null;
      previewLayer.batchDraw();
    }
    stateRef.current.start = null;
  }, [isActive, selectedTool, toolId, stageRef]);

  return null;
};

export default ImageTool;