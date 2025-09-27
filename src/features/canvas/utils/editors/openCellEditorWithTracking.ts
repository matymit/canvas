// Opens a DOM overlay editor for editing table cells
// FIXED: Uses proper Konva coordinate transformation with stage.getAbsoluteTransform().point()
// Handles world-to-screen coordinate conversion and live updates during pan/zoom operations

import type Konva from 'konva';

const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
import type { TableElement } from '../../types/table';

type CellEditorOpts = {
  stage: Konva.Stage;
  elementId: string;
  element: TableElement;
  row: number;
  col: number;
  onCommit?: (text: string, elementId: string, row: number, col: number) => void;
  onSizeChange?: (
    payload: {
      elementId: string;
      row: number;
      col: number;
      requiredWidth: number;
      requiredHeight: number;
    }
  ) => void;
  getElement?: () => TableElement;
};

export function openCellEditorWithTracking({
  stage,
  elementId,
  element,
  row,
  col,
  onCommit,
  onSizeChange,
  getElement
}: CellEditorOpts) {
  // Find the table group to get positioning
  const tableGroup = stage.findOne(`#${elementId}`) as Konva.Group;
  if (!tableGroup) {
    // Error: Could not find table group with ID
    return;
  }

  const resolveElement = () => {
    try {
      const latest = getElement?.();
      return latest ?? element;
    } catch (error) {
      // Warning: Failed to resolve latest element, using snapshot
      return element;
    }
  };

  let snapshot = resolveElement();
  let paddingX = snapshot.style?.paddingX || 8;
  let paddingY = snapshot.style?.paddingY || 4;

  const refreshSnapshot = () => {
    const updated = resolveElement();
    if (updated) {
      snapshot = updated;
      paddingX = snapshot.style?.paddingX || 8;
      paddingY = snapshot.style?.paddingY || 4;
    }
    return snapshot;
  };

  const computeCellMetrics = () => {
    const current = refreshSnapshot();
    let cellX = 0;
    let cellY = 0;

    for (let c = 0; c < col; c++) {
      cellX += current.colWidths[c] || 0;
    }

    for (let r = 0; r < row; r++) {
      cellY += current.rowHeights[r] || 0;
    }

    return {
      cellX,
      cellY,
      cellWidth: current.colWidths[col] || 100,
      cellHeight: current.rowHeights[row] || 30,
    };
  };

  let { cellX, cellY, cellWidth, cellHeight } = computeCellMetrics();

  // Create the editor element
  const editor = document.createElement('textarea');
  editor.style.position = 'absolute';
  editor.style.zIndex = '1000';
  editor.style.border = 'none';
  editor.style.outline = 'none';
  editor.style.background = snapshot.style?.cellFill || '#FFFFFF';
  editor.style.color = snapshot.style?.textColor || '#374151';
  editor.style.fontFamily = snapshot.style?.fontFamily || 'Inter, system-ui, sans-serif';
  editor.style.fontSize = `${snapshot.style?.fontSize || 14}px`;
  editor.style.lineHeight = '1.4';
  editor.style.padding = `${paddingY}px ${paddingX}px`;
  editor.style.margin = '0';
  editor.style.resize = 'none';
  editor.style.overflow = 'hidden';
  editor.style.whiteSpace = 'pre-wrap';
  editor.style.wordWrap = 'break-word';
  editor.style.borderRadius = `${snapshot.style?.cornerRadius || 0}px`;
  // FIXED: Proper multi-line text flow with center start position
  editor.style.textAlign = 'center';
  editor.style.lineHeight = 'normal';                    // Allow natural line spacing for multi-line
  editor.style.display = 'block';
  editor.style.boxSizing = 'border-box';

  // Center the initial cursor position using padding
  editor.style.paddingTop = `${paddingY}px`;
  editor.style.paddingBottom = `${paddingY}px`;

  // Get current cell text
  const initialCellIndex = row * snapshot.cols + col;
  const currentText = snapshot.cells?.[initialCellIndex]?.text || '';
  editor.value = currentText;

  const overlayContainer = stage.container().querySelector('.canvas-dom-overlay') as HTMLDivElement | null;
  const container = overlayContainer ?? stage.container();
  if (overlayContainer) {
    overlayContainer.style.pointerEvents = 'auto';
  }

  container.appendChild(editor);

  function placeEditor(reason = 'direct') {
    ({ cellX, cellY, cellWidth, cellHeight } = computeCellMetrics());

    if (!tableGroup) return;

    const tablePos = tableGroup.getAbsolutePosition();
    const worldX = tablePos.x + cellX;
    const worldY = tablePos.y + cellY;

    const scale = stage.scaleX();
    const innerWidth = Math.max(20, cellWidth - paddingX * 2);
    const innerHeight = Math.max(20, cellHeight - paddingY * 2);

    editor.style.left = `${worldX + paddingX}px`;
    editor.style.top = `${worldY + paddingY}px`;
    editor.style.width = `${innerWidth}px`;
    editor.style.height = `${innerHeight}px`;
    editor.style.transform = 'scale(1)';
    editor.style.transformOrigin = '0 0';

    if (isDev) {
      console.debug('table-editor:place', {
        reason,
        elementId,
        row,
        col,
        scale,
        stagePos: stage.position(),
        world: { x: worldX, y: worldY },
      });
    }
  }


  placeEditor('initial');

  // Listen for stage transform changes to keep editor positioned correctly
  const sync = (reason: string) => () => placeEditor(reason);
  stage.on('dragmove.cell-editor wheel.cell-editor', sync('stage-move'));
  stage.on('xChange.cell-editor yChange.cell-editor scaleXChange.cell-editor scaleYChange.cell-editor', sync('stage-transform'));
  stage.on('widthChange.cell-editor heightChange.cell-editor', sync('stage-size'));

  const handleWindowResize = () => placeEditor('window-resize');
  window.addEventListener('resize', handleWindowResize);

  const observer = new ResizeObserver(() => placeEditor('container-resize'));
  observer.observe(container);

  // Also listen for table group transforms (resizing)
  tableGroup.on('transform.cell-editor', () => placeEditor('table-transform'));

  let resizeFrame: number | null = null;

  const scheduleSizeNotification = () => {
    if (!onSizeChange) {
      // Still ensure editor grows to fit content while editing
      const desiredWidth = Math.max(20, editor.scrollWidth);
      const desiredHeight = Math.max(20, editor.scrollHeight);
      editor.style.width = `${desiredWidth}px`;
      editor.style.height = `${desiredHeight}px`;
      requestAnimationFrame(() => placeEditor('content-size'));
      return;
    }

    if (resizeFrame != null) {
      cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;

      const scale = stage.scaleX();
      const measuredInnerWidth = Math.max(20, editor.scrollWidth) / scale;
      const measuredInnerHeight = Math.max(20, editor.scrollHeight) / scale;

      const requiredWidth = measuredInnerWidth + paddingX * 2;
      const requiredHeight = measuredInnerHeight + paddingY * 2;

      editor.style.width = `${measuredInnerWidth}px`;
      editor.style.height = `${measuredInnerHeight}px`;


      onSizeChange({
        elementId,
        row,
        col,
        requiredWidth,
        requiredHeight,
      });

      // Re-position after potential store-driven resize
      requestAnimationFrame(() => {
        placeEditor('initial');
      });
    });
  };

  const finish = (commit: boolean) => {
    const value = editor.value;
    cleanup();
    if (commit && onCommit) {
      onCommit(value, elementId, row, col);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    // Debug: Key pressed

    if (e.key === 'Enter' && !e.shiftKey) {
      // Debug: Enter pressed, calling finish(true)
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      // Debug: Escape pressed, calling finish(false)
      e.preventDefault();
      finish(false);
    }
    e.stopPropagation(); // Prevent canvas shortcuts
  };

  const onBlur = () => finish(true);

  editor.style.pointerEvents = 'auto';

  editor.addEventListener('keydown', onKey);
  editor.addEventListener('blur', onBlur, { once: true });
  editor.addEventListener('input', scheduleSizeNotification);

  // Focus and select all text
  editor.focus();
  if (currentText) {
    editor.select();
  }

  // Initial size sync
  scheduleSizeNotification();

  function cleanup() {
    editor.removeEventListener('keydown', onKey);
    editor.removeEventListener('blur', onBlur);
    editor.removeEventListener('input', scheduleSizeNotification);
    stage.off('dragmove.cell-editor');
    stage.off('wheel.cell-editor');
    stage.off('xChange.cell-editor yChange.cell-editor scaleXChange.cell-editor scaleYChange.cell-editor');
    stage.off('widthChange.cell-editor heightChange.cell-editor');
    window.removeEventListener('resize', handleWindowResize);
    observer.disconnect();
    tableGroup?.off('transform.cell-editor');
    if (overlayContainer) {
      overlayContainer.style.pointerEvents = 'none';
    }
    editor.remove();
    if (resizeFrame != null) {
      cancelAnimationFrame(resizeFrame);
    }
  }

  return { editor, cleanup };
}
