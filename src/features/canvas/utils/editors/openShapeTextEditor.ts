import type Konva from 'konva';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import {
  computeShapeInnerBox,
  type BaseShape
} from '../text/computeShapeInnerBox';
import {
  applyVendorAppearanceReset,
  applyVendorTextFillColor,
  applyVendorTextStrokeReset
} from '../text/vendorStyles';
import type { ElementId } from '../../../../../types';

const ZERO_WIDTH_SPACE = '\u200B';
const ZERO_WIDTH_REGEX = /\u200B/g;

export interface ShapeTextEditorOptions {
  padding?: number;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  textColor?: string;
  _retryCount?: number; // Internal parameter for race condition handling
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

  if (!element || !['rectangle', 'circle', 'triangle', 'ellipse'].includes(element.type)) {
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
    textColor = '#111827',
    _retryCount = 0
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

  let textNode: Konva.Node | null = null;
  if (typeof stage.findOne === 'function') {
    // First try the ID-based lookup
    const directMatch = stage.findOne<Konva.Node>(`#${elementId}-text`);
    if (directMatch) {
      textNode = directMatch;
    } else if (typeof stage.find === 'function') {
      // Fallback: find node with matching elementId and shape-text nodeType
      const candidatesRaw = stage.find((node: Konva.Node) => {
        const elementAttr = node.getAttr<string | undefined>('elementId');
        const nodeTypeAttr = node.getAttr<string | undefined>('nodeType');
        return elementAttr === elementId && nodeTypeAttr === 'shape-text-root';
      });
      const candidates = Array.isArray(candidatesRaw)
        ? (candidatesRaw as Konva.Node[])
        : typeof (candidatesRaw as { toArray?: () => Konva.Node[] }).toArray ===
            'function'
          ? (candidatesRaw as { toArray: () => Konva.Node[] }).toArray()
          : [];
      textNode = candidates.length > 0 ? candidates[0] : null;
    }
  }

  // If text node doesn't exist, retry after allowing time for ShapeRenderer subscription to process
  if (!textNode) {
    // Race condition fix: retry up to 3 times with 50ms delay to allow ShapeRenderer subscription to process
    if (_retryCount < 3) {
      setTimeout(() => openShapeTextEditor(stage, elementId, {
        ...options,
        _retryCount: _retryCount + 1
      }), 50);
      return () => {};
    }
    // If retries exceeded, return empty cleanup function
    return () => {};
  }

  const originalTextNodeOpacity = textNode?.opacity();
  const originalTextNodeVisible = textNode?.visible();
  const originalTextNodeListening = textNode?.listening();
  try {
    if (textNode) {
      textNode.opacity(0);
      textNode.visible(false);
      textNode.listening(false);
      const layer = textNode.getLayer();
      if (layer) {
        layer.batchDraw();
      }
    }
  } catch (error) {
    // Ignore error
  }

  const wrapper: HTMLDivElement = document.createElement('div');
  wrapper.setAttribute('data-shape-text-editor-wrapper', elementId);
  wrapper.setAttribute('role', 'presentation');

  const editor: HTMLDivElement = document.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('data-shape-text-editor', elementId);
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', 'Shape text editor');

  const wrapperStyles = {
    position: 'absolute',
    zIndex: '1000',
    minWidth: '1px',
    minHeight: '1px',
    outline: 'none',
    border: 'none',
    borderRadius: '0',
    background: 'transparent',
    boxSizing: 'border-box',
    boxShadow: 'none',
    pointerEvents: 'auto',
    overflow: 'hidden',
    transform: 'translateZ(0)',
    willChange: 'transform',
    display: 'block'
  };

  const editorStyles = {
    position: 'relative',
    display: 'block',
    maxWidth: '100%',
    minWidth: '1px',
    margin: '0',
    outline: 'none !important',
    border: 'none !important',
    borderRadius: '0',
    background: 'transparent',
    color: textColor,
    fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight: `${fontSize * lineHeight}px`,
    boxSizing: 'border-box',
    boxShadow: 'none !important',
    cursor: 'text',
    caretColor: `${textColor} !important`,
    borderStyle: 'none !important',
    borderWidth: '0 !important',
    borderColor: 'transparent !important',
    outlineStyle: 'none !important',
    outlineWidth: '0 !important',
    outlineColor: 'transparent !important',
    outlineOffset: '0 !important',
    appearance: 'none',
    textShadow: 'none',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    padding: '0',
    transform: 'translateZ(0)',
    willChange: 'contents',
    maxHeight: '100%',
    overflowY: 'hidden',
    minHeight: `${fontSize * lineHeight}px`
  };

  if (isCircle) {
    Object.assign(wrapperStyles, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    Object.assign(editorStyles, {
      minHeight: '1px',
      textAlign: 'center',
      padding: `${getCirclePadding()}px`
    });
  } else if (isTriangle) {
    Object.assign(editorStyles, {
      textAlign: 'center',
      padding: `${Math.max(0, effectivePadding * 0.25)}px`
    });
  } else {
    Object.assign(editorStyles, {
      textAlign: 'center',
      padding: `${Math.max(0, effectivePadding * 0.25)}px`
    });
  }

  Object.assign(wrapper.style, wrapperStyles);
  Object.assign(editor.style, editorStyles);
  applyVendorTextFillColor(editor.style, textColor);
  applyVendorAppearanceReset(editor.style);

  const currentText = (typeof shapeSnapshot.data?.text === 'string' ? shapeSnapshot.data.text : '') || '';
  let latestEditorText = currentText;

  if (currentText) {
    editor.textContent = currentText;
  } else {
    editor.textContent = ZERO_WIDTH_SPACE;
  }

  wrapper.appendChild(editor);
  document.body.appendChild(wrapper);

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

      wrapper.style.left = `${Math.round(screenX)}px`;
      wrapper.style.top = `${Math.round(screenY)}px`;

      const finalWidth = Math.max(1, Math.round(scaledWidth));
      const finalHeight = Math.max(1, Math.round(scaledHeight));

      wrapper.style.width = `${finalWidth}px`;
      wrapper.style.height = `${finalHeight}px`;

      const effectiveFontSize = stageScale >= 1
        ? Math.max(Math.round(fontSize * stageScale), fontSize)
        : fontSize;
      editor.style.fontSize = `${effectiveFontSize}px`;

      editor.style.lineHeight = `${effectiveFontSize * lineHeight}px`;

      if (isCircle) {
        const scaledPadding = Math.max(0, getCirclePadding() * stageScale);
        editor.style.padding = `${Math.round(scaledPadding)}px`;
      }
    } catch (error) {
      // Ignore error
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
    if (!wrapper.contains(event.target as Node)) {
      commit(true);
    }
  };
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);

