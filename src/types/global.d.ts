// Global type declarations for E2E testing
export {};

declare global {
  interface Window {
    konvaStage?: import("konva/types/Stage").Stage;
  }
}
