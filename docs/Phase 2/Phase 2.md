# Phase 2: Essential Tools – Required Files

To implement the core drawing and interaction tools (selection, freehand drawing, basic shapes, and text), include the following files:

app/pages/Canvas.tsx  
features/canvas/components/ModernKonvaToolbar.tsx  
features/canvas/toolbar/ShapesDropdown.tsx  
features/canvas/toolbar/ColorPicker.tsx  
features/canvas/toolbar/PortalColorPicker.tsx  

features/canvas/components/tools/drawing/PenTool.tsx  
features/canvas/components/tools/drawing/MarkerTool.tsx  
features/canvas/components/tools/drawing/HighlighterTool.tsx  

features/canvas/components/tools/shapes/RectangleTool.tsx  
features/canvas/components/tools/shapes/TriangleTool.tsx  

features/canvas/components/tools/content/TextTool.tsx  

features/canvas/hooks/useSelectionManager.ts  
features/canvas/hooks/useCanvasEventManager.ts  

features/canvas/renderermodular/modules/DrawingModule.ts  
features/canvas/renderermodular/modules/ShapeModule.ts  
features/canvas/renderermodular/modules/TextModule.ts  

features/canvas/stores/modules/drawingModule.ts  
features/canvas/stores/modules/selectionModule.ts  
features/canvas/stores/modules/elementModule.ts  

features/canvas/utils/DirectKonvaDrawing.ts  
features/canvas/utils/ShapeCaching.ts  

This set ensures you have:  
- **Toolbar UI** to select tools and colors  
- **Drawing tools** (pen, marker, highlighter)  
- **Basic shape tools** (rectangle, triangle)  
- **Text tool** with rich-text support  
- **Event & selection management** hooks  
- **Renderer modules** for each tool category  
- **State slices** for drawing, selection, and element CRUD  
- **Utility functions** for optimized drawing and shape caching