  function cleanup() {
    if (isCleaning) return;
    isCleaning = true;
    try {
      wrapper.remove();
    } catch (error) {
      // Ignore error
    }

    // Remove dynamic stylesheet
    try {
      const dynamicStyleId = `shape-editor-style-${elementId}`;
      const styleElement = document.getElementById(dynamicStyleId);
      if (styleElement) {
        styleElement.remove();
      }
    } catch (error) {
      // Ignore error
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

    // CRITICAL FIX: Update position/padding when text content changes to handle single/multi-line transitions
    if (isCircle) {
      updateEditorPosition();
    }

    // FIXED: Force visual refresh after text input to ensure text appears immediately
    requestAnimationFrame(() => {
      void editor.offsetHeight; // Force reflow to ensure text is rendered
    });
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
      // Ignore error
    }
  };

  // FIXED: Simplified caret visibility without display toggling
  const ensureCaretVisibility = () => {
    // Force caret color and text rendering
    editor.style.caretColor = textColor;
    applyVendorTextFillColor(editor.style, textColor);

    // Additional browser-specific caret fixes
    if (navigator.userAgent.includes('Chrome')) {
      // Chrome-specific caret visibility
      applyVendorTextStrokeReset(editor.style);
    }

    // FIXED: Force visual refresh without display toggling
  void editor.offsetHeight; // Force reflow
  };

  // FIXED: Simplified focus strategy without complex blur/refocus cycles
  void editor.offsetHeight; // Force layout

  // Simple, reliable focus sequence
  requestAnimationFrame(() => {
    ensureCaretVisibility();
    focusEditor();

    // Single backup focus attempt
    setTimeout(() => {
      if (document.activeElement !== editor) {
        ensureCaretVisibility();
        focusEditor();
      } else {
        // Ignore
      }
    }, 50);
  });

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

  // Blue border styling to match selection frame
  const editorStyles = {
    position: 'absolute',
    zIndex: '1000',
    minWidth: '20px',
    minHeight: '20px',
    // No border - selection frame should be visible
    outline: 'none !important',
    border: 'none !important',
    outlineStyle: 'none !important',
    outlineWidth: '0 !important',
    outlineColor: 'transparent !important',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.95)',
    color: fill as string,
    fontFamily: fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight: '1.2',
    padding: '4px',
    resize: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    transformOrigin: '0 0',
    boxSizing: 'border-box',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    // CRITICAL: Enhanced caret visibility
    caretColor: fill as string,
    webkitTextFillColor: fill as string,
    // Additional browser-specific resets
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
      // Ignore error
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
      // Ignore error
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
      // Ignore error
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
