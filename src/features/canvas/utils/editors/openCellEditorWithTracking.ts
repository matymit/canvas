// Opens a DOM overlay editor for editing table cells
// FIXED: Uses proper Konva coordinate transformation with stage.getAbsoluteTransform().point()
// Handles world-to-screen coordinate conversion and live updates during pan/zoom operations

import Konva from 'konva';

type CellEditorOpts = {
  stage: Konva.Stage;
  elementId: string;
  element: any; // TableElement
  row: number;
  col: number;
  onCommit?: (text: string, elementId: string, row: number, col: number) => void;
};

export function openCellEditorWithTracking({
  stage,
  elementId,
  element,
  row,
  col,
  onCommit
}: CellEditorOpts) {
  const container = stage.container();

  // Find the table group to get positioning
  const tableGroup = stage.findOne(`#${elementId}`) as Konva.Group;
  if (!tableGroup) {
    console.error('[openCellEditorWithTracking] Could not find table group with ID:', elementId);
    return;
  }

  // Calculate cell position within the table
  let cellX = 0;
  let cellY = 0;

  // Sum up column widths to get cell x position
  for (let c = 0; c < col; c++) {
    cellX += element.colWidths[c] || 0;
  }

  // Sum up row heights to get cell y position
  for (let r = 0; r < row; r++) {
    cellY += element.rowHeights[r] || 0;
  }

  const cellWidth = element.colWidths[col] || 100;
  const cellHeight = element.rowHeights[row] || 30;

  // Create the editor element
  const editor = document.createElement('textarea');
  editor.style.position = 'absolute';
  editor.style.zIndex = '1000';
  editor.style.border = 'none';
  editor.style.outline = 'none';
  editor.style.background = element.style?.cellFill || '#FFFFFF';
  editor.style.color = element.style?.textColor || '#374151';
  editor.style.fontFamily = element.style?.fontFamily || 'Inter, system-ui, sans-serif';
  editor.style.fontSize = `${element.style?.fontSize || 14}px`;
  editor.style.lineHeight = '1.4';
  editor.style.padding = `${element.style?.paddingY || 4}px ${element.style?.paddingX || 8}px`;
  editor.style.margin = '0';
  editor.style.resize = 'none';
  editor.style.overflow = 'hidden';
  editor.style.whiteSpace = 'pre-wrap';
  editor.style.wordWrap = 'break-word';
  editor.style.borderRadius = `${element.style?.cornerRadius || 0}px`;
  // FIXED: Proper multi-line text flow with center start position
  editor.style.textAlign = 'center';
  editor.style.lineHeight = 'normal';                    // Allow natural line spacing for multi-line
  editor.style.display = 'block';
  editor.style.boxSizing = 'border-box';

  // Center the initial cursor position using padding
  const normalLineHeight = 20; // Approximate single line height
  const verticalPadding = Math.max(4, (cellHeight - normalLineHeight) / 2);
  editor.style.paddingTop = `${verticalPadding}px`;
  editor.style.paddingBottom = `${verticalPadding}px`;

  // Override the previous padding setting to use calculated values
  editor.style.padding = `${verticalPadding}px ${element.style?.paddingX || 8}px`;

  // Get current cell text
  const cellIndex = row * element.cols + col;
  const currentText = element.cells?.[cellIndex]?.text || '';
  editor.value = currentText;

  container.appendChild(editor);

  function placeEditor() {
    if (!tableGroup) return;

    // CRITICAL FIX: Use proper Konva coordinate transformation
    const tablePos = tableGroup.getAbsolutePosition();

    // Calculate world coordinates of the cell (relative to stage)
    const cellWorldX = tablePos.x + cellX;
    const cellWorldY = tablePos.y + cellY;

    // FIXED: Use stage.getAbsoluteTransform().point() for proper coordinate transformation
    const stageTransform = stage.getAbsoluteTransform();
    const screenPoint = stageTransform.point({ x: cellWorldX, y: cellWorldY });

    // FIXED: Get container rect offset for accurate screen positioning
    const containerRect = container.getBoundingClientRect();
    const screenX = containerRect.left + screenPoint.x;
    const screenY = containerRect.top + screenPoint.y;

    // Apply scale to cell dimensions
    const scale = stage.scaleX();
    const scaledWidth = cellWidth * scale - (element.style?.paddingX || 8) * 2;
    const scaledHeight = cellHeight * scale - (element.style?.paddingY || 4) * 2;

    editor.style.left = `${screenX + (element.style?.paddingX || 8) * scale}px`;
    editor.style.top = `${screenY + (element.style?.paddingY || 4) * scale}px`;
    editor.style.width = `${Math.max(50, scaledWidth)}px`;
    editor.style.height = `${Math.max(20, scaledHeight)}px`;
    editor.style.transform = `scale(${scale})`;
    editor.style.transformOrigin = '0 0';
  }

  placeEditor();

  // Listen for stage transform changes to keep editor positioned correctly
  const sync = () => placeEditor();
  stage.on('dragmove.cell-editor wheel.cell-editor', sync);
  stage.on('xChange.cell-editor yChange.cell-editor scaleXChange.cell-editor scaleYChange.cell-editor', sync);

  // Also listen for table group transforms (resizing)
  tableGroup.on('transform.cell-editor', sync);

  const finish = (commit: boolean) => {
    const value = editor.value;
    cleanup();
    if (commit && onCommit) {
      onCommit(value, elementId, row, col);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    console.log('[openCellEditorWithTracking] Key pressed:', e.key, 'shiftKey:', e.shiftKey);

    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('[openCellEditorWithTracking] Enter pressed, calling finish(true)');
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      console.log('[openCellEditorWithTracking] Escape pressed, calling finish(false)');
      e.preventDefault();
      finish(false);
    }
    e.stopPropagation(); // Prevent canvas shortcuts
  };

  const onBlur = () => finish(true);

  editor.addEventListener('keydown', onKey);
  editor.addEventListener('blur', onBlur, { once: true });

  // Focus and select all text
  editor.focus();
  if (currentText) {
    editor.select();
  }

  function cleanup() {
    editor.removeEventListener('keydown', onKey);
    editor.removeEventListener('blur', onBlur);
    stage.off('dragmove.cell-editor');
    stage.off('wheel.cell-editor');
    stage.off('xChange.cell-editor yChange.cell-editor scaleXChange.cell-editor scaleYChange.cell-editor');
    tableGroup?.off('transform.cell-editor');
    editor.remove();
  }

  return { editor, cleanup };
}

