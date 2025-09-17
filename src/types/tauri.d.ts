// Tauri window global type definitions

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      tauri?: unknown;
      path?: unknown;
      fs?: unknown;
      dialog?: unknown;
    };
  }
}

export {};