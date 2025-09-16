import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TextToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'text'
}

function placeTextarea(container: HTMLElement, x: number, y: number, fontSize: number, color: string): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.setAttribute('data-testid', 'text-portal-input');
  ta.style.position = 'absolute';
  ta.style.left = `${x}px`;
  ta.style.top = `${y}px`;
  ta.style.minWidth = '120px';
  ta.style.minHeight = '28px';
  ta.style.padding = '4px 6px';
  ta.style.border = '1px solid rgba(0,0,0,0.15)';
  ta.style.borderRadius = '6px';
  ta.style.outline = 'none';
  ta.style.resize = 'both';
  ta.style.background = '#ffffff';
  ta.style.color = color;
  ta.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ta.style.fontSize = `${fontSize}px`;
  ta.style.lineHeight = '1.3';
  ta.style.zIndex = '1000';
  container.appendChild(ta);
  return ta;
}

export const TextTool: React.FC<TextToolProps> = ({ isActive, stageRef, toolId = 'text' }) => {
  const selectedTool = useUnifiedCanvasStore((s: any) => s.selectedTool ?? s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s: any) => s.setSelectedTool ?? s.ui?.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s: any) => s.element?.upsert ?? s.elements?.addElement);
  const fillColor = useUnifiedCanvasStore((s: any) => s.fillColor ?? s.ui?.fillColor ?? '#111');
  const fontSize = 18; // could be from UI state later
  const fontFamily = 'Inter';

  const activeEditorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && (selectedTool === toolId);
    if (!stage || !active) return;

    const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      // prevent starting multiple editors
      if (activeEditorRef.current) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Position textarea relative to the stage container in page coordinates
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const left = rect.left + pos.x;
      const top = rect.top + pos.y;

      const ta = placeTextarea(document.body, left, top, fontSize, fillColor);
      activeEditorRef.current = ta;
      ta.focus();

      const commit = (cancel = false) => {
        const value = ta.value.trim();
        // Cleanup overlay
        if (ta.parentElement) ta.parentElement.removeChild(ta);
        activeEditorRef.current = null;

        if (!cancel && value.length > 0) {
          // Commit to store; renderer will draw text on main layer
          const textElement = {
            id: crypto.randomUUID(),
            type: 'text',
            x: pos.x,
            y: pos.y,
            width: 100,
            height: 30,
            visible: true,
            locked: false,
            bounds: { x: pos.x, y: pos.y, width: 100, height: 30 },
            text: value,
            fill: fillColor,
            fontSize,
            fontFamily,
          };
          upsertElement(textElement as any);
        }

        // Auto-switch back to select
        try { setSelectedTool?.('select'); } catch {}
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

      // prevent Konva from also handling this
      e.cancelBubble = true;
    };

    stage.on('pointerdown.texttool', onPointerDown);

    return () => {
      stage.off('pointerdown.texttool');
      const existing = activeEditorRef.current;
      if (existing && existing.parentElement) {
        existing.parentElement.removeChild(existing);
      }
      activeEditorRef.current = null;
    };
  }, [isActive, selectedTool, toolId, stageRef, fillColor, fontSize, fontFamily, upsertElement, setSelectedTool]);

  return null;
};

export default TextTool;