// Make it available globally for TableModule
if (typeof window !== 'undefined') {
  (window as any).openCellEditorWithTracking = (
    stage: Konva.Stage,
    elementId: string,
    element: any,
    row: number,
    col: number
  ) => {
    console.log('[openCellEditorWithTracking] Starting editor for cell:', row, col);

    return openCellEditorWithTracking({
      stage,
      elementId,
      element,
      row,
      col,
      onCommit: (text: string, elementId: string, row: number, col: number) => {
        console.log('[openCellEditorWithTracking] onCommit called with text:', text);

        // FIXED: Use consistent store access
        let store = (window as any).__canvasStore;

        // Fallback to import if global not available
        if (!store) {
          try {
            const { useUnifiedCanvasStore } = require('../../../stores/unifiedCanvasStore');
            store = useUnifiedCanvasStore.getState();
            console.log('[openCellEditorWithTracking] Using imported store');
          } catch (e) {
            console.error('[openCellEditorWithTracking] Could not access store:', e);
            return;
          }
        }

        // Debug store structure
        console.log('[DEBUG] Store object:', store);
        console.log('[DEBUG] Store keys:', Object.keys(store || {}));
        console.log('[DEBUG] store.element:', store.element);
        console.log('[DEBUG] store.element type:', typeof store.element);
        console.log('[DEBUG] store.element methods:', store.element ? Object.keys(store.element) : 'N/A');
        console.log('[DEBUG] store.element.getElement:', typeof store.element?.getElement);
        console.log('[DEBUG] store.element.updateElement:', typeof store.element?.updateElement);

        // Try different access patterns
        if (store.elements) {
          console.log('[DEBUG] store.elements.get method exists:', typeof store.elements.get);
          console.log('[DEBUG] store.elements size/length:', store.elements.size || store.elements.length);

          // Try different ways to access
          if (store.elements.get) {
            console.log('[DEBUG] store.elements.get(elementId):', store.elements.get(elementId));
          }
          if (store.elements[elementId]) {
            console.log('[DEBUG] store.elements[elementId]:', store.elements[elementId]);
          }
        }

        // Check other possible element storage locations
        console.log('[DEBUG] store.element:', store.element);
        console.log('[DEBUG] store.getElement:', typeof store.getElement);
        console.log('[DEBUG] store.getState:', typeof store.getState);

        if (store.getState) {
          const state = store.getState();
          console.log('[DEBUG] state.elements:', state.elements);
          console.log('[DEBUG] state.getElement:', typeof state.getElement);
          console.log('[DEBUG] state.element:', state.element);
        }

        // FIXED: Get fresh element data from store using correct access pattern
        let currentElement;

        // Try the correct access pattern first
        if (store.element?.getElement) {
          console.log('[DEBUG] Trying store.element.getElement() - CORRECT METHOD');
          currentElement = store.element.getElement(elementId);
        } else if (store.getElement) {
          console.log('[DEBUG] Trying store.getElement()');
          currentElement = store.getElement(elementId);
        } else if (store.element?.getById) {
          console.log('[DEBUG] Trying store.element.getById()');
          currentElement = store.element.getById(elementId);
        } else if (store.getState) {
          console.log('[DEBUG] Trying store.getState().getElement()');
          const state = store.getState();
          if (state.getElement) {
            currentElement = state.getElement(elementId);
          } else if (state.element?.getById) {
            currentElement = state.element.getById(elementId);
          } else if (state.elements?.get) {
            currentElement = state.elements.get(elementId);
          }
        } else if (store.elements?.get) {
          console.log('[DEBUG] Trying store.elements.get()');
          currentElement = store.elements.get(elementId);
        }

        console.log('[DEBUG] Final currentElement:', currentElement);

        if (!currentElement) {
          console.error('[openCellEditorWithTracking] Element not found in store:', elementId);
          console.error('[openCellEditorWithTracking] Available access methods tried: getElement, element.getById, elements.get');
          return;
        }

        console.log('[openCellEditorWithTracking] Current element:', currentElement);

        // Update cell in the fresh element data
        const cellIndex = row * currentElement.cols + col;
        const newCells = [...(currentElement.cells || [])];

        // Ensure cell object exists
        while (newCells.length <= cellIndex) {
          newCells.push({ text: '' });
        }

        const oldText = newCells[cellIndex]?.text || '';
        newCells[cellIndex] = { text: text };

        console.log(`[openCellEditorWithTracking] Updating cell [${row},${col}] from "${oldText}" to "${text}"`);

        // FIXED: Use consistent store update method with debugging
        const updateFn = () => {
          console.log('[DEBUG] Available update methods:');
          console.log('[DEBUG] store.element?.updateElement:', typeof store.element?.updateElement);
          console.log('[DEBUG] store.updateElement:', typeof store.updateElement);
          console.log('[DEBUG] store.element?.update:', typeof store.element?.update);

          if (store.getState) {
            const state = store.getState();
            console.log('[DEBUG] state.updateElement:', typeof state.updateElement);
            console.log('[DEBUG] state.element?.update:', typeof state.element?.update);
          }

          // Try various update methods - correct method first
          if (store.element?.updateElement) {
            console.log('[DEBUG] Using store.element.updateElement - CORRECT METHOD');
            store.element.updateElement(elementId, { cells: newCells });
            console.log('[openCellEditorWithTracking] Called store.element.updateElement');
          } else if (store.updateElement) {
            console.log('[DEBUG] Using store.updateElement');
            store.updateElement(elementId, { cells: newCells });
            console.log('[openCellEditorWithTracking] Called store.updateElement');
          } else if (store.element?.update) {
            console.log('[DEBUG] Using store.element.update');
            store.element.update(elementId, { cells: newCells });
            console.log('[openCellEditorWithTracking] Called store.element.update');
          } else if (store.getState) {
            const state = store.getState();
            if (state.updateElement) {
              console.log('[DEBUG] Using state.updateElement');
              state.updateElement(elementId, { cells: newCells });
              console.log('[openCellEditorWithTracking] Called state.updateElement');
            } else if (state.element?.update) {
              console.log('[DEBUG] Using state.element.update');
              state.element.update(elementId, { cells: newCells });
              console.log('[openCellEditorWithTracking] Called state.element.update');
            } else {
              console.error('[openCellEditorWithTracking] No update method found on state');
              return;
            }
          } else {
            console.error('[openCellEditorWithTracking] No update method found on store');
            return;
          }
        };

        // Handle undo/redo with debugging
        console.log('[DEBUG] Available undo methods:');
        console.log('[DEBUG] store.withUndo:', typeof store.withUndo);
        console.log('[DEBUG] store.history?.withUndo:', typeof store.history?.withUndo);

        if (store.getState) {
          const state = store.getState();
          console.log('[DEBUG] state.withUndo:', typeof state.withUndo);
          console.log('[DEBUG] state.history?.withUndo:', typeof state.history?.withUndo);
        }

        // Try various undo methods
        if (store.withUndo) {
          console.log('[DEBUG] Using store.withUndo wrapper');
          store.withUndo(`Edit cell (${row},${col})`, updateFn);
        } else if (store.history?.withUndo) {
          console.log('[DEBUG] Using store.history.withUndo wrapper');
          store.history.withUndo(`Edit cell (${row},${col})`, updateFn);
        } else if (store.getState) {
          const state = store.getState();
          if (state.withUndo) {
            console.log('[DEBUG] Using state.withUndo wrapper');
            state.withUndo(`Edit cell (${row},${col})`, updateFn);
          } else if (state.history?.withUndo) {
            console.log('[DEBUG] Using state.history.withUndo wrapper');
            state.history.withUndo(`Edit cell (${row},${col})`, updateFn);
          } else {
            console.log('[DEBUG] Direct update (no undo found on state)');
            updateFn();
          }
        } else {
          console.log('[DEBUG] Direct update (no undo methods available)');
          updateFn();
        }

        console.log('[openCellEditorWithTracking] onCommit completed');
      }
    });
  };
}