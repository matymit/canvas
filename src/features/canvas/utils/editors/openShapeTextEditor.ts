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
  console.log('[openShapeTextEditor] ENTRY - elementId:', elementId, 'options:', options);

  const store = useUnifiedCanvasStore.getState();
  console.log('[openShapeTextEditor] Store retrieved, checking for element...');

  const element = store.elements.get(elementId);
  console.log('[openShapeTextEditor] Element from store:', element ? 'Found' : 'NOT FOUND', element?.type);

  if (!element || !['rectangle', 'circle', 'triangle', 'ellipse'].includes(element.type)) {
    console.log('[openShapeTextEditor] EARLY RETURN - Invalid element or type:', element?.type);
    return () => {};
  }

  console.log('[openShapeTextEditor] Element validation passed, type:', element.type);

  const shapeElement = element;
  console.log('[openShapeTextEditor] Getting stage container...');
  const container = stage.container();
  if (!container) {
    console.log('[openShapeTextEditor] EARLY RETURN - No stage container found');
    return () => {};
  }

  console.log('[openShapeTextEditor] Container found, proceeding with text node lookup...');

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

  // CRITICAL FIX: Race condition fix - retry if text node doesn't exist yet
  console.log('[openShapeTextEditor] Looking for text node with ID:', `#${elementId}-text`);
  console.log('[openShapeTextEditor] Stage.findOne function available:', typeof stage.findOne === 'function');

  let textNode: Konva.Node | null = null;
  if (typeof stage.findOne === 'function') {
    // First try the ID-based lookup
    textNode = stage.findOne(`#${elementId}-text`) as any;
    if (!textNode && typeof stage.find === 'function') {
      // Fallback: find node with matching elementId and shape-text nodeType
      const candidates = stage.find((n: any) => n.getAttr && n.getAttr('elementId') === elementId && n.getAttr('nodeType') === 'shape-text-root');
      textNode = candidates && candidates.length > 0 ? (candidates[0] as any) : null;
    }
  }

  console.log('[openShapeTextEditor] Text node lookup result:', textNode ? 'FOUND' : 'NOT FOUND');
  console.log('[openShapeTextEditor] Retry count:', _retryCount);

  // If text node doesn't exist, retry after allowing time for ShapeRenderer subscription to process
  if (!textNode) {
    console.log('[openShapeTextEditor] Text node not found, checking retry logic...');
    // Race condition fix: retry up to 3 times with 50ms delay to allow ShapeRenderer subscription to process
    if (_retryCount < 3) {
      console.log('[openShapeTextEditor] Scheduling retry', _retryCount + 1, 'in 50ms...');
      setTimeout(() => openShapeTextEditor(stage, elementId, {
        ...options,
        _retryCount: _retryCount + 1
      }), 50);
      return () => {};
    }
    // If retries exceeded, return empty cleanup function
    console.log('[openShapeTextEditor] GIVING UP - Max retries exceeded, text node still not found');
    return () => {};
  }

  console.log('[openShapeTextEditor] Text node found! Proceeding with editor setup...');

  console.log('[openShapeTextEditor] Step 1: Hiding original text node...');
  const originalTextNodeOpacity = textNode?.opacity();
  const originalTextNodeVisible = textNode?.visible();
  const originalTextNodeListening = textNode?.listening();
  try {
    if (textNode) {
      console.log('[openShapeTextEditor] Modifying text node properties...');
      textNode.opacity(0);
      textNode.visible(false);
      textNode.listening(false);
      console.log('[openShapeTextEditor] Getting text node layer for batchDraw...');
      const layer = textNode.getLayer();
      console.log('[openShapeTextEditor] Layer found:', layer ? 'YES' : 'NO');
      if (layer) {
        console.log('[openShapeTextEditor] Calling layer.batchDraw()...');
        layer.batchDraw();
        console.log('[openShapeTextEditor] layer.batchDraw() completed successfully');
      }
    }
    console.log('[openShapeTextEditor] Text node hiding completed successfully');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR hiding text node:', error);
  }

  console.log('[openShapeTextEditor] Step 2: Creating DOM editor element...');
  let editor: HTMLDivElement;
  try {
    editor = document.createElement('div');
    console.log('[openShapeTextEditor] DOM editor element created successfully:', editor);
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR creating DOM editor element:', error);
    throw error;
  }
  console.log('[openShapeTextEditor] Step 3: Setting editor attributes...');
  try {
    editor.contentEditable = 'true';
    console.log('[openShapeTextEditor] contentEditable set to true');
    editor.setAttribute('data-shape-text-editor', elementId);
    console.log('[openShapeTextEditor] data-shape-text-editor attribute set');
    editor.setAttribute('role', 'textbox');
    console.log('[openShapeTextEditor] role attribute set');
    editor.setAttribute('aria-label', 'Shape text editor');
    console.log('[openShapeTextEditor] aria-label attribute set');
    console.log('[openShapeTextEditor] All editor attributes set successfully');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR setting editor attributes:', error);
  }

  console.log('[openShapeTextEditor] Step 4: Creating editor styles object...');
  // Enhanced caret visibility and blue border styling to match selection frame
  const editorStyles = {
    position: 'absolute',
    zIndex: '1000',
    minWidth: '1px',
    outline: 'none !important',
    border: '2px solid #4F46E5 !important',
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
    // Blue border to match selection frame
    borderStyle: 'solid !important',
    borderWidth: '2px !important',
    borderColor: '#4F46E5 !important',
    outlineStyle: 'none !important',
    outlineWidth: '0 !important',
    outlineColor: 'transparent !important',
    outlineOffset: '0 !important',
    // Blue border in all states
    borderTopColor: '#4F46E5 !important',
    borderRightColor: '#4F46E5 !important',
    borderBottomColor: '#4F46E5 !important',
    borderLeftColor: '#4F46E5 !important',
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

  // Apply styles based on shape type - CRITICAL FIX: Use padding-based centering instead of flexbox/line-height
  if (isCircle) {
    Object.assign(editorStyles, {
      display: 'block', // Keep block display for proper caret rendering
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      padding: `${getCirclePadding()}px`,
      minHeight: '1px',
      // CRITICAL FIX: Use consistent line-height, let padding handle vertical centering
      lineHeight: `${lineHeight}`,
      verticalAlign: 'top', // Ensure consistent baseline
      boxSizing: 'border-box', // Ensure padding doesn't affect centering calculations
      // CRITICAL FIX: Prevent line-height conflicts that cause caret malformation
      maxHeight: '100%',
      overflowY: 'hidden' // Prevent scrolling that could interfere with centering
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

  console.log('[openShapeTextEditor] Step 5: Applying styles to editor...');
  try {
    // Apply styles to editor
    Object.assign(editor.style, editorStyles);
    console.log('[openShapeTextEditor] Styles applied successfully to editor');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR applying styles:', error);
  }

  console.log('[openShapeTextEditor] Step 6: Setting editor text content...');
  const currentText = (typeof shapeSnapshot.data?.text === 'string' ? shapeSnapshot.data.text : '') || '';
  let latestEditorText = currentText;
  console.log('[openShapeTextEditor] Current text value:', currentText);

  try {
    if (currentText) {
      editor.textContent = currentText;
      console.log('[openShapeTextEditor] Text content set to existing text');
    } else {
      editor.textContent = ZERO_WIDTH_SPACE;
      console.log('[openShapeTextEditor] Text content set to ZERO_WIDTH_SPACE');
    }
    console.log('[openShapeTextEditor] Editor text content set successfully');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR setting text content:', error);
  }

  console.log('[openShapeTextEditor] Step 7: Appending editor to document body...');
  try {
    document.body.appendChild(editor);
    console.log('[openShapeTextEditor] Editor appended to document body successfully');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR appending editor to body:', error);
    throw error;
  }

  console.log('[openShapeTextEditor] Step 7.1: Adding blue border styling...');
  try {
    // Advanced CSS property override using setProperty with important flag
    editor.style.setProperty('border', '2px solid #4F46E5', 'important');
    editor.style.setProperty('outline', 'none', 'important');
    editor.style.setProperty('box-shadow', 'none', 'important');
    editor.style.setProperty('border-color', '#4F46E5', 'important');
    editor.style.setProperty('outline-color', 'transparent', 'important');

    // Create dynamic stylesheet for pseudo-class overrides with blue border
    const dynamicStyleId = `shape-editor-style-${elementId}`;
    const existingStyle = document.getElementById(dynamicStyleId);
    if (!existingStyle) {
      const styleElement = document.createElement('style');
      styleElement.id = dynamicStyleId;
      styleElement.textContent = `
        [data-shape-text-editor="${elementId}"]:focus,
        [data-shape-text-editor="${elementId}"]:active,
        [data-shape-text-editor="${elementId}"]:hover,
        [data-shape-text-editor="${elementId}"]:focus-visible {
          border: 2px solid #4F46E5 !important;
          outline: none !important;
          box-shadow: none !important;
          border-color: #4F46E5 !important;
          outline-color: transparent !important;
        }
      `;
      document.head.appendChild(styleElement);
      console.log('[openShapeTextEditor] Dynamic stylesheet created for element:', elementId);
    }

    console.log('[openShapeTextEditor] Blue border styling applied successfully');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR applying blue border styling:', error);
  }

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
        // CRITICAL FIX: Use consistent line-height and padding-based centering
        const containerHeight = finalHeight;
        const scaledPadding = Math.max(0, getCirclePadding() * stageScale);

        // CRITICAL FIX: Use consistent line-height that works for both single and multi-line text
        const consistentLineHeight = effectiveFontSize * lineHeight;
        editor.style.lineHeight = `${consistentLineHeight}px`;

        // CRITICAL FIX: Calculate vertical centering using top padding only
        const contentAreaHeight = containerHeight - (scaledPadding * 2);
        const estimatedTextHeight = consistentLineHeight; // Start with single-line height

        // Only adjust vertical centering for single-line scenarios
        // For multi-line, let natural text flow handle the layout
        const currentTextLength = latestEditorText.length;
        const isLikelyMultiLine = currentTextLength > 20 || latestEditorText.includes('\n');

        if (!isLikelyMultiLine && contentAreaHeight > estimatedTextHeight) {
          // Single-line centering: add extra top padding
          const verticalOffset = Math.round((contentAreaHeight - estimatedTextHeight) / 2);
          editor.style.paddingTop = `${Math.round(scaledPadding + verticalOffset)}px`;
          editor.style.paddingBottom = `${Math.round(scaledPadding)}px`;
          editor.style.paddingLeft = `${Math.round(scaledPadding)}px`;
          editor.style.paddingRight = `${Math.round(scaledPadding)}px`;
        } else {
          // Multi-line or tight fit: use uniform padding
          editor.style.padding = `${Math.round(scaledPadding)}px`;
        }
      }
    } catch (error) {
      console.warn('[openShapeTextEditor] Error updating position:', error);
    }
  }

  console.log('[openShapeTextEditor] Step 8: Calculating initial editor position...');
  try {
    updateEditorPosition();
    console.log('[openShapeTextEditor] Initial position calculation successful');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR during initial position calculation:', error);
  }

  let isCleaning = false;

  console.log('[openShapeTextEditor] Step 9: Setting up stage event listeners...');
  const onStageTransform = () => updateEditorPosition();
  try {
    if (typeof stage.on === 'function') {
      console.log('[openShapeTextEditor] Attaching stage event listeners...');
      stage.on('dragmove.shape-text-editor', onStageTransform);
      stage.on('scaleXChange.shape-text-editor scaleYChange.shape-text-editor', onStageTransform);
      stage.on('xChange.shape-text-editor yChange.shape-text-editor', onStageTransform);
      console.log('[openShapeTextEditor] Stage event listeners attached successfully');
    } else {
      console.log('[openShapeTextEditor] WARNING: stage.on is not a function');
    }
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR attaching stage event listeners:', error);
  }

  console.log('[openShapeTextEditor] Step 10: Setting up global pointer listener...');
  const handleGlobalPointerDown = (event: PointerEvent) => {
    if (!editor.contains(event.target as Node)) {
      commit(true);
    }
  };
  try {
    window.addEventListener('pointerdown', handleGlobalPointerDown, true);
    console.log('[openShapeTextEditor] Global pointer listener attached successfully');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR attaching global pointer listener:', error);
  }

  function cleanup() {
    if (isCleaning) return;
    isCleaning = true;
    try {
      editor.remove();
    } catch (error) {
      console.warn('[openShapeTextEditor] Error removing editor:', error);
    }

    // Remove dynamic stylesheet
    try {
      const dynamicStyleId = `shape-editor-style-${elementId}`;
      const styleElement = document.getElementById(dynamicStyleId);
      if (styleElement) {
        styleElement.remove();
        console.log('[openShapeTextEditor] Dynamic stylesheet removed');
      }
    } catch (error) {
      console.warn('[openShapeTextEditor] Error removing stylesheet:', error);
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
      editor.offsetHeight; // Force reflow to ensure text is rendered
    });
  };

  const onBlur = () => {
    setTimeout(() => commit(true), 100);
  };

  console.log('[openShapeTextEditor] Step 11: Attaching editor event listeners...');
  try {
    editor.addEventListener('keydown', onKeyDown);
    console.log('[openShapeTextEditor] Editor keydown listener attached');
    window.addEventListener('keydown', onKeyDown, true);
    console.log('[openShapeTextEditor] Window keydown listener attached');
    editor.addEventListener('input', onInput);
    console.log('[openShapeTextEditor] Editor input listener attached');
    editor.addEventListener('blur', onBlur);
    console.log('[openShapeTextEditor] Editor blur listener attached');
    console.log('[openShapeTextEditor] All editor event listeners attached successfully');
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR attaching editor event listeners:', error);
  }

  // CRITICAL FIX: Enhanced focus strategy with guaranteed caret visibility
  console.log('[openShapeTextEditor] Step 12: Preparing focus functions...');
  const focusEditor = () => {
    try {
      console.log('[openShapeTextEditor] Attempting to focus editor...');
      editor.focus();
      console.log('[openShapeTextEditor] Editor.focus() called successfully');

      if (currentText) {
        console.log('[openShapeTextEditor] Setting selection for existing text...');
        const selection = window.getSelection();
        if (selection && editor.firstChild) {
          const range = document.createRange();
          const node = editor.firstChild;
          const length = node.textContent ? node.textContent.length : 0;
          range.setStart(node, length);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          console.log('[openShapeTextEditor] Selection set for existing text');
        }
      } else {
        console.log('[openShapeTextEditor] Setting selection for empty text...');
        const selection = window.getSelection();
        if (selection && editor.firstChild) {
          const range = document.createRange();
          const targetNode = editor.firstChild;
          const initialOffset = targetNode.textContent ? targetNode.textContent.length : 0;
          range.setStart(targetNode, initialOffset);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          console.log('[openShapeTextEditor] Selection set for empty text');
        }
      }
      console.log('[openShapeTextEditor] focusEditor completed successfully');
    } catch (error) {
      console.log('[openShapeTextEditor] ERROR in focusEditor:', error);
    }
  };

  // FIXED: Simplified caret visibility without display toggling
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

    // FIXED: Force visual refresh without display toggling
    editor.offsetHeight; // Force reflow
  };

  console.log('[openShapeTextEditor] Step 13: Executing SIMPLIFIED focus strategy for shape type:', shapeSnapshot.type);
  try {
    // FIXED: Simplified focus strategy without complex blur/refocus cycles
    editor.offsetHeight; // Force layout
    console.log('[openShapeTextEditor] Forced initial layout');

    // Simple, reliable focus sequence
    requestAnimationFrame(() => {
      console.log('[openShapeTextEditor] RAF - ensuring caret visibility and focusing...');
      ensureCaretVisibility();
      focusEditor();

      // Single backup focus attempt
      setTimeout(() => {
        if (document.activeElement !== editor) {
          console.log('[openShapeTextEditor] Backup focus attempt...');
          ensureCaretVisibility();
          focusEditor();
        } else {
          console.log('[openShapeTextEditor] Editor successfully focused!');
        }
      }, 50);
    });
  } catch (error) {
    console.log('[openShapeTextEditor] ERROR in simplified focus sequence:', error);
  }

  console.log('[openShapeTextEditor] EDITOR SETUP COMPLETE - returning cleanup function');

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