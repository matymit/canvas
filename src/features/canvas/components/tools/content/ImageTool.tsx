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
          console.log('[ImageTool] Image loaded successfully:', {
            naturalWidth,
            naturalHeight,
            dataUrl: dataUrl.substring(0, 50) + '...'
          });
          resolve();
        } catch (error) {
          console.error('[ImageTool] Failed to load image:', error);
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

  // Define setElementSelection utility function
  const setElementSelection = useCallback((id: string) => {
    const store = useUnifiedCanvasStore.getState();
    if (store.setSelection) {
      store.setSelection([id]);
    }
  }, []);

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

    console.log('[ImageTool.commitImage] Creating element:', {
      id,
      position: { x, y },
      size: { width: w, height: h },
      natural: nat,
    });

    // Store integration with better error handling
    const store = useUnifiedCanvasStore.getState();

    try {
      // Use withUndo for proper history integration
      store.withUndo('Add image', () => {
        if (store.addElement) {
          store.addElement(element, { select: true, pushHistory: false });
        } else if (store.element?.upsert) {
          store.element.upsert(element);
        } else {
          console.error('[ImageTool] No element creation method available');
          return;
        }
      });

      console.log('[ImageTool.commitImage] Element added to store:', {
        id,
        hasElement: store.elements?.has(id),
        elementsCount: store.elements?.size,
      });

      // Wait for rendering with improved timing
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Delayed selection with better timing
      setTimeout(() => {
        console.log('[ImageTool.commitImage] Attempting selection:', id);
        setElementSelection(id);

        // Switch to select tool for immediate manipulation
        setTimeout(() => {
          setSelectedTool?.('select');
        }, 100);
      }, 200);

    } catch (error) {
      console.error('[ImageTool.commitImage] Error creating element:', error);
    }

    // Reset image data for next use
    stateRef.current.dataUrl = null;
    stateRef.current.natural = null;
  }, [setSelectedTool, setElementSelection]);

  // Auto-place image at center of viewport
  const autoPlaceImage = useCallback(async () => {
    if (!stateRef.current.dataUrl || !stateRef.current.natural || !stageRef.current) {
      console.log('[ImageTool.autoPlaceImage] Missing requirements:', {
        hasDataUrl: !!stateRef.current.dataUrl,
        hasNatural: !!stateRef.current.natural,
        hasStage: !!stageRef.current,
      });
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

    console.log('[ImageTool.autoPlaceImage] Placing image:', {
      stageCenter: { x: centerX, y: centerY },
      worldCenter: { x: worldX, y: worldY },
      finalPosition: { x, y },
      size: { width, height },
      natural: nat,
    });

    // Commit the image and wait for completion
    await commitImage(x, y, width, height);
  }, [stageRef, viewport, commitImage]);

  // Auto-trigger file picker when image tool becomes active
  useEffect(() => {
    const active = isActive && selectedTool === toolId;
    if (!active || hasTriggeredPickerRef.current) return;

    console.log('[ImageTool] Auto-triggering file picker');

    // Trigger file picker immediately when tool is selected
    const autoTrigger = async () => {
      try {
        await triggerFilePicker();
        // If image was loaded successfully, place it automatically
        if (stateRef.current.dataUrl && stageRef.current) {
          await autoPlaceImage();
        }
      } catch (error) {
        console.error('[ImageTool] Failed to auto-trigger image picker:', error);
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
      } catch (error) {
        // Ignore cleanup errors
        console.debug('[ImageTool] Ghost cleanup error:', error);
      }
      stateRef.current.preview = null;
      previewLayer.batchDraw();
    }
    stateRef.current.start = null;
  }, [isActive, selectedTool, toolId, stageRef]);

  return null;
};

export default ImageTool;