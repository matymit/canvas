// features/canvas/components/tools/selection/StageSelectionHandler.tsx
import type React from 'react';
import { useEffect } from 'react';
import type Konva from 'konva';
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';

export interface StageSelectionHandlerProps {
  stageRef: React.RefObject<Konva.Stage | null>;
}

interface SelectionModuleLike {
  clearSelection?: () => void;
  selectElement?: (elementId: string, options?: Record<string, unknown>) => void;
  toggleSelection?: (elementId: string, additive?: boolean) => void;
  [key: string]: unknown;
}

// Get reference to SelectionModule for consistent selection behavior
function getSelectionModule(): SelectionModuleLike | undefined {
  return (window as Window & { selectionModule?: SelectionModuleLike }).selectionModule;
}

const StageSelectionHandler: React.FC<StageSelectionHandlerProps> = ({ stageRef }) => {
  const selectedTool = useUnifiedCanvasStore((state) => state.ui?.selectedTool);
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const selectedElementIds = useUnifiedCanvasStore((state) => state.selectedElementIds);
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const clearSelection = useUnifiedCanvasStore((state) => state.clearSelection);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;


    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      
      // If clicking empty stage (background), clear selection
      if (e.target === stage) {
        
        const selectionModule = getSelectionModule();
        if (selectionModule?.clearSelection) {
          selectionModule.clearSelection();
        } else if (clearSelection) {
          clearSelection();
        }
        return;
      }

      // Only handle element selection when in select mode or when tools auto-switch to select
      if (selectedTool !== 'select') return;

      // Handle element selection
      const clickedNode = e.target;
      const elementId = clickedNode.getAttr('elementId') || clickedNode.id();
      
      
      if (elementId && elements.has(elementId)) {
        const selectionModule = getSelectionModule();
        
        if (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey) {
          // Additive selection with Ctrl/Cmd/Shift
          
          if (selectionModule) {
            // Use SelectionModule for consistency
            if (selectedElementIds.has(elementId)) {
              // Remove from selection (toggle off)
              const newSelection = new Set(selectedElementIds);
              newSelection.delete(elementId);
              if (setSelection) setSelection(Array.from(newSelection));
            } else {
              // Add to selection
              const newSelection = new Set(selectedElementIds);
              newSelection.add(elementId);
              if (setSelection) setSelection(Array.from(newSelection));
            }
          }
        } else {
          // Single selection
          
          if (selectionModule?.selectElement) {
            selectionModule.selectElement?.(elementId);
          } else if (setSelection) {
            setSelection([elementId]);
          }
        }
      }
    };

    // Register stage click handler with high priority
    stage.on('click.stage-selection', handleStageClick);

    return () => {
      stage.off('click.stage-selection');
    };
  }, [stageRef, selectedTool, elements, selectedElementIds, setSelection, clearSelection]);

  return null;
};

export default StageSelectionHandler;
