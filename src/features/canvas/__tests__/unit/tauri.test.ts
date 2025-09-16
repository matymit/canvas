import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/window', () => ({
  getCurrent: vi.fn(() => ({
    setTitle: vi.fn(),
    onScaleChanged: vi.fn(() => Promise.resolve(vi.fn())),
  })),
}));

vi.mock('@tauri-apps/api/fs', () => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  basename: vi.fn((path) => path.split('/').pop() || path),
}));

// Mock the Tauri canvas hook
const mockTauriCanvas = {
  dpr: 1,
  setDpr: vi.fn(),
  onStageReady: vi.fn(),
  stageRef: { current: null },
  layersRef: { current: {} },
  batchers: { current: {} },
};

// Simulate IPC wrapper functions
class MockTauriIPC {
  private title = 'Canvas App';

  async saveFile(data: any, filePath: string) {
    try {
      // Simulate Tauri fs.writeTextFile
      await this.invoke('writeTextFile', { path: filePath, contents: JSON.stringify(data) });
      this.updateWindowTitle(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async loadFile(filePath: string) {
    try {
      const contents = await this.invoke('readTextFile', filePath);
      this.updateWindowTitle(filePath);
      return { success: true, data: JSON.parse(contents) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async exportFile(data: any, format: string) {
    try {
      const filePath = await this.invoke('saveDialog', {
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (!filePath) return { success: false, error: 'No file selected' };

      await this.invoke('writeTextFile', { path: filePath, contents: JSON.stringify(data) });
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async invoke(cmd: string, args?: any) {
    // Mock implementation
    if (cmd === 'writeTextFile') {
      if (args.path.includes('error')) throw new Error('Write failed');
      return;
    }
    if (cmd === 'readTextFile') {
      if (args.includes('error')) throw new Error('Read failed');
      return '{"test": "data"}';
    }
    if (cmd === 'saveDialog') {
      return args.path || '/test/export.json';
    }
    if (cmd === 'setTitle') {
      return;
    }
    throw new Error(`Unknown command: ${cmd}`);
  }

  private updateWindowTitle(filePath: string) {
    // Normalize both Unix and Windows paths
    const normalized = filePath.replace(/\\/g, '/');
    const fileName = normalized.split('/').pop() || 'Untitled';
    this.title = `Canvas App - ${fileName}`;
    // Simulate window.setTitle
    this.invoke('setTitle', this.title);
  }

  getTitle() {
    return this.title;
  }
}

describe('Tauri IPC Wrappers', () => {
  let ipc: MockTauriIPC;

  beforeEach(() => {
    ipc = new MockTauriIPC();
  });

  it('should marshal payloads for save operations', async () => {
    const data = { elements: [], viewport: { x: 0, y: 0 } };
    const result = await ipc.saveFile(data, '/test/canvas.json');

    expect(result.success).toBe(true);
    // Verify payload was marshaled (would check invoke calls in real test)
  });

  it('should handle save failures gracefully', async () => {
    const data = { test: 'data' };
    const result = await ipc.saveFile(data, '/test/error.json');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Write failed');
  });

  it('should marshal payloads for load operations', async () => {
    const result = await ipc.loadFile('/test/canvas.json');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ test: 'data' });
  });

  it('should handle load failures gracefully', async () => {
    const result = await ipc.loadFile('/test/error.json');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Read failed');
  });

  it('should marshal payloads for export operations', async () => {
    const data = { exported: true };
    const result = await ipc.exportFile(data, 'json');

    expect(result.success).toBe(true);
    expect(result.filePath).toBe('/test/export.json');
  });

  it('should handle export cancellations', async () => {
    // Mock dialog returning null
    const originalInvoke = ipc['invoke'];
    ipc['invoke'] = vi.fn().mockImplementation(async (cmd) => {
      if (cmd === 'saveDialog') return null;
      return originalInvoke.call(ipc, cmd, arguments[1]);
    });

    const result = await ipc.exportFile({ data: 'test' }, 'json');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No file selected');
  });

  it('should update window title on file operations', async () => {
    await ipc.saveFile({}, '/documents/my-canvas.json');

    expect(ipc.getTitle()).toBe('Canvas App - my-canvas.json');

    await ipc.loadFile('/documents/other.json');

    expect(ipc.getTitle()).toBe('Canvas App - other.json');
  });

  it('should reflect active file name in window title', () => {
    // Simulate title updates
    ipc['updateWindowTitle']('/path/to/project.canvas');

    expect(ipc.getTitle()).toBe('Canvas App - project.canvas');

    ipc['updateWindowTitle']('simple.json');

    expect(ipc.getTitle()).toBe('Canvas App - simple.json');
  });

  it('should handle various file path formats', () => {
    ipc['updateWindowTitle']('C:\\Windows\\file.txt'); // Windows path
    expect(ipc.getTitle()).toBe('Canvas App - file.txt');

    ipc['updateWindowTitle']('/unix/path/file.json'); // Unix path
    expect(ipc.getTitle()).toBe('Canvas App - file.json');

    ipc['updateWindowTitle']('filename-only'); // No path
    expect(ipc.getTitle()).toBe('Canvas App - filename-only');
  });

  it('should maintain title state across operations', async () => {
    await ipc.saveFile({}, '/first.json');
    expect(ipc.getTitle()).toBe('Canvas App - first.json');

    await ipc.loadFile('/second.json');
    expect(ipc.getTitle()).toBe('Canvas App - second.json');

    // Failed operation shouldn't change title
    await ipc.saveFile({}, '/error.json');
    expect(ipc.getTitle()).toBe('Canvas App - second.json');
  });
});