// Opens a DOM overlay editor for editing table cells
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

  // Get current cell text
  const cellIndex = row * element.cols + col;
  const currentText = element.cells?.[cellIndex]?.text || '';
  editor.value = currentText;

  container.appendChild(editor);

  function placeEditor() {
    if (!tableGroup) return;

    const tablePos = tableGroup.getAbsolutePosition();
    const stagePos = stage.position();
    const scaleX = stage.scaleX();
    const scaleY = stage.scaleY();

    // Calculate screen position of the cell
    const screenX = (tablePos.x + cellX) * scaleX + stagePos.x;
    const screenY = (tablePos.y + cellY) * scaleY + stagePos.y;
    const scaledWidth = cellWidth * scaleX - (element.style?.paddingX || 8) * 2;
    const scaledHeight = cellHeight * scaleY - (element.style?.paddingY || 4) * 2;

    editor.style.left = `${screenX + (element.style?.paddingX || 8) * scaleX}px`;
    editor.style.top = `${screenY + (element.style?.paddingY || 4) * scaleY}px`;
    editor.style.width = `${Math.max(50, scaledWidth)}px`;
    editor.style.height = `${Math.max(20, scaledHeight)}px`;
    editor.style.transform = `scale(${Math.min(scaleX, scaleY)})`;
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
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
    return openCellEditorWithTracking({
      stage,
      elementId,
      element,
      row,
      col,
      onCommit: (text: string, elementId: string, row: number, col: number) => {
        // Get store from global context or window
        const store = (window as any).__canvasStore;
        if (store?.element?.update || store?.updateElement) {
          const updateElement = store.element?.update || store.updateElement;
          const withUndo = store.history?.withUndo || store.withUndo;

          const cellIndex = row * element.cols + col;
          const newCells = [...(element.cells || [])];

          // Ensure cell object exists
          if (!newCells[cellIndex]) {
            newCells[cellIndex] = { text: '' };
          }

          newCells[cellIndex].text = text;

          const updateFn = () => {
            updateElement(elementId, { cells: newCells });
          };

          if (withUndo) {
            withUndo('Edit table cell', updateFn);
          } else {
            updateFn();
          }
        }
      }
    });
  };
}