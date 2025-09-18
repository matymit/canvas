// Table keyboard navigation hook for accessibility and cell editing
// Provides arrow key navigation, Enter to edit, and other table-specific shortcuts

import { useCallback, useEffect, useState } from 'react';
import type { CanvasElement } from '../../../../types';
import { getCellIndex } from '../types/table';

// Define TableElement as an extension of CanvasElement
type TableElement = CanvasElement & {
  type: 'table';
  cells?: Array<{ text: string }>;
  rows?: number;
  cols?: number;
};

export interface TableCellPosition {
  row: number;
  col: number;
}

export interface TableKeyboardOptions {
  onCellEdit?: (row: number, col: number) => void;
  onCellUpdate?: (row: number, col: number, text: string) => void;
  onCellDelete?: (row: number, col: number) => void;
  onEscape?: () => void;
  onSelectAll?: () => void;
  disabled?: boolean;
}

export interface TableKeyboardReturn {
  activeCell: TableCellPosition | null;
  setActiveCell: (position: TableCellPosition | null) => void;
  handleKeyDown: (e: KeyboardEvent) => boolean;
  isWithinTable: boolean;
  announcePosition: (row: number, col: number) => void;
}

/**
 * Hook for managing keyboard navigation within a table element
 * Integrates with existing AccessibilityManager for screen reader support
 */
export function useTableKeyboard(
  tableElement: TableElement | null,
  options: TableKeyboardOptions = {}
): TableKeyboardReturn {
  const [activeCell, setActiveCell] = useState<TableCellPosition | null>(null);
  const [isWithinTable, setIsWithinTable] = useState(false);

  const {
    onCellEdit,
    onCellDelete,
    onEscape,
    onSelectAll,
    disabled = false
  } = options;

  // Announce cell position for screen readers
  const announcePosition = useCallback((row: number, col: number) => {
    // Create announcement for accessibility
    const announcement = `Table cell ${String.fromCharCode(65 + col)}${row + 1}`;
    
    // Use ARIA live region for announcement
    const liveRegion = document.querySelector('[aria-live="polite"]') ||
                      document.querySelector('[aria-live="assertive"]');
    
    if (liveRegion) {
      liveRegion.textContent = announcement;
    } else {
      // Fallback: create temporary live region
      const tempRegion = document.createElement('div');
      tempRegion.setAttribute('aria-live', 'polite');
      tempRegion.setAttribute('aria-atomic', 'true');
      tempRegion.style.position = 'absolute';
      tempRegion.style.left = '-10000px';
      tempRegion.style.width = '1px';
      tempRegion.style.height = '1px';
      tempRegion.style.overflow = 'hidden';
      tempRegion.textContent = announcement;
      document.body.appendChild(tempRegion);
      
      setTimeout(() => {
        document.body.removeChild(tempRegion);
      }, 1000);
    }
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent): boolean => {
    if (disabled || !tableElement || !isWithinTable) return false;

    const { rows, cols } = tableElement;
    if (rows === undefined || cols === undefined) return false;

    let { row, col } = activeCell || { row: 0, col: 0 };

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        col = Math.max(0, col - 1);
        setActiveCell({ row, col });
        announcePosition(row, col);
        return true;

      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        if (e.key === 'Tab' && e.shiftKey) {
          // Shift+Tab goes backwards
          col = Math.max(0, col - 1);
          if (col < 0 && row > 0) {
            row--;
            col = cols - 1;
          }
        } else {
          col = Math.min(cols - 1, col + 1);
          if (col >= cols && row < rows - 1) {
            row++;
            col = 0;
          }
        }
        setActiveCell({ row, col });
        announcePosition(row, col);
        return true;

      case 'ArrowUp':
        e.preventDefault();
        row = Math.max(0, row - 1);
        setActiveCell({ row, col });
        announcePosition(row, col);
        return true;

      case 'ArrowDown':
        e.preventDefault();
        row = Math.min(rows - 1, row + 1);
        setActiveCell({ row, col });
        announcePosition(row, col);
        return true;

      case 'Home':
        e.preventDefault();
        if (e.ctrlKey) {
          // Ctrl+Home: go to first cell
          setActiveCell({ row: 0, col: 0 });
          announcePosition(0, 0);
        } else {
          // Home: go to first column of current row
          setActiveCell({ row, col: 0 });
          announcePosition(row, 0);
        }
        return true;

      case 'End':
        e.preventDefault();
        if (e.ctrlKey) {
          // Ctrl+End: go to last cell
          setActiveCell({ row: rows - 1, col: cols - 1 });
          announcePosition(rows - 1, cols - 1);
        } else {
          // End: go to last column of current row
          setActiveCell({ row, col: cols - 1 });
          announcePosition(row, cols - 1);
        }
        return true;

      case 'Enter':
        e.preventDefault();
        if (activeCell) {
          onCellEdit?.(activeCell.row, activeCell.col);
        }
        return true;

      case 'F2':
        e.preventDefault();
        if (activeCell) {
          onCellEdit?.(activeCell.row, activeCell.col);
        }
        return true;

      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (activeCell) {
          onCellDelete?.(activeCell.row, activeCell.col);
        }
        return true;

      case 'Escape':
        e.preventDefault();
        setIsWithinTable(false);
        setActiveCell(null);
        onEscape?.();
        return true;

      case 'a':
      case 'A':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSelectAll?.();
          return true;
        }
        break;

      // Allow typing to start editing
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (activeCell) {
            onCellEdit?.(activeCell.row, activeCell.col);
            // Let the character be typed in the editor
          }
        }
        break;
    }

    return false;
  }, [
    disabled,
    tableElement,
    isWithinTable,
    activeCell,
    onCellEdit,
    onCellDelete,
    onEscape,
    onSelectAll,
    announcePosition
  ]);

  // Set up keyboard event listener
  useEffect(() => {
    if (disabled) return;

    const handleKeyEvent = (e: KeyboardEvent) => {
      handleKeyDown(e);
    };

    if (isWithinTable) {
      document.addEventListener('keydown', handleKeyEvent, true);
      return () => {
        document.removeEventListener('keydown', handleKeyEvent, true);
      };
    }
  }, [handleKeyDown, isWithinTable, disabled]);

  // Initialize active cell when table becomes active
  useEffect(() => {
    if (isWithinTable && !activeCell && tableElement) {
      setActiveCell({ row: 0, col: 0 });
      announcePosition(0, 0);
    }
  }, [isWithinTable, activeCell, tableElement, announcePosition]);

  return {
    activeCell,
    setActiveCell,
    handleKeyDown,
    isWithinTable,
    announcePosition,
  };
}

