import { useEffect, useMemo } from "react";
import type { MutableRefObject, ReactNode } from "react";
import type Konva from "konva";

import { TableContextMenuManager } from "../../table/TableContextMenuManager";
import { MindmapContextMenuManager } from "../../menus/MindmapContextMenuManager";
import { CanvasContextMenuManager } from "../../CanvasContextMenuManager";
import type { CanvasElement, ElementId } from "@types";

type UseCanvasServicesArgs = {
  stageRef: MutableRefObject<Konva.Stage | null>;
  elements: Map<ElementId, CanvasElement>;
};

type UseCanvasServicesResult = {
  serviceNodes: ReactNode;
};

export const useCanvasServices = ({
  stageRef,
  elements,
}: UseCanvasServicesArgs): UseCanvasServicesResult => {
  useEffect(() => {
    // Renderer modules subscribe directly to the store. Accessing elements here keeps
    // React in sync with store-driven mutations that may not change Map identity.
  }, [elements]);

  const serviceNodes = useMemo(
    () => (
      <>
        <TableContextMenuManager stageRef={stageRef} />
        <MindmapContextMenuManager stageRef={stageRef} />
        <CanvasContextMenuManager stageRef={stageRef} />
      </>
    ),
    [stageRef],
  );

  return { serviceNodes };
};

export default useCanvasServices;
