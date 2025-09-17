// features/canvas/toolbar/StickyColorPortal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface StickyColorPortalProps {
  open: boolean;
  anchorRect?: DOMRect | null;
  selected?: string;
  onSelect: (color: string) => void;
  onClose: () => void;
  title?: string;
}

const PANEL_STYLE: React.CSSProperties = {
  position: "fixed",
  zIndex: 60,
  background: "var(--panel, #111827)",
  color: "var(--text, #e5e7eb)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
  padding: 10,
  minWidth: 220,
};

const HEADER_STYLE: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 8,
};

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 28px)",
  gap: 8,
};

const SWATCH_STYLE: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.25)",
  cursor: "pointer",
  outline: "none",
};

const FOCUS_OUTLINE = "2px solid rgba(255,255,255,0.6)";

// Common FigJam-like sticky palette (adjust to taste)
const STICKY_COLORS: string[] = [
  "#FDE68A", // Yellow
  "#FCA5A5", // Red
  "#86EFAC", // Green
  "#93C5FD", // Blue
  "#C4B5FD", // Purple
  "#FBCFE8", // Pink
  "#FCD34D", // Amber
  "#FDBA74", // Orange
  "#A7F3D0", // Teal
  "#BAE6FD", // Sky
  "#DDD6FE", // Violet
  "#F5D0FE", // Fuchsia
];

export default function StickyColorPortal({
  open,
  anchorRect,
  selected,
  onSelect,
  onClose,
  title = "Sticky Color",
}: StickyColorPortalProps) {
  const root = useMemo(() => (typeof document !== "undefined" ? document.body : null), []);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIdx, setActiveIdx] = useState<number>(() => {
    const idx = selected ? STICKY_COLORS.findIndex((c) => c.toLowerCase() === selected.toLowerCase()) : -1;
    return idx >= 0 ? idx : 0;
  });

  // Positioning - place ABOVE the toolbar
  const bottom = Math.round(window.innerHeight - (anchorRect?.top ?? 0) + 8);
  const left = Math.round(anchorRect?.left ?? 0);

  // Close on escape or outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const color = STICKY_COLORS[activeIdx] ?? selected ?? STICKY_COLORS[0];
        onSelect(color);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % STICKY_COLORS.length);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + STICKY_COLORS.length) % STICKY_COLORS.length);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        // 6 columns; move one row down
        setActiveIdx((i) => Math.min(STICKY_COLORS.length - 1, i + 6));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        // 6 columns; move one row up
        setActiveIdx((i) => Math.max(0, i - 6));
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, activeIdx, onClose, onSelect, selected]);

  // Focus the active swatch when opening
  useEffect(() => {
    if (!open) return;
    const btn = swatchRefs.current[activeIdx];
    btn?.focus();
  }, [open, activeIdx]);

  if (!open || !root) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      style={{ ...PANEL_STYLE, bottom, left, top: 'auto' }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={HEADER_STYLE}>{title}</div>
      <div style={GRID_STYLE} role="listbox" aria-label="Sticky color swatches">
        {STICKY_COLORS.map((color, i) => {
          const isSelected = selected && color.toLowerCase() === selected.toLowerCase();
          return (
            <button
              key={color}
              ref={(el) => (swatchRefs.current[i] = el)}
              role="option"
              aria-selected={isSelected || i === activeIdx}
              title={color}
              style={{
                ...SWATCH_STYLE,
                background: color,
                boxShadow: i === activeIdx ? FOCUS_OUTLINE : "none",
                outline: "none",
              }}
              onClick={(e) => {
                e.preventDefault();
                onSelect(color);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            />
          );
        })}
      </div>
    </div>,
    root
  );
}