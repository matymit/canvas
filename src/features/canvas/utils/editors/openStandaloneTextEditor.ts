// Opens a DOM overlay editor for creating standalone text elements
// Handles world-to-screen coordinate conversion and live updates during pan/zoom operations

import type Konva from 'konva';

type EditorOpts = {
  stage: Konva.Stage;
  worldX: number;
  worldY: number;
  onCommit: (text: string, worldX: number, worldY: number) => void;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
};

export function openStandaloneTextEditor({
  stage,
  worldX,
  worldY,
  onCommit,
  fontFamily = 'Inter, system-ui, sans-serif',
  fontSize = 18,
  color = '#111827'
}: EditorOpts) {
  const container = stage.container();

  // Create the editor element
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.style.position = 'absolute';
  editor.style.zIndex = '10';
  editor.style.minWidth = '10px';
  editor.style.minHeight = '24px';
  editor.style.outline = 'none';
  editor.style.whiteSpace = 'pre-wrap';
  editor.style.wordBreak = 'break-word';
  editor.style.padding = '4px';
  editor.style.background = 'transparent';
  editor.style.color = color;
  editor.style.fontFamily = fontFamily;
  editor.style.fontSize = `${fontSize}px`;
  editor.style.lineHeight = '1.2';
  editor.style.transformOrigin = '0 0';
  // Border will be handled by global CSS to match selection frame
  editor.setAttribute('data-standalone-text-editor', 'true');
  editor.style.borderRadius = '2px';

  // Initialize with empty text
  editor.innerText = '';
  container.appendChild(editor);

  function placeEditor() {
    const scaleX = stage.scaleX();
    const scaleY = stage.scaleY();
    const stagePos = stage.position();

    // Convert world coordinates to screen coordinates
    const screenX = worldX * scaleX + stagePos.x;
    const screenY = worldY * scaleY + stagePos.y;

    editor.style.left = `${screenX}px`;
    editor.style.top = `${screenY}px`;
    editor.style.transform = `scale(${Math.min(scaleX, scaleY)})`;
  }

  placeEditor();

  // Listen for stage transform changes to keep editor positioned correctly
  const sync = () => placeEditor();
  stage.on('dragmove.text-editor wheel.text-editor', sync);
  stage.on('xChange.text-editor yChange.text-editor scaleXChange.text-editor scaleYChange.text-editor', sync);

  const finish = (commit: boolean) => {
    const value = editor.innerText.trim();
    cleanup();
    if (commit && value.length > 0) {
      onCommit(value, worldX, worldY);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    } else {
      // Auto-resize on input
      requestAnimationFrame(() => {
        const rect = editor.getBoundingClientRect();
        if (rect.width < 300) { // Limit max width
          editor.style.minWidth = `${Math.max(50, editor.scrollWidth)}px`;
        }
        if (rect.height < 200) { // Limit max height
          editor.style.minHeight = `${Math.max(24, editor.scrollHeight)}px`;
        }
      });
    }
  };

  const onBlur = () => finish(true);

  editor.addEventListener('keydown', onKey);
  editor.addEventListener('blur', onBlur);

  // Focus and place cursor at end
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  editor.focus();

  function cleanup() {
    editor.removeEventListener('keydown', onKey);
    editor.removeEventListener('blur', onBlur);
    stage.off('dragmove.text-editor');
    stage.off('wheel.text-editor');
    stage.off('xChange.text-editor yChange.text-editor scaleXChange.text-editor scaleYChange.text-editor');
    editor.remove();
  }
}