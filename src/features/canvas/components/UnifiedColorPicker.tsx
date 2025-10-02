/**
 * UnifiedColorPicker - Consolidated color picker component supporting multiple modes
 *
 * Modes:
 * - 'palette': Grid of preset colors with keyboard navigation (like StickyColorPortal)
 * - 'picker': Native color input picker (like ColorPicker/FloatingColorPicker)
 * - 'hybrid': Both palette and picker together
 *
 * Features:
 * - Portal rendering for proper z-index management
 * - Keyboard navigation (arrows, enter, escape)
 * - Focus management with ARIA support
 * - Flexible positioning (anchor rect or x,y coordinates)
 * - Click outside to close
 * - Customizable color palette
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  UnifiedColorPickerProps
} from './colorPicker/constants';
import {
  DEFAULT_PALETTE,
  FIGMA_HORIZONTAL_PALETTE
} from './colorPicker/constants';


// Panel styles
const PANEL_BASE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1100,
  background: 'rgba(255,255,255,0.98)',
  color: '#1f2544',
  border: '1px solid rgba(82,88,126,0.18)',
  borderRadius: 16,
  boxShadow: '0 18px 46px rgba(24,25,32,0.16)',
  padding: 12,
  minWidth: 220,
  backdropFilter: 'blur(14px) saturate(1.05)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.05)',
};

// Figma horizontal panel style - compact and light to match toolbar
const FIGMA_HORIZONTAL_PANEL: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1100,
  background: 'rgba(255,255,255,0.95)',
  color: '#1f2544',
  border: '1px solid rgba(82,88,126,0.16)',
  borderRadius: 14,
  boxShadow: '0 18px 36px rgba(24,25,32,0.18)',
  padding: 8,
  minWidth: 'auto',
  backdropFilter: 'blur(12px) saturate(1.05)',
  WebkitBackdropFilter: 'blur(12px) saturate(1.05)',
};

const HEADER_STYLE: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 8,
  fontWeight: 500,
};

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 28px)',
  gap: 8,
  marginBottom: 10,
};

const FIGMA_HORIZONTAL_GRID_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: 6, // Reduced gap for more compact design
  marginBottom: 0, // Remove bottom margin
  padding: 0, // Remove extra padding
};

const SWATCH_STYLE: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  border: '2px solid transparent',
  cursor: 'pointer',
  outline: 'none',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
};

const FIGMA_SWATCH_STYLE: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '2px solid transparent',
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.15s ease',
  flexShrink: 0,
};

const PICKER_CONTAINER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 8,
  borderTop: '1px solid rgba(255,255,255,0.1)',
};

const COLOR_INPUT_STYLE: React.CSSProperties = {
  width: 40,
  height: 32,
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  padding: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const HEX_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  height: 32,
  padding: '0 8px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: 'inherit',
  fontSize: 12,
  fontFamily: 'monospace',
};

const FOCUS_OUTLINE = '0 0 0 3px rgba(93, 90, 255, 0.32)';
const SELECTED_OUTLINE = '0 0 0 3px rgba(93, 90, 255, 0.22)';
const FIGMA_SELECTED_BORDER = '2px solid rgba(93, 90, 255, 0.85)';
const FIGMA_FOCUS_BORDER = '2px solid rgba(93, 90, 255, 0.55)';
const FIGMA_DEFAULT_BORDER = '2px solid rgba(82, 88, 126, 0.2)';

export default function UnifiedColorPicker({
  open,
  mode = 'palette',
  color: propColor,
  onChange: propOnChange,
  onClose,
  anchorRect,
  anchor,
  title,
  colors: customColors,
  showColorValue = false,
  autoFocus = true,
  className,
  // Backward compatibility
  selected,
  onSelect,
}: UnifiedColorPickerProps) {
  // Handle backward compatibility
  const color = propColor ?? selected ?? '#FFD262';
  const onChange = useCallback(
    (color: string) => {
      if (propOnChange) {
        propOnChange(color);
      } else if (onSelect) {
        onSelect(color);
      }
    },
    [propOnChange, onSelect]
  );

  // Choose palette based on mode
  const colors = customColors ?? (mode === 'figma-horizontal' ? FIGMA_HORIZONTAL_PALETTE : DEFAULT_PALETTE);

  // Portal root
  const root = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);

  // Refs
  const panelRef = useRef<HTMLDivElement | null>(null);
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const hexInputRef = useRef<HTMLInputElement | null>(null);

  // State
  const [activeIdx, setActiveIdx] = useState<number>(() => {
    const idx = colors.findIndex((c) => c.toLowerCase() === color.toLowerCase());
    return idx >= 0 ? idx : 0;
  });
  const [hexValue, setHexValue] = useState(color);

  // Update hex value when color changes
  useEffect(() => {
    setHexValue(color);
  }, [color]);

  // Calculate positioning
  const position = useMemo(() => {
    if (anchorRect) {
      // Toolbar-style positioning (above element)
      return {
        bottom: Math.round(window.innerHeight - anchorRect.top + 8),
        left: Math.round(anchorRect.left + anchorRect.width / 2),
        top: 'auto' as const,
        transform: 'translateX(-50%)',
      };
    } else if (anchor) {
      // Floating positioning (at coordinates)
      return {
        left: anchor.x + 8,
        top: anchor.y + 8,
        bottom: 'auto' as const,
      };
    } else {
      // Centered fallback
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        bottom: 'auto' as const,
      };
    }
  }, [anchorRect, anchor]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Universal keys
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Palette navigation
      if (mode === 'palette' || mode === 'hybrid' || mode === 'figma-horizontal') {
        if (e.key === 'Enter') {
          e.preventDefault();
          const selectedColor = colors[activeIdx] ?? color;
          onChange(selectedColor);
          if (mode === 'palette') onClose();
          return;
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setActiveIdx((i) => (i + 1) % colors.length);
          return;
        }

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setActiveIdx((i) => (i - 1 + colors.length) % colors.length);
          return;
        }

        // Only allow up/down navigation for non-horizontal modes
        if (mode !== 'figma-horizontal') {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            // 6 columns by default
            const cols = 6;
            setActiveIdx((i) => Math.min(colors.length - 1, i + cols));
            return;
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const cols = 6;
            setActiveIdx((i) => Math.max(0, i - cols));
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, mode, activeIdx, colors, color, onChange, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener('mousedown', onMouseDown, { capture: true });
    return () => window.removeEventListener('mousedown', onMouseDown, { capture: true });
  }, [open, onClose]);

  // Auto-focus management
  useEffect(() => {
    if (!open || !autoFocus) return;

    // Small delay to ensure portal is mounted
    const timer = setTimeout(() => {
      if (mode === 'picker') {
        pickerRef.current?.focus();
      } else if (mode === 'palette' || mode === 'hybrid') {
        const btn = swatchRefs.current[activeIdx];
        btn?.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [open, mode, activeIdx, autoFocus]);

  // Handle hex input
  const handleHexChange = (value: string) => {
    setHexValue(value);
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange(value);
    }
  };

  if (!open || !root) return null;

  // Build panel content
  const panelContent = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title ?? 'Color picker'}
      className={className}
      style={{
        ...(mode === 'figma-horizontal' ? FIGMA_HORIZONTAL_PANEL : PANEL_BASE),
        ...position,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {title && mode !== 'figma-horizontal' && <div style={HEADER_STYLE}>{title}</div>}

      {/* Palette Mode */}
      {(mode === 'palette' || mode === 'hybrid') && (
        <div style={GRID_STYLE} role="listbox" aria-label="Color swatches">
          {colors.map((swatch, i) => {
            const isSelected = swatch.toLowerCase() === color.toLowerCase();
            const isActive = i === activeIdx;

            return (
              <button
                key={`${swatch}-${i}`}
                ref={(el) => {
                  swatchRefs.current[i] = el;
                }}
                role="option"
                aria-selected={isSelected}
                aria-label={`Color ${swatch}`}
                title={swatch}
                style={{
                  ...SWATCH_STYLE,
                  background: swatch,
                  boxShadow: isActive ? FOCUS_OUTLINE : isSelected ? SELECTED_OUTLINE : 'none',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  onChange(swatch);
                  if (mode === 'palette') onClose();
                }}
                onMouseEnter={() => setActiveIdx(i)}
                onFocus={() => setActiveIdx(i)}
              />
            );
          })}
        </div>
      )}

      {/* FigJam Horizontal Mode */}
      {mode === 'figma-horizontal' && (
        <div style={FIGMA_HORIZONTAL_GRID_STYLE} role="listbox" aria-label="Color swatches">
          {colors.map((swatch, i) => {
            const isSelected = swatch.toLowerCase() === color.toLowerCase();
            const isActive = i === activeIdx;

            return (
              <button
                key={`${swatch}-${i}`}
                ref={(el) => {
                  swatchRefs.current[i] = el;
                }}
                role="option"
                aria-selected={isSelected}
                aria-label={`Color ${swatch}`}
                title={swatch}
                style={{
                  ...FIGMA_SWATCH_STYLE,
                  background: swatch,
                  border: isSelected ? FIGMA_SELECTED_BORDER : isActive ? FIGMA_FOCUS_BORDER : FIGMA_DEFAULT_BORDER,
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  onChange(swatch);
                  onClose();
                }}
                onMouseEnter={() => setActiveIdx(i)}
                onFocus={() => setActiveIdx(i)}
              />
            );
          })}
        </div>
      )}

      {/* Picker Mode */}
      {(mode === 'picker' || mode === 'hybrid') && (
        <div style={PICKER_CONTAINER}>
          <input
            ref={pickerRef}
            type="color"
            value={color}
            onChange={(e) => {
              const newColor = e.target.value;
              setHexValue(newColor);
              onChange(newColor);
            }}
            style={COLOR_INPUT_STYLE}
            aria-label="Pick custom color"
            title="Pick custom color"
          />

          {showColorValue !== false && (
            <input
              ref={hexInputRef}
              type="text"
              value={hexValue}
              onChange={(e) => handleHexChange(e.target.value)}
              onBlur={() => {
                // Reset to current color if invalid
                if (!/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
                  setHexValue(color);
                }
              }}
              style={HEX_INPUT_STYLE}
              placeholder="#000000"
              aria-label="Hex color value"
              title="Hex color value"
              maxLength={7}
            />
          )}
        </div>
      )}
    </div>
  );

  return createPortal(panelContent, root);
}

