import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

export class ToolPreviewLayer {
  static getPreviewLayer(stage: Konva.Stage): Konva.Layer | null {
    // Returns the existing preview layer (layer index 3 by our 5-layer setup)
    const layers = stage.getLayers();
    return layers.length > 3 ? (layers[3] as Konva.Layer) : null;
  }

  static commitStroke(stage: Konva.Stage, line: Konva.Line, elementProps: { id: string; type: 'drawing'; subtype: string; points: number[]; bounds: {x:number;y:number;width:number;height:number}; style: any; }, actionName: string, interactiveAfter = true) {
    const mainLayer = stage.getLayers()[2] as Konva.Layer | undefined;
    if (mainLayer) {
      if (interactiveAfter) { line.listening(true); } else { line.listening(false); }
      line.moveTo(mainLayer);
      mainLayer.batchDraw();
    } else {
      // Fallback: no main layer available, keep on stage top
      line.moveToTop();
      stage.draw();
    }
    // Use store action to persist the element with history
    const store = useUnifiedCanvasStore.getState();
    if (store.element?.upsert && store.withUndo) {
      const { id, ...createProps } = elementProps;
      store.withUndo(actionName, () => {
        store.element.upsert(createProps);
      });
    }
  }
}
