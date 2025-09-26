// features/canvas/__tests__/unit/keyboard-deletion.test.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { CanvasElement, ElementId } from '../../../../types/index';

describe('Keyboard Deletion Functionality', () => {
  let mockDeleteSelected: ReturnType<typeof vi.fn>;
  let mockWithUndo: ReturnType<typeof vi.fn>;
  let mockSetSelection: ReturnType<typeof vi.fn>;
  let mockClearSelection: ReturnType<typeof vi.fn>;

  // Simulate keyboard deletion logic from useKeyboardShortcuts hook
  function simulateKeyboardDeletion(hasSelection: boolean = true, isEditingContent: boolean = false) {
    const store = useUnifiedCanvasStore.getState();

    // Simulate the contentEditable check from useKeyboardShortcuts
    if (isEditingContent) {
      const mockElement = { isContentEditable: true };
      Object.defineProperty(document, 'activeElement', {
        value: mockElement,
        configurable: true,
      });
    } else {
      Object.defineProperty(document, 'activeElement', {
        value: null,
        configurable: true,
      });
    }

    // Simulate the keyboard shortcut onDelete handler
    if (store.selectedElementIds.size === 0) return;

    if (document.activeElement && (document.activeElement as any).isContentEditable) return;

    if (store.withUndo && store.selection?.deleteSelected) {
      store.withUndo('Delete selected elements', () => {
        store.selection?.deleteSelected();
      });
    }
  }

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    mockDeleteSelected = vi.fn();
    mockWithUndo = vi.fn((description: string, mutator: () => void) => {
      mutator(); // Execute the mutator immediately for testing
    });
    mockSetSelection = vi.fn();
    mockClearSelection = vi.fn();

    // Reset the store state
    useUnifiedCanvasStore.setState((state) => ({
      elements: new Map<ElementId, CanvasElement>([
        ['element-1', { id: 'element-1', type: 'rectangle', x: 10, y: 10, bounds: { width: 100, height: 50 } } as CanvasElement],
        ['element-2', { id: 'element-2', type: 'circle', x: 150, y: 10, bounds: { width: 80, height: 80 } } as CanvasElement],
      ]),
      selectedElementIds: new Set(['element-1']),
      elementOrder: ['element-1', 'element-2'],
      ui: state.ui
        ? { ...state.ui, selectedTool: 'select' }
        : {
            selectedTool: 'select',
            strokeColor: '#000000',
            fillColor: '#ffffff',
            strokeWidth: 2,
            stickyNoteColor: '#FFF59D',
            setSelectedTool: vi.fn(),
            setStrokeColor: vi.fn(),
            setFillColor: vi.fn(),
            setStrokeWidth: vi.fn(),
            setStickyNoteColor: vi.fn(),
          },
      selection: {
        deleteSelected: mockDeleteSelected,
        selectOne: vi.fn(),
        set: mockSetSelection,
        toggle: vi.fn(),
        clear: mockClearSelection,
        selectAll: vi.fn(),
        moveSelectedBy: vi.fn(),
        getSelected: vi.fn(),
      } as any,
      withUndo: mockWithUndo,
      undo: vi.fn(),
      redo: vi.fn(),
      setSelection: mockSetSelection,
      clearSelection: mockClearSelection,
      addToSelection: vi.fn(),
      viewport: {
        x: 0,
        y: 0,
        scale: 1,
        minScale: 0.1,
        maxScale: 5,
        setPan: vi.fn(),
        setScale: vi.fn(),
        zoomAt: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        reset: vi.fn(),
        fitToContent: vi.fn(),
        worldToStage: vi.fn(),
        stageToWorld: vi.fn(),
      },
    }));
  });

  it('should call deleteSelected when keyboard deletion is triggered with selected elements', () => {
    simulateKeyboardDeletion(true, false);

    // Should call withUndo with deleteSelected
    expect(mockWithUndo).toHaveBeenCalledWith('Delete selected elements', expect.any(Function));
    expect(mockDeleteSelected).toHaveBeenCalled();
  });

  it('should not call deleteSelected when no elements are selected', () => {
    // Clear selection
    useUnifiedCanvasStore.setState({
      selectedElementIds: new Set(),
    });

    simulateKeyboardDeletion(false, false);

    // Should NOT call deleteSelected when no selection
    expect(mockDeleteSelected).not.toHaveBeenCalled();
    expect(mockWithUndo).not.toHaveBeenCalled();
  });

  it('should not delete when user is editing content (contentEditable)', () => {
    simulateKeyboardDeletion(true, true);

    // Should NOT call deleteSelected when editing content
    expect(mockDeleteSelected).not.toHaveBeenCalled();
    expect(mockWithUndo).not.toHaveBeenCalled();
  });

  it('should integrate properly with history system', () => {
    simulateKeyboardDeletion(true, false);

    // Verify that withUndo was called with the correct description
    expect(mockWithUndo).toHaveBeenCalledWith('Delete selected elements', expect.any(Function));

    // Verify that the mutator function actually calls deleteSelected
    expect(mockDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple selected elements', () => {
    // Add more selected elements
    useUnifiedCanvasStore.setState({
      selectedElementIds: new Set(['element-1', 'element-2']),
    });

    simulateKeyboardDeletion(true, false);

    // Should still call the deletion function once (deleteSelected handles multiple elements)
    expect(mockWithUndo).toHaveBeenCalledWith('Delete selected elements', expect.any(Function));
    expect(mockDeleteSelected).toHaveBeenCalledTimes(1);
  });
});
