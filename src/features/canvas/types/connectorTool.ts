import type Konva from "konva";
import type { AnchorSide } from "./connector";

export interface ConnectorPort {
  id: string;
  elementId: string;
  position: {
    x: number;
    y: number;
  };
  anchor: AnchorSide;
}

export interface ConnectorToolHandle {
  handlePortClick: (
    port: ConnectorPort,
    event: Konva.KonvaEventObject<PointerEvent>,
  ) => void;
}
