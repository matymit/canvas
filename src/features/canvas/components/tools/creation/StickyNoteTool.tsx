// features/canvas/components/tools/creation/StickyNoteTool.tsx
import React, { useEffect, useRef } from 'react';
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

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;
const DEFAULT_FILL = '#FFF59D'; // light yellow
const DEFAULT_TEXT = 'Sticky';
const DEFAULT_FONT_SIZE = 16;

const StickyNoteTool: React.FC<StickyNoteToolProps> = ({
  isActive,
  stageRef,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  fill,
  text = DEFAULT_TEXT,
  fontSize = DEFAULT_FONT_SIZE,
}) => {
  // Get the selected sticky note color from the store
  const selectedStickyNoteColor = useUnifiedCanvasStore((s: any) => s.stickyNoteColor || s.colors?.stickyNote || DEFAULT_FILL);
  const actualFill = fill ?? selectedStickyNoteColor;
  
  // Debug: Log the color being used
  console.log('🔴 StickyNoteTool - selectedStickyNoteColor:', selectedStickyNoteColor);
  console.log('🔴 StickyNoteTool - actualFill:', actualFill);
  // Store dispatchers (tolerant lookups to fit module naming)
  const addElement =
    useUnifiedCanvasStore(
      (s: any) => {
        console.log('🔴 Available store methods:', {
          elements_addElement: !!s.elements?.addElement,
          element_addElement: !!s.element?.addElement,
          elements_create: !!s.elements?.create,
          element_create: !!s.element?.create,
          addElement: !!s.addElement
        });
        return s.addElement ?? s.elements?.addElement ?? s.element?.addElement ?? s.elements?.create ?? s.element?.create;
      }
    ) ?? ((_: any) => { console.log('🔴 No addElement function found!'); });
  const updateElement = useUnifiedCanvasStore((s: any) => s.element.update);
  const pushToHistory =
    useUnifiedCanvasStore((s: any) => s.history?.push) ?? (() => {});
  const setSelectedTool =
    useUnifiedCanvasStore((s: any) => s.ui?.setSelectedTool) ?? (() => {});

  const activeEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressOpenRef = useRef<boolean>(false);
  const justOpenedRef = useRef<boolean>(false);

  // Lifecycle effect: attach commit/close listeners regardless of active state
  useEffect(() => {
    const stage = stageRef.current;
    const container = stage?.container();

    const closeEditor = () => {
      const ta = activeEditorRef.current;
      if (!ta) return;
      try { ta.style.display = 'none'; } catch {}
      try { ta.remove(); } catch {}
      activeEditorRef.current = null;
    };

    const onStageClick = () => {
      closeEditor();
      suppressOpenRef.current = true;
      setTimeout(() => { suppressOpenRef.current = false; }, 0);
    };

    const onContainerClick = (evt: MouseEvent) => {
      closeEditor();
      // Suppress immediate re-open for this click
      suppressOpenRef.current = true;
      setTimeout(() => { suppressOpenRef.current = false; }, 0);
      evt.preventDefault();
      evt.stopPropagation();
    };

    const onDocClick = (_evt: MouseEvent) => {
      closeEditor();
    };

    const onDocPointerDown = (_evt: PointerEvent) => {
      const ta = activeEditorRef.current;
      if (!ta) return;
      if (justOpenedRef.current) return;
      closeEditor();
      suppressOpenRef.current = true;
      setTimeout(() => { suppressOpenRef.current = false; }, 0);
    };

    // Do NOT close on the same click that opened; rely on blur/Esc or outside pointerdown
    // if (stage) stage.on('click.sticky-commit', onStageClick);
    // if (container) container.addEventListener('click', onContainerClick, { capture: true });
    document.addEventListener('pointerdown', onDocPointerDown, { capture: true });

    return () => {
      try { container?.removeEventListener('click', onContainerClick as any, { capture: true } as any); } catch {}
      document.removeEventListener('pointerdown', onDocPointerDown as any, { capture: true } as any);
      try { stage?.off('click.sticky-commit'); } catch {}
    };
  }, [stageRef]);

  // Close editor if tool deactivates
  useEffect(() => {
    if (isActive) return;
    const ta = activeEditorRef.current;
    if (!ta) return;
    try { ta.style.display = 'none'; } catch {}
    try { ta.remove(); } catch {}
    activeEditorRef.current = null;
  }, [isActive]);

  // Activation effect: handles opening when tool is active
  useEffect(() => {
    const stage = stageRef.current;
    if (!isActive || !stage) return;

    const createTextarea = (pageX: number, pageY: number) => {
      // Close any existing editor first to avoid lingering inputs
      const existing = activeEditorRef.current;
      if (existing) {
        try { existing.style.display = 'none'; } catch {}
      try { existing.remove(); } catch {}
      activeEditorRef.current = null;
      }
      const ta = document.createElement('textarea');
      justOpenedRef.current = true;
      ta.setAttribute('data-testid', 'sticky-note-input');
      ta.style.position = 'absolute';
      ta.style.left = `${pageX}px`;
      ta.style.top = `${pageY}px`;
      ta.style.minWidth = '240px';
      ta.style.minHeight = '180px';
      ta.style.width = '240px';
      ta.style.height = '180px';
      ta.style.padding = '6px 8px';
      ta.style.border = '1px solid rgba(0,0,0,0.2)';
      ta.style.borderRadius = '6px';
      ta.style.background = '#fffbea';
      ta.style.zIndex = '1000';
      ta.value = text;
      document.body.appendChild(ta);
      activeEditorRef.current = ta;
      ta.focus();
      // Allow the current pointerdown cycle to finish before we consider closing on outside click
      setTimeout(() => { justOpenedRef.current = false; }, 0);
      const commit = () => {
        const newText = ta.value;
        // Read element id stored on this textarea instance
        const id = (ta as any)?._elementId;
        if (id && updateElement) {
          try {
            updateElement(id, { 
              text: newText,
              data: { text: newText },
              content: newText 
            });
          } catch (e) {
            console.log('Update failed, trying alternative:', e);
            // Try alternative update methods
            const store = useUnifiedCanvasStore.getState();
            const element = store.element?.getById?.(id);
            if (element && store.element?.update) {
              store.element.update(id, { ...element, text: newText });
            }
          }
        }
        try { ta.style.display = 'none'; } catch {}
      try { ta.remove(); } catch {}
      if (activeEditorRef.current === ta) activeEditorRef.current = null;
      };
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); commit(); }
      });
      ta.addEventListener('blur', () => commit(), { once: true });
      return ta;
    };

    const handlePointerDown = (e?: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Create sticky note element in unified store; renderer module will draw it
      const stickyPayload: any = {
        id: `sticky-${Date.now()}`,
        type: 'sticky-note',
        x: pos.x,
        y: pos.y,
        width: 240,
        height: 180,
        text: text,
        style: {
          fill: actualFill,
          fontSize,
          align: 'left',
        },
      };
      
      console.log('🔴 Creating sticky note with payload:', stickyPayload);
      console.log('🔴 Using color:', actualFill);

      // Call addElement and check if it worked
      addElement(stickyPayload);
      
      // Check if the element was actually added to the store
      setTimeout(() => {
        const state = useUnifiedCanvasStore.getState() as any;
        console.log('🔴 After adding - Elements in store:', state.elements?.size || 0);
        console.log('🔴 Element exists:', !!state.elements?.get(stickyPayload.id));
        const element = state.elements?.get(stickyPayload.id);
        if (element) {
          console.log('🔴 Stored element color:', element.style?.fill);
        }
      }, 100);

      // Show inline text input to satisfy E2E expectations
      try {
        const container = stage.container();
        const rect = container.getBoundingClientRect();
        const ta = createTextarea(rect.left + pos.x, rect.top + pos.y);
        if (ta) (ta as any)._elementId = stickyPayload.id;
      } catch {}
      pushToHistory?.({ type: 'add', payload: stickyPayload });

      // Auto-switch back to select for a streamlined UX
      setSelectedTool?.('select');
      if (e) e.cancelBubble = true;
    };

    stage.on('pointerdown.sticky', handlePointerDown);

    // Also open inline input on container click (capture) for reliability
    const container = stageRef.current?.container();
    const onContainerPointerDown = (evt: PointerEvent) => {
      if (!isActive) return;
      if (suppressOpenRef.current) return;
      if (evt.defaultPrevented) return;
      if (activeEditorRef.current) return;
      createTextarea(evt.clientX, evt.clientY);
      // Stop bubbling to avoid immediate re-targeting by other capture handlers
      evt.stopPropagation();
    };
    container?.addEventListener('pointerdown', onContainerPointerDown, { capture: true });

    // Fallback: also create on click if not already opened (supports click-only flows)
    const onContainerClickOpen = (evt: MouseEvent) => {
      if (!isActive) return;
      if (suppressOpenRef.current) return;
      if (activeEditorRef.current) return;
      createTextarea(evt.clientX, evt.clientY);
    };
    container?.addEventListener('click', onContainerClickOpen, { capture: true });

    return () => {
      stage.off('pointerdown.sticky');
      try { stageRef.current?.container()?.removeEventListener('pointerdown', onContainerPointerDown, { capture: true } as any); } catch {}
      try { stageRef.current?.container()?.removeEventListener('click', onContainerClickOpen as any, { capture: true } as any); } catch {}
    };
  }, [isActive, stageRef, width, height, actualFill, text, fontSize, addElement, pushToHistory, setSelectedTool]);

  return null;
};

export default StickyNoteTool;