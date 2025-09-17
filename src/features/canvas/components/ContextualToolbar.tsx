import React, { useEffect, useMemo, useState } from 'react';
import type Konva from 'konva';
import { createPortal } from 'react-dom';
import UnifiedColorPicker from './UnifiedColorPicker';

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContextualToolbarProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  selectionBounds: WorldRect | null;  // world coords in stage space
  visible: boolean;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  onChangeFill?: (color: string) => void;
  onChangeStroke?: (color: string) => void;
  onChangeStrokeWidth?: (w: number) => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function worldToScreen(stage: Konva.Stage, x: number, y: number) {
  const scaleX = stage.scaleX() || 1;
  const scaleY = stage.scaleY() || 1;
  const sx = stage.x() || 0;
  const sy = stage.y() || 0;
  return {
    x: sx + x * scaleX,
    y: sy + y * scaleY,
  };
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  stageRef,
  selectionBounds,
  visible,
  fillColor,
  strokeColor,
  strokeWidth,
  onChangeFill,
  onChangeStroke,
  onChangeStrokeWidth,
  onBringToFront,
  onSendToBack,
  onDuplicate,
  onDelete,
}) => {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<{ x: number; y: number } | null>(null);
  const [colorTarget, setColorTarget] = useState<'fill' | 'stroke'>('fill');

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  const anchor = useMemo(() => {
    const stage = stageRef.current;
    if (!stage || !selectionBounds) return null;

    const topCenter = {
      x: selectionBounds.x + selectionBounds.width / 2,
      y: selectionBounds.y,
    };
    const screen = worldToScreen(stage, topCenter.x, topCenter.y);
    const containerRect = stage.container().getBoundingClientRect();

    return {
      x: containerRect.left + screen.x,
      y: containerRect.top + screen.y - 8, // 8px above selection
    };
  }, [stageRef, selectionBounds]);

  const openPicker = (target: 'fill' | 'stroke') => {
    if (!anchor) return;
    setColorTarget(target);
    setColorPickerAnchor(anchor);
    setColorPickerOpen(true);
  };

  if (!portalEl || !anchor || !visible) return null;

  const toolbar = (
    <div
      style={{
        position: 'fixed',
        left: anchor.x,
        top: anchor.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
        pointerEvents: 'auto',
        background: 'rgba(30, 41, 59, 0.9)', // slate-800 90%
        color: 'white',
        borderRadius: 8,
        padding: '6px 8px',
        display: 'flex',
        gap: 8,
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(4px)',
      }}
      role="toolbar"
      aria-label="Contextual toolbar"
    >
      {/* Fill */}
      <button
        onClick={() => openPicker('fill')}
        title="Fill color"
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.2)',
          background: fillColor || 'transparent',
        }}
        aria-label="Fill color"
      />
      {/* Stroke */}
      <button
        onClick={() => openPicker('stroke')}
        title="Stroke color"
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          border: `2px solid ${strokeColor || 'rgba(255,255,255,0.6)'}`,
          background: 'transparent',
        }}
        aria-label="Stroke color"
      />
      {/* Stroke width */}
      <select
        value={strokeWidth ?? 1}
        onChange={(e) => onChangeStrokeWidth?.(parseFloat(e.target.value))}
        title="Stroke width"
        aria-label="Stroke width"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white',
          borderRadius: 4,
          padding: '2px 6px',
        }}
      >
        {[1, 2, 3, 4, 6, 8, 12].map((w) => (
          <option key={w} value={w}>
            {w}px
          </option>
        ))}
      </select>

      <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />

      <button onClick={onBringToFront} aria-label="Bring to front" title="Bring to front">
        ⬆️
      </button>
      <button onClick={onSendToBack} aria-label="Send to back" title="Send to back">
        ⬇️
      </button>

      <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />

      <button onClick={onDuplicate} aria-label="Duplicate" title="Duplicate">
        ⧉
      </button>
      <button onClick={onDelete} aria-label="Delete" title="Delete">
        🗑
      </button>
    </div>
  );

  return (
    <>
      {createPortal(toolbar, portalEl)}
      {colorPickerAnchor && (
        <UnifiedColorPicker
          open={colorPickerOpen}
          mode="picker"
          anchor={colorPickerAnchor}
          color={colorTarget === 'fill' ? fillColor ?? '#ffffff' : strokeColor ?? '#ffffff'}
          onChange={(c: string) => {
            if (colorTarget === 'fill') onChangeFill?.(c);
            else onChangeStroke?.(c);
          }}
          onClose={() => setColorPickerOpen(false)}
          showColorValue={true}
        />
      )}
    </>
  );
};

export default ContextualToolbar;