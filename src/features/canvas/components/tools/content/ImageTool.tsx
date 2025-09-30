// Image tool component with streamlined auto-placement workflow
import type React from "react";
import { useEffect, useRef, useCallback } from "react";
import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { loadImageFromFile } from "../../../utils/image/ImageLoader";
import {
  compressBase64,
  saveImageToIndexedDB,
} from "../../../../../utils/imageStorage";
import { debug } from "../../../../../utils/debug";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface ImageToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'image'
}

export const ImageTool: React.FC<ImageToolProps> = ({
  isActive,
  stageRef,
  toolId = "image",
}) => {
  const selectedTool = useUnifiedCanvasStore(
    (s): string | null | undefined => s.ui?.selectedTool,
  );
  const setSelectedTool = useUnifiedCanvasStore(
    (s): ((tool: string) => void) | undefined => s.ui?.setSelectedTool,
  );
  const viewport = useUnifiedCanvasStore((s) => s.viewport);

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
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";

      const onChange = async () => {
        try {
          const files = input.files;
          if (!files || files.length === 0) {
            // User cancelled - switch back to select tool
            setSelectedTool?.("select");
            resolve();
            return;
          }

          // Load the image
          const { dataUrl, naturalWidth, naturalHeight } =
            await loadImageFromFile(files[0]);

          // Compress the image before storing
          debug("[ImageTool] Compressing image...", { category: "ImageTool" });
          const compressedDataUrl = await compressBase64(dataUrl);

          stateRef.current.dataUrl = compressedDataUrl;
          stateRef.current.natural = { w: naturalWidth, h: naturalHeight };

          // Image loaded successfully, ready for auto-placement
          resolve();
        } catch (error) {
          debug("[ImageTool] Failed to load/compress image:", {
            category: "ImageTool",
            data: error,
          });
          // Failed to load image
          setSelectedTool?.("select");
          reject(error);
        } finally {
          // Cleanup
          if (input.parentElement) {
            input.parentElement.removeChild(input);
          }
        }
      };

      input.addEventListener("change", onChange, { once: true });
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
  const commitImage = useCallback(
    async (x: number, y: number, w: number, h: number) => {
      const nat = stateRef.current.natural;
      const src = stateRef.current.dataUrl;

      if (!nat || !src) {
        // Missing required image data
        return;
      }

      const id =
        crypto?.randomUUID?.() ||
        `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Save compressed image to IndexedDB
      const idbKey = `img_${id}`;
      try {
        await saveImageToIndexedDB(src, idbKey);
        debug(`[ImageTool] Image saved to IndexedDB: ${idbKey}`, {
          category: "ImageTool",
        });
      } catch (error) {
        debug("[ImageTool] Failed to save to IndexedDB:", {
          category: "ImageTool",
          data: error,
        });
        // Continue anyway - image will work in current session
      }

      const element = {
        id,
        type: "image" as const,
        x,
        y,
        width: w,
        height: h,
        src, // Keep in memory for current session
        idbKey, // Reference for persistence
        naturalWidth: nat.w,
        naturalHeight: nat.h,
        keepAspectRatio: true,
      };

      // Creating image element

      // Store integration with better error handling
      const store = useUnifiedCanvasStore.getState();

      try {
        // Use withUndo for proper history integration
        store.withUndo("Add image", () => {
          if (store.addElement) {
            store.addElement(element, { select: true, pushHistory: false });
          } else if (store.element?.upsert) {
            store.element.upsert(element);
          } else {
            // No element creation method available
            return;
          }
        });

        // Element added to store

        // Wait for multiple animation frames to ensure rendering completes
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Select the image immediately after rendering
        setElementSelection(id);

        // Small delay before switching to select tool to allow selection to take effect
        await new Promise((resolve) => setTimeout(resolve, 50));
        setSelectedTool?.("select");
      } catch (error) {
        debug("[ImageTool] Error creating element:", {
          category: "ImageTool",
          data: error,
        });
      }

      // Reset image data for next use
      stateRef.current.dataUrl = null;
      stateRef.current.natural = null;
    },
    [setSelectedTool, setElementSelection],
  );

  // Auto-place image at center of viewport
  const autoPlaceImage = useCallback(async () => {
    if (
      !stateRef.current.dataUrl ||
      !stateRef.current.natural ||
      !stageRef.current
    ) {
      // Missing requirements for auto-placement
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

    // Placing image at calculated position

    // Commit the image and wait for completion
    await commitImage(x, y, width, height);
  }, [stageRef, viewport, commitImage]);

  // Auto-trigger file picker when image tool becomes active
  useEffect(() => {
    const active = isActive && selectedTool === toolId;
    if (!active || hasTriggeredPickerRef.current) return;

    // Auto-triggering file picker

    // Trigger file picker immediately when tool is selected
    const autoTrigger = async () => {
      try {
        await triggerFilePicker();
        // If image was loaded successfully, place it automatically
        if (stateRef.current.dataUrl && stageRef.current) {
          await autoPlaceImage();
        }
      } catch (error) {
        // Failed to auto-trigger image picker
      }
    };

    autoTrigger();
  }, [
    isActive,
    selectedTool,
    toolId,
    stageRef,
    triggerFilePicker,
    autoPlaceImage,
  ]);

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
        // Ghost cleanup error
      }
      stateRef.current.preview = null;
      previewLayer.batchDraw();
    }
    stateRef.current.start = null;
  }, [isActive, selectedTool, toolId, stageRef]);

  return null;
};

export default ImageTool;
