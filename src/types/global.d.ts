// Global type declarations for E2E testing
import type { Stage } from 'konva/types/Stage';
import type { PortHoverModule } from '../features/canvas/renderer/modules/PortHoverModule';
import type { ConnectorToolHandle } from '../features/canvas/types/connectorTool';

interface GlobalSelectionModule {
  selectElement?: (elementId: string, options?: { additive?: boolean }) => void;
  clearSelection?: () => void;
  toggleSelection?: (elementId: string, additive?: boolean) => void;
  [key: string]: unknown;
}

interface GlobalTableContextMenuBridge {
  show?: (
    screenX: number,
    screenY: number,
    tableId: string,
    row: number,
    col: number,
  ) => void;
  close?: () => void;
}

export {};

declare global {
  interface Window {
    konvaStage?: Stage;
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
    shapeRenderer?: {
      syncTextDuringTransform?: (id: string) => void;
    };
    portHoverModule?: PortHoverModule;
    selectionModule?: GlobalSelectionModule;
    activeConnectorTool?: ConnectorToolHandle | null;
    tableContextMenu?: GlobalTableContextMenuBridge;
  }
  interface Navigator {
    userAgentData?: {
      platform?: string;
    };
  }
}
