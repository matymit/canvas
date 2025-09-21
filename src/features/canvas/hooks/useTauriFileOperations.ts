// features/canvas/hooks/useTauriFileOperations.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import TauriFileService from "../services/TauriFileService";

export interface UseTauriFileOperationsResult {
  // File operations
  saveCanvas: () => Promise<string | null>;
  loadCanvas: () => Promise<boolean>;
  exportAsImage: (stageElement?: HTMLElement) => Promise<string | null>;

  // Auto-save
  enableAutoSave: (intervalMs?: number) => void;
  disableAutoSave: () => void;
  isAutoSaveEnabled: boolean;
  lastAutoSave: Date | null;

  // File state
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;

  // History-aware operations
  saveWithHistory: (description?: string) => Promise<string | null>;
  loadWithHistory: (description?: string) => Promise<boolean>;
}

export function useTauriFileOperations(): UseTauriFileOperationsResult {
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);

  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>("");

  // Get store methods and state
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const elementOrder = useUnifiedCanvasStore((state) => state.elementOrder);
  const viewport = useUnifiedCanvasStore((state) => state.viewport);
  const replaceAll = useUnifiedCanvasStore((state) => state.replaceAll);
  const beginBatch = useUnifiedCanvasStore((state) => state.beginBatch);
  const endBatch = useUnifiedCanvasStore((state) => state.endBatch);

  // Track changes to detect unsaved state
  useEffect(() => {
    const currentState = JSON.stringify({
      elements: Array.from(elements.entries()),
      elementOrder,
      viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
    });

    if (
      lastSavedStateRef.current &&
      currentState !== lastSavedStateRef.current
    ) {
      setHasUnsavedChanges(true);
    }
  }, [elements, elementOrder, viewport.x, viewport.y, viewport.scale]);

  /**
   * Save canvas to file
   */
  const saveCanvas = useCallback(async (): Promise<string | null> => {
    try {
      const filePath = await TauriFileService.saveCanvasToFile(
        elements,
        elementOrder,
        viewport,
        currentFilePath || undefined,
      );

      if (filePath) {
        setCurrentFilePath(filePath);
        setHasUnsavedChanges(false);

        // Update last saved state
        lastSavedStateRef.current = JSON.stringify({
          elements: Array.from(elements.entries()),
          elementOrder,
          viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
        });
      }

      return filePath;
    } catch (error) {
      // Error: Save failed
      return null;
    }
  }, [elements, elementOrder, viewport, currentFilePath]);

  /**
   * Load canvas from file
   */
  const loadCanvas = useCallback(async (): Promise<boolean> => {
    try {
      const result = await TauriFileService.loadCanvasFromFile();

      if (!result) return false;

      // Replace all elements
      const elementsArray = Array.from(result.elements.values());
      replaceAll(elementsArray, result.elementOrder);

      // Update viewport if provided
      if (result.viewport) {
        const setViewport = useUnifiedCanvasStore.getState().viewport;
        if (
          result.viewport.x !== undefined &&
          result.viewport.y !== undefined
        ) {
          setViewport.setPan(result.viewport.x, result.viewport.y);
        }
        if (result.viewport.scale !== undefined) {
          setViewport.setScale(result.viewport.scale);
        }
      }

      setCurrentFilePath(result.filePath);
      setHasUnsavedChanges(false);

      // Update last saved state
      lastSavedStateRef.current = JSON.stringify({
        elements: Array.from(result.elements.entries()),
        elementOrder: result.elementOrder,
        viewport: result.viewport,
      });

      return true;
    } catch (error) {
      // Error: Load failed
      return false;
    }
  }, [replaceAll]);

  /**
   * Save with history tracking
   */
  const saveWithHistory = useCallback(
    async (description?: string): Promise<string | null> => {
      beginBatch(description || "Save canvas");
      const filePath = await saveCanvas();
      endBatch(true);
      return filePath;
    },
    [beginBatch, endBatch, saveCanvas],
  );

  /**
   * Load with history tracking
   */
  const loadWithHistory = useCallback(
    async (description?: string): Promise<boolean> => {
      beginBatch(description || "Load canvas");
      const success = await loadCanvas();
      endBatch(true);
      return success;
    },
    [beginBatch, endBatch, loadCanvas],
  );

  /**
   * Export canvas as image
   */
  const exportAsImage = useCallback(
    async (stageElement?: HTMLElement): Promise<string | null> => {
      try {
        // Find stage element if not provided
        const stage =
          stageElement ||
          (document.querySelector(".konvajs-content") as HTMLElement);

        if (!stage) {
          // Error: Stage element not found
          return null;
        }

        const filePath = await TauriFileService.exportCanvasAsImage(stage);
        return filePath;
      } catch (error) {
        // Error: Export failed
        return null;
      }
    },
    [],
  );

  /**
   * Auto-save functionality
   */
  const performAutoSave = useCallback(async () => {
    try {
      const path = await TauriFileService.autoSaveCanvas(
        elements,
        elementOrder,
        viewport,
      );
      if (path) {
        setLastAutoSave(new Date());
      }
    } catch (error) {
      // Error: Auto-save failed
    }
  }, [elements, elementOrder, viewport]);

  /**
   * Enable auto-save
   */
  const enableAutoSave = useCallback(
    (intervalMs: number = 60000) => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }

      setIsAutoSaveEnabled(true);
      autoSaveIntervalRef.current = setInterval(performAutoSave, intervalMs);

      // Perform initial auto-save
      performAutoSave();
    },
    [performAutoSave],
  );

  /**
   * Disable auto-save
   */
  const disableAutoSave = useCallback(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    setIsAutoSaveEnabled(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, []);

  // Load auto-save on mount if available
  useEffect(() => {
    const loadAutoSave = async () => {
      try {
        const autoSaveData = await TauriFileService.loadAutoSave();
        if (autoSaveData && autoSaveData.elements.size > 0) {
          // Only load auto-save if canvas is empty
          const currentElements = useUnifiedCanvasStore.getState().elements;
          if (currentElements.size === 0) {
            const elementsArray = Array.from(autoSaveData.elements.values());
            replaceAll(elementsArray, autoSaveData.elementOrder);

            if (autoSaveData.viewport) {
              const setViewport = useUnifiedCanvasStore.getState().viewport;
              if (
                autoSaveData.viewport.x !== undefined &&
                autoSaveData.viewport.y !== undefined
              ) {
                setViewport.setPan(
                  autoSaveData.viewport.x,
                  autoSaveData.viewport.y,
                );
              }
              if (autoSaveData.viewport.scale !== undefined) {
                setViewport.setScale(autoSaveData.viewport.scale);
              }
            }

            // Auto-save restored
          }
        }
      } catch (error) {
        // Error: Failed to load auto-save
      }
    };

    loadAutoSave();
  }, [replaceAll]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        await saveWithHistory("Save canvas (Ctrl+S)");
      }

      // Ctrl/Cmd + O: Open
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        await loadWithHistory("Load canvas (Ctrl+O)");
      }

      // Ctrl/Cmd + Shift + S: Save As
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setCurrentFilePath(null); // Force save as dialog
        await saveWithHistory("Save as (Ctrl+Shift+S)");
      }

      // Ctrl/Cmd + E: Export as image
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        await exportAsImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveWithHistory, loadWithHistory, exportAsImage]);

  return {
    saveCanvas,
    loadCanvas,
    exportAsImage,
    enableAutoSave,
    disableAutoSave,
    isAutoSaveEnabled,
    lastAutoSave,
    currentFilePath,
    hasUnsavedChanges,
    saveWithHistory,
    loadWithHistory,
  };
}
