import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import { computeShapeInnerBox, type BaseShape } from '../text/computeShapeInnerBox';
import type { ElementId } from '../../../../../types';

const ZERO_WIDTH_SPACE = '\u200B';
const ZERO_WIDTH_REGEX = /\u200B/g;

export interface ShapeTextEditorOptions {
  padding?: number;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  textColor?: string;
}

/**
 * Opens a centered contentEditable text editor overlay for shape text editing.
 * Provides FigJam-style interactions with smooth auto-resizing and perfect caret centering.
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

  // Compute the inner text area for the shape - this should match exactly with ShapeRenderer
  const isTriangle = shapeElement.type === 'triangle';
  const isCircle = shapeElement.type === 'circle';

  const computeEffectivePadding = (shape: typeof shapeElement) =>
    shape.data?.padding ?? (isCircle ? 0 : padding);

  let shapeSnapshot = shapeElement;
  let effectivePadding = computeEffectivePadding(shapeSnapshot);
  let innerBox = computeShapeInnerBox(shapeSnapshot as BaseShape, effectivePadding);

  const refreshShapeSnapshot = () => {
    const latest = useUnifiedCanvasStore.getState().elements.get(elementId);
    if (latest && latest.type === shapeElement.type) {
      shapeSnapshot = latest as typeof shapeElement;
      effectivePadding = computeEffectivePadding(shapeSnapshot);
      innerBox = computeShapeInnerBox(shapeSnapshot as BaseShape, effectivePadding);
    }
    return shapeSnapshot;
  };

  const shapeRadius = (shapeSnapshot as any).radius ?? shapeSnapshot.data?.radius;

  const textNode = stage.findOne<Konva.Text>(`#${elementId}-text`);
  const originalTextNodeOpacity = textNode?.opacity();
  const originalTextNodeVisible = textNode?.visible();
  const originalTextNodeListening = textNode?.listening();
  if (textNode) {
    textNode.opacity(0);
    textNode.visible(false);
    textNode.listening(false);
    textNode.getLayer()?.batchDraw();
  }

  console.log('[DEBUG] Shape text editor initialized (FIXED):', {
    elementId,
    elementType: shapeSnapshot.type,
    elementBounds: { x: shapeSnapshot.x, y: shapeSnapshot.y, width: shapeSnapshot.width, height: shapeSnapshot.height, radius: shapeRadius },
    computedInnerBox: innerBox,
    padding: effectivePadding
  });

  // Create contentEditable DIV with proper styling for circles
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('data-shape-text-editor', elementId);

  // FIXED: Optimized circle styling to prevent cut-off and positioning issues
  editor.style.cssText = `
    position: absolute;
    z-index: 1000;
    min-width: 40px;
    outline: none;
    border: none;
    border-radius: 0;
    background: transparent;
    color: ${textColor};
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    box-sizing: border-box;
    box-shadow: none;
    transition: width 0.2s ease, height 0.2s ease;
    overflow: hidden;
    cursor: text;
    ${isCircle ? `
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      padding: 0px;
      min-height: ${Math.max(fontSize * lineHeight, 24)}px;
      caret-color: ${textColor};
      border-radius: 50%;
      clip-path: circle(50% at 50% 50%);
    ` : isTriangle ? `
      text-align: center;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      padding: ${Math.max(0, effectivePadding * 0.25)}px;
      min-height: ${fontSize * lineHeight}px;
    ` : `
      text-align: center;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      padding: ${Math.max(0, effectivePadding * 0.25)}px;
      min-height: ${fontSize * lineHeight}px;
    `}
  `;

  // Set initial content with proper handling for circles
  const currentText = shapeSnapshot.data?.text || '';

  if (currentText) {
    editor.textContent = currentText;
  } else {
    // Insert zero-width space so an empty editor still shows a centered caret
    editor.textContent = ZERO_WIDTH_SPACE;
  }

  // Append to document body to avoid transform issues
  document.body.appendChild(editor);

  // FIXED: Enhanced position update function with better coordinate handling
  function updateEditorPosition() {
    try {
      const liveShape = refreshShapeSnapshot();
      const liveInnerBox = innerBox;
      const containerRect = container.getBoundingClientRect();
      const stageScale = stage.scaleX();

      const circlePadding = isCircle ? liveInnerBox.circlePadding ?? 0 : 0;
      const circleContainerSide = isCircle ? liveInnerBox.circleContainerSide ?? liveInnerBox.width : liveInnerBox.width;

      const anchorX = isCircle ? liveInnerBox.x - circlePadding : liveInnerBox.x;
      const anchorY = isCircle ? liveInnerBox.y - circlePadding : liveInnerBox.y;

      // CRITICAL: Use stage.getAbsoluteTransform().point() for perfect coordinate transformation
      // This accounts for all stage transforms (pan, zoom, etc.)
      const stageTransform = stage.getAbsoluteTransform();
      const screenPoint = stageTransform.point({ x: anchorX, y: anchorY });
      const screenX = containerRect.left + screenPoint.x;
      const screenY = containerRect.top + screenPoint.y;
      const scaledWidth = (isCircle ? circleContainerSide : liveInnerBox.width) * stageScale;
      const scaledHeight = (isCircle ? circleContainerSide : liveInnerBox.height) * stageScale;

      console.log('[DEBUG] Shape text editor positioning (ENHANCED):', {
        elementId,
        elementType: liveShape.type,
        innerBox: liveInnerBox,
        containerRect: { left: containerRect.left, top: containerRect.top },
        stageTransform: {
          x: stage.x(),
          y: stage.y(),
          scaleX: stage.scaleX(),
          scaleY: stage.scaleY()
        },
        screenPoint,
        finalScreenCoords: { screenX, screenY },
        scaledDimensions: { scaledWidth, scaledHeight },
        isCircle
      });

      // Position the editor with pixel-perfect accuracy
      editor.style.left = `${Math.round(screenX)}px`;
      editor.style.top = `${Math.round(screenY)}px`;

      let finalWidth = Math.max(1, Math.round(scaledWidth));
      let finalHeight = Math.max(Math.round(fontSize * lineHeight), Math.round(scaledHeight));

      if (isCircle) {
        const normalizedSize = Math.max(1, Math.round(scaledWidth));
        finalWidth = normalizedSize;
        finalHeight = normalizedSize;
      } else {
        finalWidth = Math.max(40, Math.round(scaledWidth));
        finalHeight = Math.max(Math.round(fontSize * lineHeight), Math.round(scaledHeight));
      }

      editor.style.width = `${finalWidth}px`;
      editor.style.height = `${finalHeight}px`;

      const scaledFontSize = fontSize * stageScale;
      const effectiveFontSize = stageScale >= 1 ? Math.max(Math.round(scaledFontSize), fontSize) : fontSize;
      editor.style.fontSize = `${Math.max(effectiveFontSize, 14)}px`;

      // For circles, ensure proper line-height scaling
      if (isCircle) {
        editor.style.lineHeight = `${lineHeight}`; // Keep relative line-height
        const scaledPadding = Math.max(0, circlePadding * stageScale);
        editor.style.padding = `${Math.round(scaledPadding)}px`;
        const scaledClipRadius = Math.max(0, Math.round(finalWidth / 2));
        editor.style.clipPath = `circle(${scaledClipRadius}px at 50% 50%)`;
        editor.style.borderRadius = `${scaledClipRadius}px`;
      }
    } catch (error) {
      console.warn('[ShapeTextEditor] Error updating position:', error);
    }
  }

  // IMPROVED: Auto-resize function with better thresholds for circles
  function autoResizeShape() {
    const liveShape = refreshShapeSnapshot();
    const liveInnerBox = innerBox;
    const text = (editor.textContent || '').replace(ZERO_WIDTH_REGEX, '');
    if (text.length === 0) return;

    console.log('[DEBUG] Auto-resize called (IMPROVED):', {
      elementId,
      elementType: liveShape.type,
      isCircle,
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
      text-align: ${editor.style.textAlign};
    `;
    temp.textContent = text;
    document.body.appendChild(temp);

    const measuredWidth = temp.offsetWidth;
    const measuredHeight = temp.offsetHeight;
    document.body.removeChild(temp);

    // FIXED: Better thresholds for circles - more conservative to prevent unnecessary resizing
    const stageScale = stage.scaleX();
    const currentWidth = liveInnerBox.width * stageScale;
    const currentHeight = liveInnerBox.height * stageScale;

    // Trigger growth a bit earlier for circles
    const widthThreshold = currentWidth * (isCircle ? 0.7 : 0.9);
    const heightThreshold = currentHeight * (isCircle ? 0.7 : 0.9);

    const elementRadius = (liveShape as any).radius ?? liveShape.data?.radius;

    console.log('[DEBUG] Auto-resize measurements (IMPROVED):', {
      elementId,
      measuredDimensions: { measuredWidth, measuredHeight },
      currentDimensions: { currentWidth, currentHeight },
      thresholds: { widthThreshold, heightThreshold },
      shouldResize: measuredWidth > widthThreshold || measuredHeight > heightThreshold,
      currentElementSize: { width: liveShape.width, height: liveShape.height, radius: elementRadius }
    });

    if (measuredWidth > widthThreshold || measuredHeight > heightThreshold) {
      // Calculate new shape dimensions with appropriate padding
      const extraPadding = isCircle ? 2 : Math.max(2, effectivePadding * 1.25);
      let newWidth = Math.max(liveShape.width || 0, (measuredWidth + extraPadding * 2) / stageScale);
      let newHeight = Math.max(liveShape.height || 0, (measuredHeight + extraPadding * 2) / stageScale);

      // FIXED: For circles, maintain perfect circular proportions
      if (isCircle) {
        const maxDim = Math.max(newWidth, newHeight);
        newWidth = maxDim;
        newHeight = maxDim;
        
        // Calculate radius from width (diameter)
        const newRadius = maxDim / 2;
        
        console.log('[DEBUG] Circle auto-resize executing (IMPROVED):', {
          elementId,
          originalSize: { width: liveShape.width, height: liveShape.height, radius: elementRadius },
          newSize: { newWidth, newHeight, newRadius },
          maxDim,
          extraPadding,
          stageScale
        });

        // Update circle with proper radius calculation
        store.element.update(elementId, {
          width: newWidth,
          height: newHeight,
          data: {
            ...liveShape.data,
            radius: newRadius,
            padding: effectivePadding,
          },
          bounds: {
            x: (liveShape.x || 0) - newRadius, // Bounds use top-left corner
            y: (liveShape.y || 0) - newRadius,
            width: newWidth,
            height: newHeight
          }
        });
        store.bumpSelectionVersion?.();
      } else {
        console.log('[DEBUG] Shape auto-resize executing:', {
          elementId,
          elementType: liveShape.type,
          originalSize: { width: liveShape.width, height: liveShape.height },
          newSize: { newWidth, newHeight },
          extraPadding,
          stageScale
        });

        // Update other shapes normally
        store.element.update(elementId, {
          width: newWidth,
          height: newHeight,
          data: {
            ...liveShape.data,
            padding: effectivePadding,
          },
          bounds: {
            x: liveShape.x || 0,
            y: liveShape.y || 0,
            width: newWidth,
            height: newHeight
          }
        });
        store.bumpSelectionVersion?.();
      }

      refreshShapeSnapshot();

      // Update editor position after a brief delay
      requestAnimationFrame(() => {
        updateEditorPosition();
      });
    }
  }

  // Initial positioning
  updateEditorPosition();

  let isCleaning = false;

  // Stage transform listeners
  const onStageTransform = () => updateEditorPosition();
  stage.on('dragmove.shape-text-editor', onStageTransform);
  stage.on('scaleXChange.shape-text-editor scaleYChange.shape-text-editor', onStageTransform);
  stage.on('xChange.shape-text-editor yChange.shape-text-editor', onStageTransform);

  const handleGlobalPointerDown = (event: PointerEvent) => {
    if (!editor.contains(event.target as Node)) {
      commit(true);
    }
  };
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);

  // Cleanup function
  function cleanup() {
    if (isCleaning) return;
    isCleaning = true;
    try {
      editor.remove();
    } catch (error) {
      console.warn('[ShapeTextEditor] Error removing editor:', error);
    }

    if (textNode) {
      textNode.opacity(originalTextNodeOpacity ?? 1);
      textNode.visible(originalTextNodeVisible ?? true);
      textNode.listening(originalTextNodeListening ?? false);
      textNode.getLayer()?.batchDraw();
    }

    // Remove stage listeners
    stage.off('dragmove.shape-text-editor');
    stage.off('scaleXChange.shape-text-editor scaleYChange.shape-text-editor');
    stage.off('xChange.shape-text-editor yChange.shape-text-editor');
    window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  }

  // Commit function
  function commit(save: boolean = true) {
    const rawText = (editor.textContent || '').replace(ZERO_WIDTH_REGEX, '');
    const newText = rawText.trim();
    cleanup();

    if (save && newText !== currentText) {
      // Update element with new text using withUndo for history
      store.withUndo('Edit shape text', () => {
        const liveShape = refreshShapeSnapshot();
        store.element.update(elementId, {
          data: {
            ...liveShape.data,
            text: newText,
            padding: effectivePadding,
            textLineHeight: lineHeight,
          },
          textColor: textColor, // Use direct textColor property
          style: {
            ...liveShape.style,
            fontSize,
            fontFamily,
            textAlign: 'center' as const
          }
        });
      });
      console.log('[ShapeTextEditor] Text committed (FIXED):', newText);
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
    if (editor.textContent && editor.textContent.includes(ZERO_WIDTH_SPACE)) {
      const selection = window.getSelection();
      const anchorOffset = selection?.anchorOffset ?? 0;
      const sanitized = editor.textContent.replace(ZERO_WIDTH_REGEX, '');

      if (sanitized.length === 0) {
        editor.textContent = ZERO_WIDTH_SPACE;
      } else if (sanitized !== editor.textContent) {
        editor.textContent = sanitized;
      }

      if (selection && editor.firstChild) {
        const target = editor.firstChild;
        const offset = Math.min(anchorOffset, target.textContent?.length ?? 0);
        const range = document.createRange();
        range.setStart(target, offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    autoResizeShape();
  };

  const onBlur = () => {
    // Commit changes on blur
    setTimeout(() => commit(true), 100);
  };

  // Attach event listeners
  editor.addEventListener('keydown', onKeyDown);
  editor.addEventListener('input', onInput);
  editor.addEventListener('blur', onBlur);

  // FIXED: Better caret positioning for all shapes
  setTimeout(() => {
    try {
      editor.focus();

      if (currentText) {
        const selection = window.getSelection();
        if (selection && editor.firstChild) {
          const range = document.createRange();
          const node = editor.firstChild;
          const length = node.textContent ? node.textContent.length : 0;
          range.setStart(node, length);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        // For empty shapes, move caret after the zero-width space so typing replaces it
        const selection = window.getSelection();
        if (selection && editor.firstChild) {
          const range = document.createRange();
          const targetNode = editor.firstChild;
          const initialOffset = targetNode.textContent ? targetNode.textContent.length : 0;
          range.setStart(targetNode, initialOffset);
          range.collapse(true);
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

      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      const range = document.createRange();
      const hasExistingText = editor.value.length > 0;

      if (hasExistingText) {
        range.selectNodeContents(editor);
        range.collapse(false);
      } else if (editor.firstChild) {
        range.setStart(editor.firstChild, 0);
        range.collapse(true);
      } else {
        range.setStart(editor, 0);
        range.collapse(true);
      }

      selection.removeAllRanges();
      selection.addRange(range);
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
