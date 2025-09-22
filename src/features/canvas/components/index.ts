// Barrel export for canvas components
// Note: CanvasContainer archived - using FigJamCanvas instead
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as CanvasToolbar } from '../toolbar/CanvasToolbar';
// Note: NonReactCanvasStage archived - using direct Konva integration
export { default as PerformanceDashboard } from './PerformanceDashboard';
export { default as PerformanceOverlayHUD } from './PerformanceOverlayHUD';

// UI components
export { default as ZoomControls } from './ZoomControls';

// Tools
export * from './tools/creation/StickyNoteTool';
export * from './tools/creation/ConnectorTool';
export * from './tools/content/TextTool';
export * from './tools/drawing/HighlighterTool';
export * from './tools/drawing/MarkerTool';
export * from './tools/drawing/PenTool';
// RectangleTool and TriangleTool exports removed - tools have been archived