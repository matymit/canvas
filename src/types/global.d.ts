// Global type declarations for E2E testing
import type { Stage } from 'konva/types/Stage';

export {};

declare global {
  interface Window {
    konvaStage?: Stage;
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
  }
  interface Navigator {
    userAgentData?: {
      platform?: string;
    };
  }
}
