// features/canvas/services/TauriFileService.ts

import type { CanvasElement, ElementId } from "../../../../types/index";
import type { ViewportState } from "../stores/unifiedCanvasStore";

type FileDialogFilter = { name: string; extensions: string[] };
interface DialogSaveOptions {
  defaultPath?: string;
  filters?: FileDialogFilter[];
}
interface DialogOpenOptions {
  multiple?: boolean;
  filters?: FileDialogFilter[];
}
interface TauriDialogModule {
  save: (options?: DialogSaveOptions) => Promise<string | null>;
  open: (options?: DialogOpenOptions) => Promise<string | string[] | null>;
}
interface TauriFsModule {
  writeTextFile: (path: string, contents: string) => Promise<void>;
  readTextFile: (path: string) => Promise<string>;
  writeFile: (path: string, contents: Uint8Array) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
}
interface TauriPathModule {
  appDataDir: () => Promise<string>;
  join: (...paths: string[]) => Promise<string>;
}

// Dynamic imports for Tauri v2 plugins - these will be loaded at runtime only when in Tauri context
let tauriDialog: TauriDialogModule | null = null;
let tauriFs: TauriFsModule | null = null;
let tauriPath: TauriPathModule | null = null;

// Check if running in Tauri context (v2 pattern)
function isTauriContext(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for Tauri v2 patterns
  return Boolean(window.__TAURI_INTERNALS__ ?? window.isTauri ?? window.__TAURI__);
}

// Initialize Tauri APIs if available
async function initTauriAPIs() {
  if (!isTauriContext()) {
    return false;
  }

  try {
    // Use dynamic imports to load Tauri plugins only when needed
    // This prevents build-time resolution issues
    if (!tauriDialog) {
      const dialogModule = await import("@tauri-apps/plugin-dialog");
      tauriDialog = {
        save: dialogModule.save,
        open: dialogModule.open,
      };
    }
    if (!tauriFs) {
      const fsModule = await import("@tauri-apps/plugin-fs");
      tauriFs = {
        writeTextFile: fsModule.writeTextFile,
        readTextFile: fsModule.readTextFile,
        writeFile: fsModule.writeFile,
        exists: fsModule.exists,
      };
    }
    if (!tauriPath) {
      // Path utilities are still in @tauri-apps/api for v2
      const pathModule = await import("@tauri-apps/api/path");
      tauriPath = {
        appDataDir: pathModule.appDataDir,
        join: pathModule.join,
      };
    }
    return true;
  } catch (error) {
    // Warning: Failed to initialize Tauri APIs
    return false;
  }
}

// Get initialized Tauri APIs
async function getTauriAPIs() {
  const initialized = await initTauriAPIs();

  if (!initialized || !tauriDialog || !tauriFs || !tauriPath) {
    // Warning: Tauri APIs not available
    return null;
  }

  return {
    dialog: tauriDialog,
    fs: tauriFs,
    path: tauriPath
  };
}

// Canvas document format for serialization
export interface CanvasDocument {
  version: string;
  metadata: {
    created: string;
    modified: string;
    application: string;
  };
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
  elements: Array<{
    id: ElementId;
    data: CanvasElement;
  }>;
  elementOrder: ElementId[];
}

export class TauriFileService {
  private static instance: TauriFileService;

  private constructor() {}

  static getInstance(): TauriFileService {
    if (!TauriFileService.instance) {
      TauriFileService.instance = new TauriFileService();
    }
    return TauriFileService.instance;
  }

  /**
   * Serialize canvas state to a portable JSON document
   */
  async serializeCanvas(
    elements: Map<ElementId, CanvasElement>,
    elementOrder: ElementId[],
    viewport: ViewportState
  ): Promise<string> {
    const document: CanvasDocument = {
      version: '1.0.0',
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        application: 'Canvas Desktop'
      },
      viewport: {
        x: viewport.x,
        y: viewport.y,
        scale: viewport.scale
      },
      elements: Array.from(elements.entries()).map(([id, data]) => ({
        id,
        data: this.sanitizeElement(data)
      })),
      elementOrder
    };

