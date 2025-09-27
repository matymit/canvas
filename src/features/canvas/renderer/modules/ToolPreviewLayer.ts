import type Konva from 'konva';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { CanvasElement } from '../../../../../types/index';

interface DrawingElementProps {
  id: string;
  type: 'drawing';
  subtype: 'pen' | 'marker' | 'highlighter' | 'eraser';
  points: number[];
  bounds: { x: number; y: number; width: number; height: number };
  style?: CanvasElement['style'];
}

export class ToolPreviewLayer {
  static getPreviewLayer(stage: Konva.Stage): Konva.Layer | null {
    // Returns the existing preview layer (layer index 2 within the 4-layer setup)
    const layers = stage.getLayers();
    return layers.length > 2 ? (layers[2] as Konva.Layer) : null;
  }

  static commitStroke(
    stage: Konva.Stage,
    line: Konva.Line,
    elementProps: DrawingElementProps,
    actionName: string,
    interactiveAfter = true,
  ) {
    if (interactiveAfter) {
      line.listening(true);
    } else {
      line.listening(false);
    }

    line.destroy();
    stage.draw();
    // Use store action to persist the element with history
    const store = useUnifiedCanvasStore.getState();
    if (store.element?.upsert && store.withUndo) {
      const elementToCreate: CanvasElement = {
        id: elementProps.id,
        type: elementProps.type,
        subtype: elementProps.subtype,
        points: elementProps.points,
        x: elementProps.bounds.x,
        y: elementProps.bounds.y,
        width: elementProps.bounds.width,
        height: elementProps.bounds.height,
        style: elementProps.style,
      };
      store.withUndo(actionName, () => {
        store.element.upsert(elementToCreate);
      });
    }
  }
}
