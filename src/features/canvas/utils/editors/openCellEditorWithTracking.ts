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

