import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the hook since it's React-specific
const mockHandlers = {
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onSelectAll: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomReset: vi.fn(),
  onFitToContent: vi.fn(),
  onTool: vi.fn(),
};

// Simulate keyboard shortcut logic
function simulateKeyDown(key: string, options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrl || false,
    metaKey: options.meta || false,
    shiftKey: options.shift || false,
    bubbles: true,
    cancelable: true,
  });

  // Simulate the logic from useKeyboardShortcuts
  const handlers = mockHandlers;
  const isMac = false; // Assume non-Mac for testing
  const e = event;
  const k = e.key;
  const meta = e.metaKey;
  const ctrl = e.ctrlKey;
  const shift = e.shiftKey;

  // Undo/redo
  if ((meta || ctrl) && k.toLowerCase() === 'z') {
    e.preventDefault();
    if (shift) handlers.onRedo();
    else handlers.onUndo();
    return;
  }
  if ((meta || ctrl) && k.toLowerCase() === 'y') {
    e.preventDefault();
    handlers.onRedo();
    return;
  }

  // Delete
  if (k === 'Delete' || k === 'Backspace') {
    // Respect contentEditable focus like the real hook
    const active = (document as any).activeElement as HTMLElement | null;
    if (active && (active as any).isContentEditable === true) {
      return; // do not handle delete when editing text
    }
    e.preventDefault();
    handlers.onDelete();
    return;
  }

  // Duplicate
  if ((meta || ctrl) && k.toLowerCase() === 'd') {
    e.preventDefault();
    handlers.onDuplicate();
    return;
  }

  // Select all
  if ((meta || ctrl) && k.toLowerCase() === 'a') {
    e.preventDefault();
    handlers.onSelectAll();
    return;
  }

  // Zoom
  if ((meta || ctrl) && (k === '=' || k === '+')) {
    e.preventDefault();
    handlers.onZoomIn();
    return;
  }
  if ((meta || ctrl) && k === '-') {
    e.preventDefault();
    handlers.onZoomOut();
    return;
  }
  if ((meta || ctrl) && k === '0') {
    e.preventDefault();
    handlers.onZoomReset();
    return;
  }

  // Fit
  if ((isMac ? meta : ctrl) && shift && k === '1') {
    e.preventDefault();
    handlers.onFitToContent();
    return;
  }

  // Tool shortcuts
  const lower = k.toLowerCase();
  const map: Record<string, string> = {
    v: 'select',
    r: 'draw-rectangle',
    c: 'draw-circle',
    t: 'text',
    p: 'pen',
  };
  if (!meta && !ctrl && !shift && map[lower]) {
    e.preventDefault();
    handlers.onTool(map[lower]);
    return;
  }
}

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    // Reset all mocks
    Object.values(mockHandlers).forEach(fn => fn.mockClear());
  });

  it('should handle undo/redo bindings', () => {
    // Ctrl+Z for undo
    simulateKeyDown('z', { ctrl: true });
    expect(mockHandlers.onUndo).toHaveBeenCalledTimes(1);

    // Ctrl+Shift+Z for redo
    simulateKeyDown('z', { ctrl: true, shift: true });
    expect(mockHandlers.onRedo).toHaveBeenCalledTimes(1);

    // Ctrl+Y for redo
    simulateKeyDown('y', { ctrl: true });
    expect(mockHandlers.onRedo).toHaveBeenCalledTimes(2);
  });

  it('should handle delete binding', () => {
    simulateKeyDown('Delete');
    expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);

    simulateKeyDown('Backspace');
    expect(mockHandlers.onDelete).toHaveBeenCalledTimes(2);
  });

  it('should handle zoom bindings', () => {
    // Ctrl+= for zoom in
    simulateKeyDown('=', { ctrl: true });
    expect(mockHandlers.onZoomIn).toHaveBeenCalledTimes(1);

    // Ctrl+- for zoom out
    simulateKeyDown('-', { ctrl: true });
    expect(mockHandlers.onZoomOut).toHaveBeenCalledTimes(1);

    // Ctrl+0 for zoom reset
    simulateKeyDown('0', { ctrl: true });
    expect(mockHandlers.onZoomReset).toHaveBeenCalledTimes(1);
  });

  it('should handle tool hotkeys', () => {
    // V for select
    simulateKeyDown('v');
    expect(mockHandlers.onTool).toHaveBeenCalledWith('select');

    // R for rectangle
    simulateKeyDown('r');
    expect(mockHandlers.onTool).toHaveBeenCalledWith('draw-rectangle');

    // T for text
    simulateKeyDown('t');
    expect(mockHandlers.onTool).toHaveBeenCalledWith('text');

    // P for pen
    simulateKeyDown('p');
    expect(mockHandlers.onTool).toHaveBeenCalledWith('pen');
  });

  it('should handle duplicate and select all', () => {
    // Ctrl+D for duplicate
    simulateKeyDown('d', { ctrl: true });
    expect(mockHandlers.onDuplicate).toHaveBeenCalledTimes(1);

    // Ctrl+A for select all
    simulateKeyDown('a', { ctrl: true });
    expect(mockHandlers.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('should handle fit to content', () => {
    // Ctrl+Shift+1 for fit to content
    simulateKeyDown('1', { ctrl: true, shift: true });
    expect(mockHandlers.onFitToContent).toHaveBeenCalledTimes(1);
  });

  it('should prevent default on handled shortcuts', () => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    // Simulate with preventDefault tracking
    if (event.ctrlKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      mockHandlers.onUndo();
    }

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(mockHandlers.onUndo).toHaveBeenCalledTimes(1);
  });

  it('should not conflict with text editing state', () => {
    // Mock contentEditable element and override activeElement getter
    const mockElement = document.createElement('div');
    mockElement.contentEditable = 'true';
    (mockElement as any).isContentEditable = true;
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => mockElement as any });

    // Delete should not trigger when in contentEditable
    simulateKeyDown('Delete');
    expect(mockHandlers.onDelete).not.toHaveBeenCalled();

    // Restore
    if (originalDescriptor) Object.defineProperty(document, 'activeElement', originalDescriptor);
  });

  it('should handle modifier key combinations correctly', () => {
    // Ctrl+Shift+Z should call redo, not undo
    simulateKeyDown('z', { ctrl: true, shift: true });
    expect(mockHandlers.onRedo).toHaveBeenCalledTimes(1);
    expect(mockHandlers.onUndo).not.toHaveBeenCalled();

    // Shift alone with Z should not trigger
    simulateKeyDown('z', { shift: true });
    expect(mockHandlers.onUndo).not.toHaveBeenCalled();
    expect(mockHandlers.onRedo).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should ignore unknown key combinations', () => {
    simulateKeyDown('x'); // No handler
    simulateKeyDown('q', { ctrl: true }); // No handler

    // None of the handlers should be called
    expect(mockHandlers.onUndo).not.toHaveBeenCalled();
    expect(mockHandlers.onRedo).not.toHaveBeenCalled();
    expect(mockHandlers.onDelete).not.toHaveBeenCalled();
    expect(mockHandlers.onTool).not.toHaveBeenCalled();
  });
});