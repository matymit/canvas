import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessibilityManager } from '../../accessibility/AccessibilityManager';
import { ScreenReaderUtils } from '../../accessibility/ScreenReaderUtils';

// Mock DOM
const mockElement = (tag: string) => {
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    textContent: '',
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    focus: vi.fn(),
    querySelector: vi.fn(),
    parentElement: null,
    style: {},
    tabIndex: -1,
  };
  return el;
};

vi.mock('../../accessibility/ScreenReaderUtils', () => ({
  ScreenReaderUtils: {
    applyCanvasAria: vi.fn(),
    ensureVirtualRoot: vi.fn(() => mockElement('div')),
    createLiveRegion: vi.fn(() => ({
      root: mockElement('div'),
      announce: vi.fn(),
    })),
  },
}));

describe('Accessibility Announcements', () => {
  let manager: AccessibilityManager;
  let mockStage: any;
  let mockContainer: any;

  beforeEach(() => {
    mockContainer = mockElement('div');
    mockStage = {
      container: vi.fn(() => mockContainer),
    };
    manager = new AccessibilityManager();
  });

  it('should emit tool change aria-live copy', () => {
    const mockAnnounce = vi.fn();
    (ScreenReaderUtils.createLiveRegion as any).mockReturnValue({
      root: mockElement('div'),
      announce: mockAnnounce,
    });

    manager.attachStage(mockStage);

    // Simulate tool change announcement
    manager.announce('Switched to Pen tool', 'polite');

    expect(mockAnnounce).toHaveBeenCalledWith('Switched to Pen tool');
  });

  it('should handle assertive announcements for urgent changes', () => {
    const mockPoliteAnnounce = vi.fn();
    const mockAssertiveAnnounce = vi.fn();

    (ScreenReaderUtils.createLiveRegion as any)
      .mockReturnValueOnce({
        root: mockElement('div'),
        announce: mockPoliteAnnounce,
      })
      .mockReturnValueOnce({
        root: mockElement('div'),
        announce: mockAssertiveAnnounce,
      });

    manager.attachStage(mockStage);

    // Initial attach emits a polite announcement; clear it so this test isolates assertive path
    mockPoliteAnnounce.mockClear();

    manager.announce('Error: Cannot save file', 'assertive');

    expect(mockAssertiveAnnounce).toHaveBeenCalledWith('Error: Cannot save file');
    expect(mockPoliteAnnounce).not.toHaveBeenCalled();
  });

  it('should auto-cleanup of injected nodes after timeout', () => {
    vi.useFakeTimers();

    const mockLiveRegion = mockElement('div');
    const mockAnnounce = vi.fn(() => {
      mockLiveRegion.textContent = 'Test message';
      // Simulate cleanup after timeout
      setTimeout(() => {
        mockLiveRegion.textContent = '';
      }, 5000);
    });

    (ScreenReaderUtils.createLiveRegion as any).mockReturnValue({
      root: mockLiveRegion,
      announce: mockAnnounce,
    });

    manager.attachStage(mockStage);
    manager.announce('Temporary message', 'polite');

    expect(mockLiveRegion.textContent).toBe('Test message');

    // Fast-forward time
    vi.advanceTimersByTime(5000);

    expect(mockLiveRegion.textContent).toBe('');
  });

  it('should announce initial canvas context on attach', () => {
    const mockAnnounce = vi.fn();
    (ScreenReaderUtils.createLiveRegion as any).mockReturnValue({
      root: mockElement('div'),
      announce: mockAnnounce,
    });

    manager.attachStage(mockStage);

    expect(mockAnnounce).toHaveBeenCalledWith(
      'Canvas focused. 0 items. Use Tab and Shift+Tab to navigate; Arrow keys to move selection.'
    );
  });

  it('should announce node activation with position info', () => {
    const mockAnnounce = vi.fn();
    (ScreenReaderUtils.createLiveRegion as any).mockReturnValue({
      root: mockElement('div'),
      announce: mockAnnounce,
    });

    manager.attachStage(mockStage);

    // Clear initial announcement
    mockAnnounce.mockClear();

    // Stub getElementById to return a fake virtual node element
    const originalGet = document.getElementById;
    (document as any).getElementById = vi.fn((id: string) => {
      if (id === 'acc-node-node1') {
        return {
          id,
          setAttribute: vi.fn(),
          removeAttribute: vi.fn(),
        } as any;
      }
      return null;
    });

    // Register a node
    manager.registerNode({
      id: 'node1',
      name: 'Rectangle',
      description: 'A red rectangle',
      posInSet: 1,
      setSize: 3,
    });

    // Set as active
    manager.setActive('node1');

    expect(mockAnnounce).toHaveBeenCalledWith('Rectangle. A red rectangle. Item 1 of 3');

    // Restore getElementById
    (document as any).getElementById = originalGet as any;
  });

  it('should handle multiple announcements without interference', () => {
    const mockAnnounce = vi.fn();
    (ScreenReaderUtils.createLiveRegion as any).mockReturnValue({
      root: mockElement('div'),
      announce: mockAnnounce,
    });

    manager.attachStage(mockStage);

    manager.announce('First message');
    manager.announce('Second message');
    manager.announce('Third message', 'assertive');

    expect(mockAnnounce).toHaveBeenCalledTimes(4); // 3 + initial
    expect(mockAnnounce).toHaveBeenNthCalledWith(2, 'First message');
    expect(mockAnnounce).toHaveBeenNthCalledWith(3, 'Second message');
  });

  it('should cleanup live regions on destroy', () => {
    const mockLiveRegion = mockElement('div');
    mockLiveRegion.parentElement = mockElement('div');

    (ScreenReaderUtils.createLiveRegion as any).mockReturnValue({
      root: mockLiveRegion,
      announce: vi.fn(),
    });

    manager.attachStage(mockStage);
    manager.destroy();

    expect(mockLiveRegion.parentElement.removeChild).toHaveBeenCalledWith(mockLiveRegion);
  });
});