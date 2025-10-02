import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onSelectShape: (toolId: string) => void;
};

const items: Array<{ id: string; label: string; title: string }> = [
  { id: 'draw-circle', label: '◯', title: 'Circle' },
  { id: 'mindmap', label: '⎇', title: 'Mindmap' },
];

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 50,
  minWidth: 180,
  background: 'var(--bg-panel, rgba(255,255,255,0.98))',
  color: 'var(--text-primary, #1f2544)',
  border: '1px solid var(--border-subtle, rgba(82,88,126,0.16))',
  borderRadius: 14,
  boxShadow: '0 18px 36px rgba(24,25,32,0.18)',
  padding: 8,
  backdropFilter: 'blur(12px) saturate(1.05)',
  WebkitBackdropFilter: 'blur(12px) saturate(1.05)',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 12px',
  borderRadius: 10,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  transition: 'background 0.2s ease, color 0.2s ease, transform 0.2s ease',
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(93, 90, 255, 0.12)';
            e.currentTarget.style.transform = 'translateX(2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'translateX(0)';
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = 'rgba(93, 90, 255, 0.12)';
            e.currentTarget.style.transform = 'translateX(2px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'translateX(0)';
          }}
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