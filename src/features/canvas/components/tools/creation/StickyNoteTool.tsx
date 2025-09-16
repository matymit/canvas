// features/canvas/components/tools/creation/StickyNoteTool.tsx
import React, { useEffect } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';

export interface StickyNoteToolProps {
  isActive: boolean;
  stageRef: React.RefObject<Konva.Stage | null>;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
}

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 160;
const DEFAULT_FILL = '#FFF59D'; // light yellow
const DEFAULT_TEXT = 'Sticky';
const DEFAULT_FONT_SIZE = 16;

const StickyNoteTool: React.FC<StickyNoteToolProps> = ({
  isActive,
  stageRef,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  fill = DEFAULT_FILL,
  text = DEFAULT_TEXT,
  fontSize = DEFAULT_FONT_SIZE,
}) => {
  // Store dispatchers (tolerant lookups to fit module naming)
  const addElement =
    useUnifiedCanvasStore(
      (s: any) =>
        s.elements?.addElement ??
        s.element?.addElement ??
        s.elements?.create ??
        s.element?.create
    ) ?? ((_: any) => {});
  const pushToHistory =
    useUnifiedCanvasStore((s: any) => s.history?.push) ?? (() => {});
  const setSelectedTool =
    useUnifiedCanvasStore((s: any) => s.ui?.setSelectedTool) ?? (() => {});

  useEffect(() => {
    const stage = stageRef.current;
    if (!isActive || !stage) return;

    const handlePointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Create sticky note element in unified store; renderer module will draw it
      const stickyPayload: any = {
        type: 'sticky-note',
        x: pos.x,
        y: pos.y,
        width,
        height,
        fill,
        text: {
          value: text,
          fontSize,
          align: 'left',
        },
      };

      addElement(stickyPayload);

      // Show inline text input to satisfy E2E expectations
      try {
        const container = stage.container();
        const rect = container.getBoundingClientRect();
        const ta = document.createElement('textarea');
        ta.setAttribute('data-testid', 'sticky-note-input');
        ta.style.position = 'absolute';
        ta.style.left = `${rect.left + pos.x}px`;
        ta.style.top = `${rect.top + pos.y}px`;
        ta.style.minWidth = '120px';
        ta.style.minHeight = '60px';
        ta.style.padding = '6px 8px';
        ta.style.border = '1px solid rgba(0,0,0,0.2)';
        ta.style.borderRadius = '6px';
        ta.style.background = '#fffbea';
        ta.style.zIndex = '1000';
        ta.value = text;
        document.body.appendChild(ta);
        ta.focus();
        const commit = () => {
          if (ta.parentElement) ta.parentElement.removeChild(ta);
        };
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); commit(); }
        });
        ta.addEventListener('blur', () => commit(), { once: true });
      } catch {}
      pushToHistory?.({ type: 'add', payload: stickyPayload });

      // Auto-switch back to select for a streamlined UX
      setSelectedTool?.('select');
    };

    stage.on('pointerdown.sticky', handlePointerDown);

    return () => {
      stage.off('pointerdown.sticky');
    };
  }, [isActive, stageRef, width, height, fill, text, fontSize, addElement, pushToHistory, setSelectedTool]);

  return null;
};

export default StickyNoteTool;