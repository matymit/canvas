# Phase 3: Advanced Features – Required Files

To implement connectors, section containers, sticky notes, and undo/redo, include the following files:

app/pages/Canvas.tsx  
features/canvas/components/tools/creation/ConnectorTool.tsx  
features/canvas/components/tools/creation/StickyNoteTool.tsx  

features/canvas/stores/modules/edgeModule.ts  
features/canvas/stores/modules/sectionModule.ts  
features/canvas/stores/modules/historyModule.ts  

features/canvas/hooks/useCanvasHistory.ts  
features/canvas/hooks/useCanvasHistoryHelpers. ts 

features/canvas/renderermodular/modules/ConnectorModule.ts  
features/canvas/renderermodular/modules/StickyNoteModule.ts  

features/canvas/utils/StoreTransactionManager.ts  

This set covers:  
- **Connector system** (tool + renderer module + edge store)  
- **Sticky notes** (tool + renderer module + element store)  
- **Section containers** (section store)  
- **Undo/redo** (history store + hooks + transaction manager)