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

  // Element is now guaranteed to be a shape element and defined
  const shapeElement = element; // TypeScript type assertion

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
  const innerBox = computeShapeInnerBox(shapeElement as BaseShape, padding);

  console.log('[DEBUG] Shape text editor initialized:', {
    elementId,
    elementType: shapeElement.type,
    elementBounds: { x: shapeElement.x, y: shapeElement.y, width: shapeElement.width, height: shapeElement.height },
    computedInnerBox: innerBox,
    padding
  });

  // Create contentEditable DIV with proper centering for all shape types
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('data-shape-text-editor', elementId);

  // Determine if this is a triangle (needs line breaks) or circle (needs perfect centering)
  const isTriangle = shapeElement.type === 'triangle';
  const isCircle = shapeElement.type === 'circle';

  editor.style.cssText = `
    position: absolute;
    z-index: 1000;
    min-width: 40px;
    min-height: ${fontSize * lineHeight}px;
    outline: none;
    border: none;
    border-radius: 0;
    background: transparent;
    color: ${textColor};
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    padding: 8px;
    box-sizing: border-box;
    box-shadow: none;
    transition: width 0.2s ease, height 0.2s ease;
    overflow: hidden;
    cursor: text;
    ${isCircle ? `
      text-align: center;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      vertical-align: middle;
      display: block;
    ` : isTriangle ? `
      text-align: center;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
    ` : `
      text-align: center;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
    `}
  `;

  // Set initial content
  const currentText = shapeElement.data?.text || '';

  // For circles, use a special approach to ensure caret centering
  if (isCircle) {
    // Create a centered placeholder that helps position the caret
    if (currentText) {
      editor.textContent = currentText;
    } else {
      // Use a zero-width space to help with caret positioning
      editor.innerHTML = '&#8203;'; // Zero-width space
    }
  } else {
    editor.textContent = currentText;
  }

  // Append to document body to avoid transform issues
  document.body.appendChild(editor);

  // Position and resize functions
  function updateEditorPosition() {
    try {
      const containerRect = container.getBoundingClientRect();
      const stageScale = stage.scaleX();

      // Convert shape coordinates to screen coordinates
      // FIXED: Use stage.getAbsoluteTransform().point() for proper coordinate transformation
      // This is the correct Konva way that accounts for all transformations
      const stageTransform = stage.getAbsoluteTransform();
      const screenPoint = stageTransform.point({ x: innerBox.x, y: innerBox.y });
      const screenX = containerRect.left + screenPoint.x;
      const screenY = containerRect.top + screenPoint.y;
      const scaledWidth = innerBox.width * stageScale;
      const scaledHeight = innerBox.height * stageScale;

      // Debug coordinate transformation for verification
      console.log('[DEBUG] Shape text editor positioning:', {
        elementId,
        elementType: shapeElement.type,
        innerBox,
        screenPoint,
        finalScreenCoords: { screenX, screenY },
        scaledDimensions: { scaledWidth, scaledHeight },
        containerRect,
        stageScale,
        isCircle
      });


      // Position the editor
      editor.style.left = `${screenX}px`;
      editor.style.top = `${screenY}px`;
      editor.style.width = `${Math.max(60, scaledWidth)}px`;
      editor.style.height = `${Math.max(fontSize * lineHeight + 16, scaledHeight)}px`;
      editor.style.fontSize = `${fontSize * stageScale}px`;

      // For circles, ensure line-height centers the text properly
      if (isCircle) {
        const editorHeight = Math.max(fontSize * lineHeight + 16, scaledHeight);
        editor.style.lineHeight = `${editorHeight}px`;
        editor.style.paddingTop = '0px';
        editor.style.paddingBottom = '0px';
      }
    } catch (error) {
      console.warn('[ShapeTextEditor] Error updating position:', error);
    }
  }

  // Auto-resize function that grows the shape when content overflows
  function autoResizeShape() {
    const text = editor.textContent || '';
    if (text.length === 0) return;

    console.log('[DEBUG] Triangle auto-resize called:', {
      elementId,
      elementType: shapeElement.type,
      isTriangle,
      textLength: text.length,
      currentText: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });

    // Create temporary element to measure text with identical styling
    const temp = document.createElement('div');
    temp.style.cssText = `
      position: absolute;
      visibility: hidden;
      top: -9999px;
      font-family: ${editor.style.fontFamily};
      font-size: ${editor.style.fontSize};
      line-height: ${editor.style.lineHeight};
      padding: ${editor.style.padding};
      box-sizing: border-box;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      width: ${editor.style.width};
    `;
    temp.textContent = text;
    document.body.appendChild(temp);

    const measuredWidth = temp.offsetWidth;
    const measuredHeight = temp.offsetHeight;
    document.body.removeChild(temp);

    // Check if content exceeds current bounds with 90% threshold
    const currentWidth = parseFloat(editor.style.width);
    const currentHeight = parseFloat(editor.style.height);
    const stageScale = stage.scaleX();

    const widthThreshold = currentWidth * 0.9;
    const heightThreshold = currentHeight * 0.9;

    console.log('[DEBUG] Triangle auto-resize measurements:', {
      elementId,
      measuredDimensions: { measuredWidth, measuredHeight },
      currentDimensions: { currentWidth, currentHeight },
      thresholds: { widthThreshold, heightThreshold },
      shouldResize: measuredWidth > widthThreshold || measuredHeight > heightThreshold,
      currentElementSize: { width: shapeElement.width, height: shapeElement.height }
    });

    if (measuredWidth > widthThreshold || measuredHeight > heightThreshold) {
      // Calculate new shape dimensions with better padding
      const extraPadding = padding * 1.5; // Add more padding for breathing room
      let newWidth = Math.max(shapeElement.width || 0, (measuredWidth + extraPadding * 2) / stageScale);
      let newHeight = Math.max(shapeElement.height || 0, (measuredHeight + extraPadding * 2) / stageScale);

      // For circles, maintain aspect ratio
      if (isCircle) {
        const maxDim = Math.max(newWidth, newHeight);
        newWidth = maxDim;
        newHeight = maxDim;
      }

      console.log('[DEBUG] Triangle auto-resize executing:', {
        elementId,
        elementType: shapeElement.type,
        isTriangle,
        isCircle,
        originalSize: { width: shapeElement.width, height: shapeElement.height },
        newSize: { newWidth, newHeight },
        extraPadding,
        stageScale
      });

      // Update element in store with proper geometry recalculation
      store.element.update(elementId, {
        width: newWidth,
        height: newHeight,
        bounds: {
          x: shapeElement.x || 0,
          y: shapeElement.y || 0,
          width: newWidth,
          height: newHeight
        },
        // For circles, also update radius using consistent dimension calculation
        ...(isCircle && { radius: newWidth / 2 }), // Use width since we made both equal above
      });

      // Update editor size after a brief delay
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
            ...shapeElement.data,
            text: newText,
            padding,
          },
          textColor: textColor, // Use direct textColor property
          style: {
            ...shapeElement.style,
            fontSize,
            fontFamily,
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

      if (isCircle) {
        // For circles, handle caret positioning specially
        if (currentText) {
          // Select all text to show centered caret
          const range = document.createRange();
          range.selectNodeContents(editor);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else {
          // Position caret at the center for empty circles
          const range = document.createRange();
          range.setStart(editor, 0);
          range.collapse(true);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      } else {
        // For other shapes, use standard selection
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
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