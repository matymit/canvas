import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import ColorPicker from './ColorPicker';

type Props = {
  open: boolean;
  anchorRect?: DOMRect | null;
  title?: string;
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 60,
  background: 'var(--panel, #111827)',
  color: 'var(--text, #e5e7eb)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
  padding: 10,
  minWidth: 200,
};

const headerStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
  marginBottom: 8,
};

const PortalColorPicker: React.FC<Props> = ({
  open,
  anchorRect,
  title = 'Color',
  color,
  onChange,
  onClose,
}) => {
  const root = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose]);

  if (!open || !root) return null;

  // Position above the toolbar
  const bottom = Math.round(window.innerHeight - (anchorRect?.top ?? 0) + 8);
  const left = Math.round(anchorRect?.left ?? 0);

  return createPortal(
    <div ref={panelRef} role="dialog" aria-label={`${title} picker`} style={{ ...panelStyle, bottom, left, top: 'auto' }}>
      <div style={headerStyle}>{title}</div>
      <ColorPicker
        label={undefined}
        color={color}
        onChange={onChange}
        autoFocus
      />
    </div>,
    root
  );
};

export default PortalColorPicker;