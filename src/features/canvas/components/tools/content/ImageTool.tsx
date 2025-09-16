// Image tool component with file picker, preview, and commit workflow
import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { loadImageFromFile } from '../../../utils/image/ImageLoader';

type StageRef = React.RefObject<Konva.Stage>;

export interface ImageToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'image'
}

const DEFAULT_MIN = { width: 120, height: 120 };

export const ImageTool: React.FC<ImageToolProps> = ({ 
  isActive, 
  stageRef, 
  toolId = 'image' 
}) => {
  const selectedTool = useUnifiedCanvasStore((s: any) => s.selectedTool ?? s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s: any) => s.setSelectedTool ?? s.ui?.setSelectedTool);
  const addElement = useUnifiedCanvasStore((s: any) => s.element?.addElement || s.element?.createElement || s.elements?.addElement);
  const selectOnly = useUnifiedCanvasStore((s: any) => (s as any).replaceSelectionWithSingle ?? s.selection?.replaceSelectionWithSingle);
  const beginHistory = useUnifiedCanvasStore((s: any) => s.history?.beginBatch);
  const endHistory = useUnifiedCanvasStore((s: any) => s.history?.endBatch);

  const stateRef = useRef<{
    start: { x: number; y: number } | null;
    preview: Konva.Image | null;
    dataUrl: string | null;
    natural: { w: number; h: number } | null;
  }>({ start: null, preview: null, dataUrl: null, natural: null });

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Trigger hidden file input when tool becomes active
  useEffect(() => {
    const active = isActive && selectedTool === toolId;
    if (!active) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    const onChange = async () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      
      try {
        const { dataUrl, naturalWidth, naturalHeight } = await loadImageFromFile(files[0]);
        stateRef.current.dataUrl = dataUrl;
        stateRef.current.natural = { w: naturalWidth, h: naturalHeight };
      } catch (error) {
        console.error('Failed to load image:', error);
        setSelectedTool?.('select');
      }
    };

    input.addEventListener('change', onChange, { once: true });
    document.body.appendChild(input);
    inputRef.current = input;
    input.click();

    return () => {
      if (inputRef.current && inputRef.current.parentElement) {
        inputRef.current.parentElement.removeChild(inputRef.current);
      }
      inputRef.current = null;
    };
  }, [isActive, selectedTool, toolId, setSelectedTool]);

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    const layers = stage.getLayers();
    const previewLayer = layers[layers.length - 2] as Konva.Layer | undefined; // preview by convention
    if (!previewLayer) return;

    const onPointerDown = () => {
      if (!stateRef.current.dataUrl) return; // wait for file chosen
      const pos = stage.getPointerPosition();
      if (!pos) return;

      stateRef.current.start = { x: pos.x, y: pos.y };

      const node = new Konva.Image({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        opacity: 0.6,
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        name: 'image-preview',
        image: undefined,
      });

      const img = new Image();
      img.onload = () => {
        node.image(img);
        previewLayer.batchDraw();
      };
      img.src = stateRef.current.dataUrl!;
      stateRef.current.preview = node;
      previewLayer.add(node);
      previewLayer.batchDraw();
    };

    const onPointerMove = () => {
      const start = stateRef.current.start;
      const node = stateRef.current.preview;
      const nat = stateRef.current.natural;
      if (!start || !node || !nat) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const wRaw = Math.max(DEFAULT_MIN.width, Math.abs(pos.x - start.x));
      const hRaw = Math.max(DEFAULT_MIN.height, Math.abs(pos.y - start.y));

      // Keep aspect ratio by default
      const aspect = nat.w / nat.h || 1;
      let w = wRaw;
      let h = hRaw;
      if (wRaw / hRaw > aspect) {
        h = Math.round(wRaw / aspect);
      } else {
        w = Math.round(hRaw * aspect);
      }

      node.position({ x, y });
      node.size({ width: w, height: h });
      previewLayer.batchDraw();
    };

    const commit = (x: number, y: number, w: number, h: number) => {
      const nat = stateRef.current.natural!;
      const src = stateRef.current.dataUrl!;
      
      beginHistory?.('create-image', 'create-image');
      
      const id = crypto?.randomUUID?.() || `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const element = {
        id,
        type: 'image' as const,
        x,
        y,
        width: w,
        height: h,
        src,
        naturalWidth: nat.w,
        naturalHeight: nat.h,
        keepAspectRatio: true,
      };

      // Try different addElement signatures based on the store implementation
      let elementId: string | undefined;
      if (addElement) {
        try {
          elementId = (addElement as any)(element, { select: true, pushHistory: true });
        } catch {
          try {
            elementId = (addElement as any)(element);
          } catch {
            elementId = id;
          }
        }
      }
      
      endHistory?.(true);

      if ((elementId || id) && selectOnly) {
        selectOnly(elementId || id);
      }
      setSelectedTool?.('select');
    };

    const onPointerUp = () => {
      const start = stateRef.current.start;
      const node = stateRef.current.preview;
      const pos = stage.getPointerPosition();

      stateRef.current.start = null;

      if (node) {
        node.remove();
        node.destroy();
        stateRef.current.preview = null;
        previewLayer.batchDraw();
      }

      if (!stateRef.current.dataUrl || !pos || !start) return;

      const nat = stateRef.current.natural!;
      const aspect = nat.w / nat.h || 1;

      let w = Math.abs(pos.x - start.x);
      let h = Math.abs(pos.y - start.y);

      // Default size when click without drag
      if (w < 4 && h < 4) {
        w = Math.max(DEFAULT_MIN.width, Math.min(nat.w, 240));
        h = Math.round(w / aspect);
        commit(start.x, start.y, w, h);
      } else {
        // Normalize drag rectangle and keep aspect
        const x = Math.min(start.x, pos.x);
        const y = Math.min(start.y, pos.y);
        if (w / h > aspect) {
          h = Math.round(w / aspect);
        } else {
          w = Math.round(h * aspect);
        }
        commit(x, y, w, h);
      }

      // Reset so the next placement opens file picker again
      stateRef.current.dataUrl = null;
    };

    stage.on('pointerdown.image', onPointerDown);
    stage.on('pointermove.image', onPointerMove);
    stage.on('pointerup.image', onPointerUp);

    return () => {
      stage.off('pointerdown.image', onPointerDown);
      stage.off('pointermove.image', onPointerMove);
      stage.off('pointerup.image', onPointerUp);

      const ghost = stateRef.current.preview;
      if (ghost) {
        try {
          ghost.destroy();
        } catch {}
        stateRef.current.preview = null;
        previewLayer.batchDraw();
      }
      stateRef.current.start = null;
    };
  }, [isActive, selectedTool, toolId, stageRef, addElement, selectOnly, beginHistory, endHistory, setSelectedTool]);

  return null;
};

export default ImageTool;