// Confirmation dialog for destructive table operations
import React from 'react';

export interface TableConfirmationState {
  visible: boolean;
  action: string | null;
  message: string | null;
  onConfirm: (() => void) | null;
}

export interface TableConfirmationDialogProps {
  state: TableConfirmationState;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TableConfirmationDialog: React.FC<TableConfirmationDialogProps> = ({
  state,
  onConfirm,
  onCancel,
}) => {
  if (!state.visible) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          border: '1px solid #e1e5e9',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#24292e',
            marginBottom: '12px',
          }}
        >
          Confirm Action
        </div>

        {/* Message */}
        <div
          style={{
            fontSize: '14px',
            color: '#586069',
            lineHeight: '1.5',
            marginBottom: '24px',
          }}
        >
          {state.message}
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              border: '1px solid #d1d5da',
              borderRadius: '6px',
              backgroundColor: '#fafbfc',
              color: '#24292e',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#f3f4f6';
              (e.target as HTMLElement).style.borderColor = '#c6cbd1';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#fafbfc';
              (e.target as HTMLElement).style.borderColor = '#d1d5da';
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              border: '1px solid #d73a49',
              borderRadius: '6px',
              backgroundColor: '#d73a49',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#cb2431';
              (e.target as HTMLElement).style.borderColor = '#cb2431';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#d73a49';
              (e.target as HTMLElement).style.borderColor = '#d73a49';
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableConfirmationDialog;