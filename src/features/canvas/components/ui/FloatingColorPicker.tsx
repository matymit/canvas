import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface FloatingColorPickerProps {
  open: boolean;
  anchor: { x: number; y: number }; // screen coords
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

const FloatingColorPicker: React.FC<FloatingColorPickerProps> = ({
  open,
  anchor,
  color,
  onChange,
  onClose,
}) => {
  const portalEl = typeof document !== 'undefined' ? document.body : null;
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', onDown, { capture: true });
    return () => window.removeEventListener('mousedown', onDown, { capture: true } as any);
  }, [open, onClose]);

  if (!open || !portalEl) return null;

  const content = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: anchor.x,
        top: anchor.y,
        transform: 'translate(8px, 8px)',
        zIndex: 1100,
        background: 'rgba(30, 41, 59, 0.98)',
        color: 'white',
        borderRadius: 8,
        padding: 8,
        boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
      role="dialog"
      aria-label="Color picker"
    >
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 32,
          height: 32,
          border: 'none',
          padding: 0,
          background: 'transparent',
          cursor: 'pointer',
        }}
        aria-label="Pick color"
      />
      <span style={{ fontSize: 12, opacity: 0.8 }}>{color}</span>
    </div>
  );

  return createPortal(content, portalEl);
};

export default FloatingColorPicker;