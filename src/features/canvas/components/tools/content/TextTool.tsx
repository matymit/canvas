import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { measureText } from '../../../utils/text/TextMeasurement';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TextToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'text'
}

function createTextarea(left: number, top: number, fontSize: number, color: string, fontFamily: string): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.setAttribute('data-testid', 'text-portal-input');
  ta.style.position = 'absolute';
  ta.style.left = `${left}px`;
  ta.style.top = `${top}px`;
  ta.style.minWidth = '4px';
  ta.style.width = '4px';
  ta.style.height = `${Math.round(fontSize * 1.2)}px`; // fixed single-line height
  ta.style.padding = '0px';
  ta.style.border = '0px';
  ta.style.borderRadius = '0px';
  ta.style.outline = 'none';
  ta.style.resize = 'none'; // no manual resize
  ta.style.cursor = 'text';
  ta.style.background = 'transparent';
  ta.style.color = color;
  ta.style.fontFamily = fontFamily;
  ta.style.fontSize = `${fontSize}px`;
  ta.style.lineHeight = '1.2';
  ta.style.zIndex = '1000';
  ta.style.boxShadow = 'none';
  ta.style.pointerEvents = 'auto';
  ta.style.whiteSpace = 'nowrap';
  ta.style.overflow = 'hidden';
  return ta;
}

export const TextTool: React.FC<TextToolProps> = ({ isActive, stageRef, toolId = 'text' }) => {
  const selectedTool = useUnifiedCanvasStore((s: any) => s.selectedTool ?? s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s: any) => s.setSelectedTool ?? s.ui?.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s: any) => s.element?.upsert ?? s.elements?.addElement);
  const withUndo = useUnifiedCanvasStore((s: any) => s.history?.withUndo);
  const fillColor = useUnifiedCanvasStore((s: any) => s.fillColor ?? s.ui?.fillColor ?? '#111827');
  const fontSize = 18;
  const fontFamily = 'Inter, system-ui, sans-serif';

  const activeEditorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && (selectedTool === toolId);
    if (!stage || !active) return;

    const onStageClick = (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!isActive || activeEditorRef.current || selectedTool !== toolId) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const rect = stage.container().getBoundingClientRect();
      const left = rect.left + pos.x;
      const top = rect.top + pos.y;

      const ta = createTextarea(left, top, fontSize, fillColor, fontFamily);
      document.body.appendChild(ta);
      activeEditorRef.current = ta;
      ta.focus();

      const updateSize = () => {
        const text = ta.value || '';
        const m = measureText({ text, fontFamily, fontSize });
        ta.style.width = `${Math.max(1, Math.ceil(m.width))}px`;
        ta.style.height = `${Math.round(fontSize * 1.2)}px`;
      };

      updateSize();
      ta.addEventListener('input', updateSize);

      const commit = (cancel = false) => {
        const value = (ta.value || '').trim();
        ta.removeEventListener('input', updateSize);
        try { ta.remove(); } catch {}
        if (activeEditorRef.current === ta) activeEditorRef.current = null;

        if (!cancel && value.length > 0) {
          const m = measureText({ text: value, fontFamily, fontSize });
          const width = Math.max(1, Math.ceil(m.width));
          const height = Math.round(fontSize * 1.2); // fixed single-line height

          const commitFn = () => {
            upsertElement?.({
              id: crypto.randomUUID(),
              type: 'text',
              x: pos.x,
              y: pos.y,
              width,
              height,
              text: value,
              style: { fill: fillColor, fontFamily, fontSize },
              bounds: { x: pos.x, y: pos.y, width, height },
            } as any);
          };

          if (withUndo) withUndo('Insert text', commitFn); else commitFn();
        }

        setSelectedTool?.('select');
      };

      ta.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          commit(false);
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          commit(true);
        }
      });

      ta.addEventListener('blur', () => commit(false), { once: true });

      e.cancelBubble = true;
    };

    stage.on('click.texttool', onStageClick);

    return () => {
      stage.off('click.texttool', onStageClick as any);
      const existing = activeEditorRef.current;
      if (existing) {
        try { existing.remove(); } catch {}
        activeEditorRef.current = null;
      }
    };
  }, [isActive, selectedTool, toolId, stageRef, fillColor, fontSize, fontFamily, upsertElement, setSelectedTool, withUndo]);

  return null;
};

export default TextTool;
