import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onSelectShape: (toolId: string) => void;
};

const items: Array<{ id: string; label: string; title: string }> = [
  { id: 'draw-rectangle', label: '▭', title: 'Rectangle' },
  { id: 'draw-circle', label: '◯', title: 'Circle' },
  { id: 'draw-triangle', label: '△', title: 'Triangle' },
  { id: 'mindmap', label: '⎇', title: 'Mindmap' },
];

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 50,
  minWidth: 160,
  background: 'var(--panel, #111827)',
  color: 'var(--text, #e5e7eb)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
  padding: 6,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  cursor: 'pointer',
};

const ShapesDropdown: React.FC<Props> = ({ open, anchorRect, onClose, onSelectShape }) => {
  const root = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current && !menuRef.current.contains(target)) {
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

  if (!open || !root || !anchorRect) return null;

  // Position above the toolbar
  const bottom = Math.round(window.innerHeight - anchorRect.top + 6);
  const left = Math.round(anchorRect.left);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Shapes"
      style={{ ...menuStyle, bottom, left, top: 'auto' }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          role="menuitem"
          type="button"
          title={it.title}
          aria-label={it.title}
          style={itemStyle}
          onClick={() => onSelectShape(it.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelectShape(it.id);
          }}
        >
          <span aria-hidden>{it.label}</span>
          <span style={{ opacity: 0.75 }}>{it.title}</span>
        </button>
      ))}
    </div>,
    root
  );
};

export default ShapesDropdown;