/**
 * Hook for managing table cell editing with keyboard support
 */
export function useTableCellEditor(
  tableElement: TableElement | null,
  cellPosition: TableCellPosition | null,
  onUpdate?: (row: number, col: number, text: string) => void
) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Start editing a cell
  const startEdit = useCallback((row: number, col: number) => {
    if (!tableElement || tableElement.cols === undefined || !tableElement.cells) return;

    const cellIndex = getCellIndex(row, col, tableElement.cols);
    const currentText = tableElement.cells[cellIndex]?.text || '';
    
    setEditValue(currentText);
    setIsEditing(true);
  }, [tableElement]);

  // Commit edit
  const commitEdit = useCallback(() => {
    if (isEditing && cellPosition) {
      onUpdate?.(cellPosition.row, cellPosition.col, editValue);
      setIsEditing(false);
      setEditValue('');
    }
  }, [isEditing, cellPosition, editValue, onUpdate]);

  // Cancel edit
  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  // Handle editor keyboard events
  const handleEditorKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isEditing) return false;

    switch (e.key) {
      case 'Enter':
        if (!e.shiftKey) {
          e.preventDefault();
          commitEdit();
          return true;
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        cancelEdit();
        return true;
      
      case 'Tab':
        e.preventDefault();
        commitEdit();
        // Let parent handle navigation
        return false;
    }

    return false;
  }, [isEditing, commitEdit, cancelEdit]);

  return {
    isEditing,
    editValue,
    setEditValue,
    startEdit,
    commitEdit,
    cancelEdit,
    handleEditorKeyDown,
  };
}

/**
 * Higher-level hook that combines navigation and editing
 */
export function useTableInteraction(
  tableElement: TableElement | null,
  options: TableKeyboardOptions & {
    onCellUpdate?: (row: number, col: number, text: string) => void;
  } = {}
) {
  const keyboard = useTableKeyboard(tableElement, {
    ...options,
    onCellEdit: (row, col) => {
      editor.startEdit(row, col);
      options.onCellEdit?.(row, col);
    },
  });

  const editor = useTableCellEditor(
    tableElement,
    keyboard.activeCell,
    options.onCellUpdate
  );

  return {
    ...keyboard,
    ...editor,
  };
}