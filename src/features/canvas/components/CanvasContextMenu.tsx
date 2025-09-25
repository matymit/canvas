// General context menu for canvas elements with modern styling
import React from 'react';

export interface CanvasContextMenuState {
  visible: boolean;
  position: { x: number; y: number } | null;
  selectedElementIds: string[];
  clickedElementId?: string | null;
}

export interface CanvasContextMenuProps {
  state: CanvasContextMenuState;
  onAction: (action: string, elementId?: string) => void;
  onClose: () => void;
  hasClipboard: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

const getMenuItems = (hasSelection: boolean, hasClipboard: boolean, _singleSelection: boolean): MenuItem[] => {
  const items: MenuItem[] = [];

  if (hasSelection) {
    // Copy & Cut
    items.push(
      { id: 'copy', label: 'Copy', icon: '⌘', shortcut: '⌘C' },
      { id: 'duplicate', label: 'Duplicate', icon: '⧉', shortcut: '⌘D' },
    );
  }

  // Paste (always available if clipboard has items)
  if (hasClipboard) {
    items.push({ id: 'paste', label: 'Paste', icon: '📋', shortcut: '⌘V' });
  }

  if (hasSelection && items.length > 0) {
    items.push({ id: 'separator', label: '', icon: '', separator: true });
  }

  if (hasSelection) {
    // Layer operations
    items.push(
      { id: 'bring-to-front', label: 'Bring to Front', icon: '↑' },
      { id: 'send-to-back', label: 'Send to Back', icon: '↓' },
    );

    // Destructive actions
    items.push(
      { id: 'separator', label: '', icon: '', separator: true },
      { id: 'delete', label: 'Delete', icon: '🗑', shortcut: 'Del', destructive: true },
    );
  }

  return items;
};

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  state,
  onAction,
  onClose,
  hasClipboard,
}) => {
  if (!state.visible || !state.position) {
    return null;
  }

  const hasSelection = state.selectedElementIds.length > 0;
  const singleSelection = state.selectedElementIds.length === 1;
  const menuItems = getMenuItems(hasSelection, hasClipboard, singleSelection);

  const handleAction = (actionId: string) => {
    if (actionId === 'separator') return;
    onAction(actionId, state.clickedElementId || undefined);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Invisible backdrop to capture clicks outside menu */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          background: 'transparent',
        }}
        onClick={handleBackdropClick}
      />

      {/* Context menu */}
      <div
        style={{
          position: 'fixed',
          left: state.position.x,
          top: state.position.y,
          zIndex: 9999,
          backgroundColor: '#ffffff',
          border: '1px solid #e1e5e9',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          padding: '4px 0',
          minWidth: '180px',
          fontSize: '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((item, index) => {
          if (item.separator) {
            return (
              <div
                key={index}
                style={{
                  height: '1px',
                  backgroundColor: '#e1e5e9',
                  margin: '4px 0',
                }}
              />
            );
          }

          return (
            <div
              key={item.id}
              onClick={() => handleAction(item.id)}
              style={{
                padding: '8px 16px',
                cursor: item.disabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                color: item.disabled
                  ? '#9ca3af'
                  : item.destructive
                  ? '#d73a49'
                  : '#24292e',
                transition: 'background-color 0.1s ease',
                opacity: item.disabled ? 0.5 : 1,
                pointerEvents: item.disabled ? 'none' : 'auto',
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  (e.target as HTMLElement).style.backgroundColor = item.destructive
                    ? '#ffeaea'
                    : '#f6f8fa';
                }
              }}
              onMouseLeave={(e) => {
                if (!item.disabled) {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    opacity: 0.7,
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.shortcut && (
                <span
                  style={{
                    fontSize: '12px',
                    opacity: 0.5,
                    color: '#6b7280',
                  }}
                >
                  {item.shortcut}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default CanvasContextMenu;