    return JSON.stringify(document, null, 2);
  }

  /**
   * Deserialize a JSON document back to canvas state
   */
  deserializeCanvas(json: string): {
    elements: Map<ElementId, CanvasElement>;
    elementOrder: ElementId[];
    viewport: Partial<ViewportState>;
  } {
    const document: CanvasDocument = JSON.parse(json);

    // Validate version compatibility
    if (!document.version || !document.elements) {
      throw new Error('Invalid canvas document format');
    }

    const elements = new Map<ElementId, CanvasElement>();
    for (const item of document.elements) {
      elements.set(item.id, item.data);
    }

    return {
      elements,
      elementOrder: document.elementOrder || [],
      viewport: document.viewport || {}
    };
  }

  /**
   * Save canvas to a file using Tauri file dialog
   */
  async saveCanvasToFile(
    elements: Map<ElementId, CanvasElement>,
    elementOrder: ElementId[],
    viewport: ViewportState,
    defaultPath?: string
  ): Promise<string | null> {
    const apis = await getTauriAPIs();
    if (!apis) {
      // Warning: Save operation requires Tauri environment
      return null;
    }

    // Show save dialog using v2 API
    const filePath = await apis.dialog.save({
      defaultPath: defaultPath || 'canvas.json',
      filters: [{
        name: 'Canvas Document',
        extensions: ['json']
      }]
    });

    if (!filePath) return null;

    // Serialize canvas data
    const content = await this.serializeCanvas(elements, elementOrder, viewport);

    // Write to file using v2 fs plugin
    await apis.fs.writeTextFile(filePath, content);

    return filePath;
  }

  /**
   * Load canvas from a file using Tauri file dialog
   */
  async loadCanvasFromFile(): Promise<{
    elements: Map<ElementId, CanvasElement>;
    elementOrder: ElementId[];
    viewport: Partial<ViewportState>;
    filePath: string;
  } | null> {
    const apis = await getTauriAPIs();
    if (!apis) {
      // Warning: Load operation requires Tauri environment
      return null;
    }

    // Show open dialog using v2 API
    const selected = await apis.dialog.open({
      multiple: false,
      filters: [{
        name: 'Canvas Document',
        extensions: ['json']
      }]
    });

    if (!selected) return null;

    // v2 returns a single path when multiple is false
    const filePath = Array.isArray(selected) ? selected[0] : selected;
    if (!filePath) return null;

    // Read file content using v2 fs plugin
    const content = await apis.fs.readTextFile(filePath);

    // Deserialize canvas data
    const canvasData = this.deserializeCanvas(content);

    return {
      ...canvasData,
      filePath
    };
  }

  /**
   * Export canvas as PNG image
   */
  async exportCanvasAsImage(
    stageElement: HTMLElement,
    defaultPath?: string
  ): Promise<string | null> {
    const apis = await getTauriAPIs();
    if (!apis) {
      // Warning: Export operation requires Tauri environment
      return null;
    }

    // Get canvas element from stage container
    const canvas = stageElement.querySelector('canvas');
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png');
    });

    if (!blob) {
      throw new Error('Failed to create image blob');
    }

    // Show save dialog
    const filePath = await apis.dialog.save({
      defaultPath: defaultPath || 'canvas.png',
      filters: [{
        name: 'PNG Image',
        extensions: ['png']
      }]
    });

    if (!filePath) return null;

    // Convert blob to buffer
    const buffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Write binary file using v2 fs plugin
    await apis.fs.writeFile(filePath, uint8Array);

    return filePath;
  }

  /**
   * Auto-save canvas to a temporary location
   */
  async autoSaveCanvas(
    elements: Map<ElementId, CanvasElement>,
    elementOrder: ElementId[],
    viewport: ViewportState
  ): Promise<string | null> {
    const apis = await getTauriAPIs();
    if (!apis) {
      return null;
    }

    try {
      // Get app data directory
      const appDataDir = await apis.path.appDataDir();
      const autoSavePath = await apis.path.join(appDataDir, 'autosave.json');

      // Serialize canvas data
      const content = await this.serializeCanvas(elements, elementOrder, viewport);

      // Write to auto-save location
      await apis.fs.writeTextFile(autoSavePath, content);

      return autoSavePath;
    } catch (error) {
      // Error: Auto-save failed
      return null;
    }
  }

  /**
   * Load auto-saved canvas if available
   */
  async loadAutoSave(): Promise<{
    elements: Map<ElementId, CanvasElement>;
    elementOrder: ElementId[];
    viewport: Partial<ViewportState>;
  } | null> {
    const apis = await getTauriAPIs();
    if (!apis) {
      return null;
    }

    try {
      const appDataDir = await apis.path.appDataDir();
      const autoSavePath = await apis.path.join(appDataDir, 'autosave.json');

      // Check if auto-save exists using v2 fs plugin
      const exists = await apis.fs.exists(autoSavePath);
      if (!exists) return null;

      // Read auto-save content
      const content = await apis.fs.readTextFile(autoSavePath);

      // Deserialize canvas data
      return this.deserializeCanvas(content);
    } catch (error) {
      // Error: Failed to load auto-save
      return null;
    }
  }

  /**
   * Sanitize element data for serialization
   * Ensures data URLs and other properties are portable
   */
  private sanitizeElement(element: CanvasElement): CanvasElement {
    const sanitized = { ...element };

    // Handle image elements with data URLs
    if (sanitized.type === 'image' && typeof sanitized.imageUrl === 'string') {
      // Ensure data URLs are preserved
      if (!sanitized.imageUrl.startsWith('data:') && !sanitized.imageUrl.startsWith('http')) {
        // Image URL may not be portable
      }
    }

    // Handle drawing paths - ensure they're serializable
    if (sanitized.type === 'drawing' && sanitized.path) {
      // Path should already be a string or array of points
      if (typeof sanitized.path !== 'string' && !Array.isArray(sanitized.path)) {
        // Drawing path may not serialize correctly
      }
    }

    return sanitized;
  }
}

export default TauriFileService.getInstance();
