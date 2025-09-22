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

  // CRITICAL FIX: Enhanced caret visibility for circles and clean styling for all shapes
  editor.style.cssText = `
    position: absolute;
    z-index: 1000;
    min-width: 1px;
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
    /* CRITICAL FIX: Ensure caret visibility across all browsers */
    caret-color: ${textColor} !important;
    -webkit-text-fill-color: ${textColor} !important;
    /* Remove any unwanted borders or dashed frames */
    border: none !important;
    outline: none !important;
    ${isCircle ? `
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      padding: ${getCirclePadding()}px;
      min-height: 1px;
      /* Enhanced caret visibility specifically for circles */
      text-shadow: none;
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
      // Error updating position
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
      // Error removing editor
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
      // Error focusing editor
    }
  };

  // CRITICAL FIX: Multi-strategy focus with enhanced caret visibility for circles
  if (isCircle) {
    // Force layout and render
    editor.offsetHeight;

    // Enhanced focus sequence for circles
    requestAnimationFrame(() => {
      focusEditor();
      
      // Additional focus strategies specifically for circle text caret visibility
      requestAnimationFrame(() => {
        // Force caret color and text rendering
        editor.style.caretColor = textColor;
        editor.style.webkitTextFillColor = textColor;
        
        // Ensure focus and caret are properly set
        editor.blur();
        setTimeout(() => {
          focusEditor();
          
          // Final caret visibility check
          setTimeout(() => {
            if (document.activeElement !== editor) {
              focusEditor();
            }
          }, 50);
        }, 10);
      });
    });
  } else {
    // Standard focus strategy for rectangles and triangles
    focusEditor();
    setTimeout(focusEditor, 10);
    requestAnimationFrame(focusEditor);
  }

  return cleanup;
}

/**
 * CRITICAL FIX: Legacy text editor with clean styling (no dashed blue frames)
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

  // CRITICAL FIX: Clean styling without dashed blue frame
  editor.style.position = 'absolute';
  editor.style.zIndex = '1000';
  editor.style.minWidth = '20px';
  editor.style.minHeight = '20px';
  editor.style.outline = 'none';
  // REMOVED: Dashed blue border that was causing visual issues
  editor.style.border = 'none';
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
  // CRITICAL: Ensure caret is visible
  editor.style.caretColor = fill as string;

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
      // Error updating position
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
      // Error removing editor
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
      // Error focusing editor
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