// Barrel export for canvas components
export { default as CanvasContainer } from './CanvasContainer';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as CanvasToolbar } from '../toolbar/CanvasToolbar';
export { default as NonReactCanvasStage } from './NonReactCanvasStage';
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
export * from './tools/shapes/RectangleTool';
export * from './tools/shapes/TriangleTool';