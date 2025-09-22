import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import {
  computeShapeInnerBox,
  type BaseShape
} from '../text/computeShapeInnerBox';
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
 * Keeps geometry in sync with manual shape sizing and maintains caret alignment.
 */
export function openShapeTextEditor(
  stage: Konva.Stage,
  elementId: ElementId,
  options: ShapeTextEditorOptions = {}
): () => void {
  const store = useUnifiedCanvasStore.getState();
  const element = store.elements.get(elementId);

  if (!element || !['rectangle', 'circle', 'triangle'].includes(element.type)) {
    return () => {};
  }

  const shapeElement = element;
  const container = stage.container();
  if (!container) {
    return () => {};
  }

  const {
    padding = 10,
    fontSize: providedFontSize,
    lineHeight: providedLineHeight,
    fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
    textColor = '#111827'
  } = options;

  const fontSize = providedFontSize ?? (typeof shapeElement.style?.fontSize === 'number' ? shapeElement.style.fontSize : (shapeElement.type === 'circle' ? 20 : 10));
  const lineHeight = providedLineHeight ?? (typeof shapeElement.data?.textLineHeight === 'number' ? shapeElement.data.textLineHeight : 1.25);

  let shapeSnapshot = shapeElement;
  let isTriangle = shapeSnapshot.type === 'triangle';
  let isCircle = shapeSnapshot.type === 'circle' || shapeSnapshot.type === 'ellipse';

  const computeEffectivePadding = (shape: typeof shapeElement) =>
    (typeof shape.data?.padding === 'number' ? shape.data.padding : (isCircle ? 0 : padding));

  const getCirclePadding = () => Math.max(0, effectivePadding);

  let effectivePadding = computeEffectivePadding(shapeSnapshot);
  let innerBox = computeShapeInnerBox(shapeSnapshot as BaseShape, effectivePadding);

  const refreshShapeSnapshot = () => {
    const latest = useUnifiedCanvasStore.getState().elements.get(elementId);
    if (latest && (latest.type === 'rectangle' || latest.type === 'triangle' || latest.type === 'circle' || latest.type === 'ellipse')) {
      shapeSnapshot = latest as typeof shapeElement;
    }
    isTriangle = shapeSnapshot.type === 'triangle';
    isCircle = shapeSnapshot.type === 'circle' || shapeSnapshot.type === 'ellipse';
    effectivePadding = computeEffectivePadding(shapeSnapshot);
    innerBox = computeShapeInnerBox(shapeSnapshot as BaseShape, effectivePadding);
    return shapeSnapshot;
  };

  const textNode = typeof stage.findOne === 'function'
    ? stage.findOne<Konva.Text>(`#${elementId}-text`)
    : null;
  const originalTextNodeOpacity = textNode?.opacity();
  const originalTextNodeVisible = textNode?.visible();
  const originalTextNodeListening = textNode?.listening();
  if (textNode) {
    textNode.opacity(0);
    textNode.visible(false);
    textNode.listening(false);
    textNode.getLayer()?.batchDraw();
  }

  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('data-shape-text-editor', elementId);
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', 'Shape text editor');

  // CRITICAL FIX: Enhanced caret visibility and clean styling for all shapes
  const editorStyles = {
    position: 'absolute',
    zIndex: '1000',
    minWidth: '1px',
    outline: 'none !important',
    border: 'none !important',
    borderRadius: '0',
    background: 'transparent',
    color: textColor,
    fontFamily: fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}`,
    boxSizing: 'border-box',
    boxShadow: 'none !important',
    transition: 'width 0.2s ease, height 0.2s ease',
    overflow: 'hidden',
    cursor: 'text',
    // CRITICAL FIX: Cross-browser caret visibility
    caretColor: `${textColor} !important`,
    webkitTextFillColor: `${textColor} !important`,
    textFillColor: textColor,
    // CRITICAL FIX: Remove any unwanted borders or dashed frames completely
    borderStyle: 'none !important',
    borderWidth: '0 !important',
    borderColor: 'transparent !important',
    outlineStyle: 'none !important',
    outlineWidth: '0 !important',
    outlineColor: 'transparent !important',
    // Additional browser-specific resets
    webkitAppearance: 'none',
    mozAppearance: 'none',
    msAppearance: 'none',
    appearance: 'none',
    // Ensure text shadow doesn't interfere
    textShadow: 'none',
    // Force hardware acceleration for better rendering
    transform: 'translateZ(0)',
    willChange: 'transform'
  };

  // Apply styles based on shape type
  if (isCircle) {
    Object.assign(editorStyles, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      padding: `${getCirclePadding()}px`,
      minHeight: '1px'
    });
  } else if (isTriangle) {
    Object.assign(editorStyles, {
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      padding: `${Math.max(0, effectivePadding * 0.25)}px`,
      minHeight: `${fontSize * lineHeight}px`
    });
  } else {
    Object.assign(editorStyles, {
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      padding: `${Math.max(0, effectivePadding * 0.25)}px`,
      minHeight: `${fontSize * lineHeight}px`
    });
  }

  // Apply styles to editor
  Object.assign(editor.style, editorStyles);

  const currentText = (typeof shapeSnapshot.data?.text === 'string' ? shapeSnapshot.data.text : '') || '';
  let latestEditorText = currentText;

  if (currentText) {
    editor.textContent = currentText;
  } else {
    editor.textContent = ZERO_WIDTH_SPACE;
  }

  document.body.appendChild(editor);

  function updateEditorPosition() {
    try {
      refreshShapeSnapshot();
      const liveInnerBox = innerBox;
      const containerRect = container.getBoundingClientRect();
      const stageScale = typeof stage.scaleX === 'function' ? stage.scaleX() : 1;

      const anchorX = liveInnerBox.x;
      const anchorY = liveInnerBox.y;

      let screenPoint = { x: anchorX * stageScale, y: anchorY * stageScale };
      if (typeof stage.getAbsoluteTransform === 'function') {
        const stageTransform = stage.getAbsoluteTransform();
        screenPoint = stageTransform.point({ x: anchorX, y: anchorY });
      }
      const screenX = containerRect.left + screenPoint.x;
      const screenY = containerRect.top + screenPoint.y;
      const scaledWidth = liveInnerBox.width * stageScale;
      const scaledHeight = liveInnerBox.height * stageScale;

      editor.style.left = `${Math.round(screenX)}px`;
      editor.style.top = `${Math.round(screenY)}px`;

      const finalWidth = Math.max(1, Math.round(scaledWidth));
      const finalHeight = Math.max(1, Math.round(scaledHeight));

      editor.style.width = `${finalWidth}px`;
      editor.style.height = `${finalHeight}px`;

      const effectiveFontSize = stageScale >= 1
        ? Math.max(Math.round(fontSize * stageScale), fontSize)
        : fontSize;
      editor.style.fontSize = `${effectiveFontSize}px`;

      if (isCircle) {
        editor.style.lineHeight = `${lineHeight}`;
        const scaledPadding = Math.max(0, getCirclePadding() * stageScale);
        editor.style.padding = `${Math.round(scaledPadding)}px`;
      }
    } catch (error) {
      console.warn('[openShapeTextEditor] Error updating position:', error);
    }
  }

  updateEditorPosition();

  let isCleaning = false;

  const onStageTransform = () => updateEditorPosition();
  if (typeof stage.on === 'function') {
    stage.on('dragmove.shape-text-editor', onStageTransform);
    stage.on('scaleXChange.shape-text-editor scaleYChange.shape-text-editor', onStageTransform);
    stage.on('xChange.shape-text-editor yChange.shape-text-editor', onStageTransform);
  }

  const handleGlobalPointerDown = (event: PointerEvent) => {
    if (!editor.contains(event.target as Node)) {
      commit(true);
    }
  };
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);

  function cleanup() {
    if (isCleaning) return;
    isCleaning = true;
    try {
      editor.remove();
    } catch (error) {
      console.warn('[openShapeTextEditor] Error removing editor:', error);
    }

    if (textNode) {
      textNode.opacity(originalTextNodeOpacity ?? 1);
      textNode.visible(originalTextNodeVisible ?? true);
      textNode.listening(originalTextNodeListening ?? false);
      textNode.getLayer()?.batchDraw();
    }

    if (typeof stage.off === 'function') {
      stage.off('dragmove.shape-text-editor');
      stage.off('scaleXChange.shape-text-editor scaleYChange.shape-text-editor');
      stage.off('xChange.shape-text-editor yChange.shape-text-editor');
    }
    window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
  }

  function commit(save: boolean = true) {
    const rawSource = (typeof latestEditorText === 'string' ? latestEditorText : '') || editor.innerText || editor.textContent || '';
    const rawText = rawSource.replace(ZERO_WIDTH_REGEX, '');
    const newText = rawText.trim();
    cleanup();

    if (!save) {
      return;
    }

    const shouldUpdate = newText !== currentText;

    if (shouldUpdate) {
      const applyUpdate = () => {
        const liveShape = refreshShapeSnapshot();
        store.element.update(elementId, {
          data: {
            ...liveShape.data,
            text: newText,
            padding: effectivePadding,
            textLineHeight: lineHeight,
          },
          textColor: textColor,
          style: {
            ...liveShape.style,
            fontSize,
            fontFamily,
            textAlign: 'center' as const
          }
        });
      };

      if (typeof store.withUndo === 'function') {
        store.withUndo('Edit shape text', applyUpdate);
      } else {
        applyUpdate();
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();

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

    latestEditorText = (editor.textContent || '').replace(ZERO_WIDTH_REGEX, '');
  };

  const onBlur = () => {
    setTimeout(() => commit(true), 100);
  };

  editor.addEventListener('keydown', onKeyDown);
  window.addEventListener('keydown', onKeyDown, true);
  editor.addEventListener('input', onInput);
  editor.addEventListener('blur', onBlur);

  // CRITICAL FIX: Enhanced focus strategy with guaranteed caret visibility
  const focusEditor = () => {
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
      console.warn('[openShapeTextEditor] Error focusing editor:', error);
    }
  };

  // CRITICAL FIX: Multi-strategy focus with enhanced caret visibility for all shapes
  const ensureCaretVisibility = () => {
    // Force caret color and text rendering
    editor.style.caretColor = textColor;
    editor.style.webkitTextFillColor = textColor;
    
    // Additional browser-specific caret fixes
    if (navigator.userAgent.includes('Chrome')) {
      // Chrome-specific caret visibility
      editor.style.webkitTextStroke = 'initial';
    } else if (navigator.userAgent.includes('Firefox')) {
      // Firefox-specific caret visibility
      (editor.style as any).MozTextFillColor = textColor;
    } else if (navigator.userAgent.includes('Safari')) {
      // Safari-specific caret visibility
      editor.style.webkitTextFillColor = textColor;
      (editor.style as any).textFillColor = textColor;
    }
    
    // Force redraw
    editor.style.display = 'none';
    editor.offsetHeight; // Force reflow
    
    if (isCircle) {
      editor.style.display = 'flex';
    } else {
      editor.style.display = 'block';
    }
  };

  if (isCircle) {
    // Enhanced focus sequence for circles with caret visibility fixes
    editor.offsetHeight; // Force layout

    requestAnimationFrame(() => {
      ensureCaretVisibility();
      focusEditor();
      
      // Multiple focus attempts for circles
      requestAnimationFrame(() => {
        ensureCaretVisibility();
        
        // Blur and refocus strategy
        editor.blur();
        setTimeout(() => {
          ensureCaretVisibility();
          focusEditor();
          
          // Final caret visibility check
          setTimeout(() => {
            if (document.activeElement !== editor) {
              ensureCaretVisibility();
              focusEditor();
            }
          }, 50);
        }, 10);
      });
    });
  } else {
    // Enhanced focus strategy for rectangles and triangles
    ensureCaretVisibility();
    focusEditor();
    setTimeout(() => {
      ensureCaretVisibility();
      focusEditor();
    }, 10);
    requestAnimationFrame(() => {
      ensureCaretVisibility();
      focusEditor();
    });
  }

  return cleanup;
}

/**
 * CRITICAL FIX: Legacy text editor with completely clean styling (no dashed blue frames)
 */
export interface TextEditorOptions {
  stage: Konva.Stage;
  layer: Konva.Layer;
  shape: Konva.Text;
  onCommit: (text: string) => void;
  onCancel?: () => void;
}

export function openKonvaTextEditor({ stage, layer, shape, onCommit, onCancel }: TextEditorOptions) {
  layer.batchDraw();

  const container = stage.container();
  if (!container) {
    return;
  }

  const editor = document.createElement('textarea');
  editor.setAttribute('data-text-editor', 'true');
  editor.value = shape.text();

  const fontSize = shape.fontSize();
  const fontFamily = shape.fontFamily();
  const fill = typeof shape.fill() === 'string' ? shape.fill() : '#111827';

  // CRITICAL FIX: Completely clean styling without any unwanted borders
  const editorStyles = {
    position: 'absolute',
    zIndex: '1000',
    minWidth: '20px',
    minHeight: '20px',
    // CRITICAL FIX: Complete border and outline removal
    outline: 'none !important',
    border: 'none !important',
    borderStyle: 'none !important',
    borderWidth: '0 !important',
    borderColor: 'transparent !important',
    outlineStyle: 'none !important',
    outlineWidth: '0 !important',
    outlineColor: 'transparent !important',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.95)',
    color: fill as string,
    fontFamily: fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight: '1.2',
    padding: '2px 4px',
    resize: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    transformOrigin: '0 0',
    boxSizing: 'border-box',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    // CRITICAL: Enhanced caret visibility
    caretColor: fill as string,
    webkitTextFillColor: fill as string,
    // Additional browser resets
    webkitAppearance: 'none',
    mozAppearance: 'none',
    msAppearance: 'none',
    appearance: 'none'
  };

  Object.assign(editor.style, editorStyles);

  document.body.appendChild(editor);

  const originalOpacity = shape.opacity();
  shape.opacity(0.2);
  layer.batchDraw();

  function updateEditorPosition() {
    try {
      const containerRect = container.getBoundingClientRect();
      const stagePos = stage.position();
      const stageScale = stage.scaleX();

      const shapeX = shape.x();
      const shapeY = shape.y();

      const screenX = containerRect.left + (shapeX * stageScale) + stagePos.x;
      const screenY = containerRect.top + (shapeY * stageScale) + stagePos.y;

      const shapeWidth = Math.max(shape.width() || shape.textWidth, 100);
      const shapeHeight = Math.max(shape.height() || shape.textHeight, fontSize * 1.2);
      const scaledWidth = shapeWidth * stageScale;
      const scaledHeight = shapeHeight * stageScale;

      editor.style.left = `${screenX}px`;
      editor.style.top = `${screenY}px`;
      editor.style.width = `${Math.max(60, scaledWidth)}px`;
      editor.style.height = `${Math.max(24, scaledHeight)}px`;

      editor.style.fontSize = `${fontSize * stageScale}px`;
    } catch (error) {
      console.warn('[openKonvaTextEditor] Error updating position:', error);
    }
  }

  updateEditorPosition();

  function autoResize() {
    const currentText = editor.value;
    if (currentText.length === 0) return;

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

    const minWidth = 60;
    const minHeight = 24;
    editor.style.width = `${Math.max(minWidth, measuredWidth + 10)}px`;
    editor.style.height = `${Math.max(minHeight, measuredHeight)}px`;
  }

  const onStageTransform = () => updateEditorPosition();
  stage.on('dragmove.text-editor', onStageTransform);
  stage.on('scaleXChange.text-editor scaleYChange.text-editor', onStageTransform);
  stage.on('xChange.text-editor yChange.text-editor', onStageTransform);

  const onWheel = () => {
    setTimeout(updateEditorPosition, 10);
  };
  stage.on('wheel.text-editor', onWheel);

  function cleanup() {
    try {
      editor.remove();
    } catch (error) {
      console.warn('[openKonvaTextEditor] Error removing editor:', error);
    }

    shape.opacity(originalOpacity);
    layer.batchDraw();

    stage.off('dragmove.text-editor');
    stage.off('scaleXChange.text-editor scaleYChange.text-editor');
    stage.off('xChange.text-editor yChange.text-editor');
    stage.off('wheel.text-editor');
  }

  function commit(save: boolean = true) {
    const newText = editor.value.trim();
    cleanup();

    if (save) {
      onCommit(newText);
    } else {
      onCancel?.();
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commit(false);
    } else {
      setTimeout(autoResize, 0);
    }
  };

  const onBlur = () => {
    setTimeout(() => commit(true), 100);
  };

  const onInput = () => {
    autoResize();
  };

  editor.addEventListener('keydown', onKeyDown);
  editor.addEventListener('blur', onBlur);
  editor.addEventListener('input', onInput);

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
      console.warn('[openKonvaTextEditor] Error focusing editor:', error);
    }
  }, 10);

  return cleanup;
}

export function computeTextBounds(text: Konva.Text): { x: number; y: number; width: number; height: number } {
  const clientRect = text.getClientRect({ skipTransform: false });
  return {
    x: clientRect.x,
    y: clientRect.y,
    width: Math.max(clientRect.width, 40),
    height: Math.max(clientRect.height, 24)
  };
}