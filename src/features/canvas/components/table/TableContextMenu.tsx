// Professional context menu for table operations with modern styling
import React from 'react';
import type { TableContextMenuState } from './TableContextMenuManager';

export interface TableContextMenuProps {
  state: TableContextMenuState;
  onAction: (action: string) => void;
  onClose: () => void;
}

const MENU_ITEMS = [
  { id: 'add-row-above', label: 'Add Row Above', icon: '↑' },
  { id: 'add-row-below', label: 'Add Row Below', icon: '↓' },
  { id: 'add-column-left', label: 'Add Column Left', icon: '←' },
  { id: 'add-column-right', label: 'Add Column Right', icon: '→' },
  { id: 'separator', label: '', icon: '' },
  { id: 'delete-row', label: 'Delete Row', icon: '×', destructive: true },
  { id: 'delete-column', label: 'Delete Column', icon: '×', destructive: true },
];

export const TableContextMenu: React.FC<TableContextMenuProps> = ({
  state,
  onAction,
  onClose,
}) => {
  if (!state.visible || !state.position) {
    return null;
  }

  const handleAction = (actionId: string) => {
    if (actionId === 'separator') return;
    onAction(actionId);
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
        {MENU_ITEMS.map((item, index) => {
          if (item.id === 'separator') {
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
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: item.destructive ? '#d73a49' : '#24292e',
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = item.destructive
                  ? '#ffeaea'
                  : '#f6f8fa';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
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
          );
        })}
      </div>
    </>
  );
};

export default TableContextMenu;