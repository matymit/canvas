import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import { computeShapeInnerBox, type BaseShape } from '../text/computeShapeInnerBox';
import type { ElementId } from '../../../../../types';

export interface ShapeTextEditorOptions {
  padding?: number;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  textColor?: string;
}

/**
 * Opens a centered contentEditable text editor overlay for shape text editing.
 * Provides FigJam-style interactions with smooth auto-resizing and centered caret.
 */
export function openShapeTextEditor(
  stage: Konva.Stage,
  elementId: ElementId,
  options: ShapeTextEditorOptions = {}
): () => void {
  const store = useUnifiedCanvasStore.getState();
  const element = store.elements.get(elementId);

  if (!element || !['rectangle', 'circle', 'triangle'].includes(element.type)) {
    console.warn('[ShapeTextEditor] Invalid element type for text editing:', element?.type);
    return () => {};
  }

  // Element is now guaranteed to be a shape element

  const container = stage.container();
  if (!container) {
    console.warn('[ShapeTextEditor] No stage container found');
    return () => {};
  }

  // Default options
  const {
    padding = 10,
    fontSize = 18,
    lineHeight = 1.3,
    fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
    textColor = '#111827'
  } = options;

  // Compute the inner text area for the shape
  const innerBox = computeShapeInnerBox(element as BaseShape, padding);

  // Create contentEditable DIV with centered text alignment
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('data-shape-text-editor', elementId);
  editor.style.cssText = `
    position: absolute;
    z-index: 1000;
    min-width: 40px;
    min-height: ${fontSize * lineHeight}px;
    outline: none;
    border: 2px solid #4F46E5;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.98);
    color: ${textColor};
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    text-align: center;
    padding: 8px;
    box-sizing: border-box;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: width 0.2s ease, height 0.2s ease;
    overflow: hidden;
    white-space: nowrap;
    cursor: text;
  `;

  // Set initial content
  const currentText = element.data?.text || '';
  editor.textContent = currentText;

  // Append to document body to avoid transform issues
  document.body.appendChild(editor);

  // Position and resize functions
  function updateEditorPosition() {
    try {
      const containerRect = container.getBoundingClientRect();
      const stagePos = stage.position();
      const stageScale = stage.scaleX();

      // Convert shape coordinates to screen coordinates
      const screenX = containerRect.left + (innerBox.x * stageScale) + stagePos.x;
      const screenY = containerRect.top + (innerBox.y * stageScale) + stagePos.y;
      const scaledWidth = innerBox.width * stageScale;
      const scaledHeight = innerBox.height * stageScale;

      // Position the editor
      editor.style.left = `${screenX}px`;
      editor.style.top = `${screenY}px`;
      editor.style.width = `${Math.max(60, scaledWidth)}px`;
      editor.style.height = `${Math.max(fontSize * lineHeight + 16, scaledHeight)}px`;
      editor.style.fontSize = `${fontSize * stageScale}px`;
    } catch (error) {
      console.warn('[ShapeTextEditor] Error updating position:', error);
    }
  }

  // Auto-resize function that grows the shape when content overflows
  function autoResizeShape() {
    const text = editor.textContent || '';
    if (text.length === 0) return;

    // Create temporary element to measure text
    const temp = document.createElement('div');
    temp.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: nowrap;
      font-family: ${editor.style.fontFamily};
      font-size: ${editor.style.fontSize};
      line-height: ${editor.style.lineHeight};
      padding: ${editor.style.padding};
    `;
    temp.textContent = text;
    document.body.appendChild(temp);

    const measuredWidth = temp.offsetWidth;
    const measuredHeight = temp.offsetHeight;
    document.body.removeChild(temp);

    // Check if content exceeds current bounds
    const currentWidth = parseFloat(editor.style.width);
    const currentHeight = parseFloat(editor.style.height);
    const stageScale = stage.scaleX();

    if (measuredWidth > currentWidth || measuredHeight > currentHeight) {
      // Calculate new shape dimensions
      const newWidth = Math.max(element?.width || 0, (measuredWidth + padding * 2) / stageScale);
      const newHeight = Math.max(element?.height || 0, (measuredHeight + padding * 2) / stageScale);

      // Update element in store with smooth resizing
      store.element.update(elementId, {
        width: newWidth,
        height: newHeight
      });

      // Update editor size
      setTimeout(() => {
        updateEditorPosition();
      }, 50);
    }
  }

  // Initial positioning
  updateEditorPosition();

  // Stage transform listeners
  const onStageTransform = () => updateEditorPosition();
  stage.on('dragmove.shape-text-editor', onStageTransform);
  stage.on('scaleXChange.shape-text-editor scaleYChange.shape-text-editor', onStageTransform);
  stage.on('xChange.shape-text-editor yChange.shape-text-editor', onStageTransform);

  // Cleanup function
  function cleanup() {
    try {
      editor.remove();
    } catch (error) {
      console.warn('[ShapeTextEditor] Error removing editor:', error);
    }

    // Remove stage listeners
    stage.off('dragmove.shape-text-editor');
    stage.off('scaleXChange.shape-text-editor scaleYChange.shape-text-editor');
    stage.off('xChange.shape-text-editor yChange.shape-text-editor');
  }

  // Commit function
  function commit(save: boolean = true) {
    const newText = (editor.textContent || '').trim();
    cleanup();

    if (save && newText !== currentText) {
      // Update element with new text using withUndo for history
      store.withUndo('Edit shape text', () => {
        store.element.update(elementId, {
          data: {
            ...element?.data,
            text: newText,
            padding,
          },
          style: {
            ...element?.style,
            fontSize,
            fontFamily,
            fill: textColor, // Use 'fill' instead of 'textColor'
            textAlign: 'center' as const
          }
        });
      });
      console.log('[ShapeTextEditor] Text committed:', newText);
    } else {
      console.log('[ShapeTextEditor] Text edit cancelled');
    }
  }

  // Event handlers
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // Prevent canvas shortcuts

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commit(false);
    }
  };

  const onInput = () => {
    // Auto-resize on input with debouncing
    clearTimeout((autoResizeShape as any).timeout);
    (autoResizeShape as any).timeout = setTimeout(autoResizeShape, 150);
  };

  const onBlur = () => {
    // Commit changes on blur
    setTimeout(() => commit(true), 100);
  };

  // Attach event listeners
  editor.addEventListener('keydown', onKeyDown);
  editor.addEventListener('input', onInput);
  editor.addEventListener('blur', onBlur);

  // Focus and position caret at center
  setTimeout(() => {
    try {
      editor.focus();

      // Select all text to show centered caret
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      console.warn('[ShapeTextEditor] Error focusing editor:', error);
    }
  }, 10);

  return cleanup;
}

/**
 * Legacy interface for text editor - used by TextRenderer for text elements.
 * This maintains compatibility with existing code.
 */
export interface TextEditorOptions {
  stage: Konva.Stage;
  layer: Konva.Layer;
  shape: Konva.Text;
  onCommit: (text: string) => void;
  onCancel?: () => void;
}

/**
 * Opens a DOM-based text editor overlay positioned on top of a Konva.Text node
 * The editor stays in sync with canvas transforms (pan/zoom) and commits changes
 */
export function openKonvaTextEditor({ stage, layer, shape, onCommit, onCancel }: TextEditorOptions) {
  // Ensure shape is visible and drawn so we can get bounds
  layer.batchDraw();

  const container = stage.container();
  if (!container) {
    console.warn('[TextEditor] No stage container found');
    return;
  }

  // Create editor element
  const editor = document.createElement('textarea');
  editor.setAttribute('data-text-editor', 'true');
  editor.value = shape.text();

  // Style the editor to match the text
  const fontSize = shape.fontSize();
  const fontFamily = shape.fontFamily();
  const fill = typeof shape.fill() === 'string' ? shape.fill() : '#111827';

  editor.style.position = 'absolute';
  editor.style.zIndex = '1000';
  editor.style.minWidth = '20px';
  editor.style.minHeight = '20px';
  editor.style.outline = 'none';
  editor.style.border = '1px dashed rgba(0, 0, 255, 0.5)';
  editor.style.borderRadius = '2px';
  editor.style.background = 'rgba(255, 255, 255, 0.95)';
  editor.style.color = fill as string;
  editor.style.fontFamily = fontFamily;
  editor.style.fontSize = `${fontSize}px`;
  editor.style.lineHeight = '1.2';
  editor.style.padding = '2px 4px';
  editor.style.resize = 'none';
  editor.style.whiteSpace = 'nowrap';
  editor.style.overflow = 'hidden';
  editor.style.transformOrigin = '0 0';
  editor.style.boxSizing = 'border-box';
  editor.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';

  // Append to document body (not container to avoid transform issues)
  document.body.appendChild(editor);

  // Hide the original text while editing
  const originalOpacity = shape.opacity();
  shape.opacity(0.2);
  layer.batchDraw();

  // Position update function that accounts for stage transforms
  function updateEditorPosition() {
    try {
      const containerRect = container.getBoundingClientRect();
      const stagePos = stage.position();
      const stageScale = stage.scaleX(); // Assume uniform scaling

      // Get the shape's position in world coordinates
      const shapeX = shape.x();
      const shapeY = shape.y();

      // Convert to screen coordinates
      const screenX = containerRect.left + (shapeX * stageScale) + stagePos.x;
      const screenY = containerRect.top + (shapeY * stageScale) + stagePos.y;

      // Calculate size accounting for scale
      const shapeWidth = Math.max(shape.width() || shape.textWidth, 100);
      const shapeHeight = Math.max(shape.height() || shape.textHeight, fontSize * 1.2);
      const scaledWidth = shapeWidth * stageScale;
      const scaledHeight = shapeHeight * stageScale;

      // Update editor position and size
      editor.style.left = `${screenX}px`;
      editor.style.top = `${screenY}px`;
      editor.style.width = `${Math.max(60, scaledWidth)}px`;
      editor.style.height = `${Math.max(24, scaledHeight)}px`;

      // Scale the font size to match the canvas zoom
      editor.style.fontSize = `${fontSize * stageScale}px`;

    } catch (error) {
      console.warn('[TextEditor] Error updating position:', error);
    }
  }

  // Initial positioning
  updateEditorPosition();

  // Auto-resize as user types
  function autoResize() {
    const currentText = editor.value;
    if (currentText.length === 0) return;

    // Create temporary element to measure text
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'nowrap';
    temp.style.fontFamily = editor.style.fontFamily;
    temp.style.fontSize = editor.style.fontSize;
    temp.style.padding = editor.style.padding;
    temp.innerText = currentText;

    document.body.appendChild(temp);
    const measuredWidth = temp.offsetWidth;
    const measuredHeight = temp.offsetHeight;
    document.body.removeChild(temp);

    // Update editor size with some padding
    const minWidth = 60;
    const minHeight = 24;
    editor.style.width = `${Math.max(minWidth, measuredWidth + 10)}px`;
    editor.style.height = `${Math.max(minHeight, measuredHeight)}px`;
  }

  // Listen to stage transforms to keep editor in sync
  const onStageTransform = () => updateEditorPosition();
  stage.on('dragmove.text-editor', onStageTransform);
  stage.on('scaleXChange.text-editor scaleYChange.text-editor', onStageTransform);
  stage.on('xChange.text-editor yChange.text-editor', onStageTransform);

  // Listen to mouse wheel for zoom
  const onWheel = () => {
    // Small delay to let zoom complete
    setTimeout(updateEditorPosition, 10);
  };
  stage.on('wheel.text-editor', onWheel);

  // Cleanup function
  function cleanup() {
    try {
      editor.remove();
    } catch (error) {
      console.warn('[TextEditor] Error removing editor:', error);
    }

    // Restore original text opacity
    shape.opacity(originalOpacity);
    layer.batchDraw();

    // Remove event listeners
    stage.off('dragmove.text-editor');
    stage.off('scaleXChange.text-editor scaleYChange.text-editor');
    stage.off('xChange.text-editor yChange.text-editor');
    stage.off('wheel.text-editor');
  }

  // Commit function
  function commit(save: boolean = true) {
    const newText = editor.value.trim();
    cleanup();

    if (save) {
      console.log('[TextEditor] Committing text:', newText);
      onCommit(newText);
    } else {
      console.log('[TextEditor] Canceling text edit');
      onCancel?.();
    }
  }

  // Event handlers
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // Prevent canvas shortcuts

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commit(false);
    } else {
      // Auto-resize on typing
      setTimeout(autoResize, 0);
    }
  };

  const onBlur = () => {
    // Small delay to allow other events to process
    setTimeout(() => commit(true), 100);
  };

  const onInput = () => {
    autoResize();
  };

  // Attach event listeners
  editor.addEventListener('keydown', onKeyDown);
  editor.addEventListener('blur', onBlur);
  editor.addEventListener('input', onInput);

  // Focus and select all text
  setTimeout(() => {
    try {
      editor.focus();
      editor.select();
    } catch (error) {
      console.warn('[TextEditor] Error focusing editor:', error);
    }
  }, 10);

  // Return cleanup function for manual cleanup if needed
  return cleanup;
}

/**
 * Utility function to compute text bounds for positioning
 */
export function computeTextBounds(text: Konva.Text): { x: number; y: number; width: number; height: number } {
  const clientRect = text.getClientRect({ skipTransform: false });
  return {
    x: clientRect.x,
    y: clientRect.y,
    width: Math.max(clientRect.width, 40),
    height: Math.max(clientRect.height, 24)
  };
}