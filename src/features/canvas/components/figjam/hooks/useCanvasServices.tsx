import React, { MutableRefObject, useEffect, useMemo } from "react";
import Konva from "konva";

import { TableContextMenuManager } from "../../table/TableContextMenuManager";
import { MindmapContextMenuManager } from "../../menus/MindmapContextMenuManager";
import { CanvasContextMenuManager } from "../../CanvasContextMenuManager";

type UseCanvasServicesArgs = {
  stageRef: MutableRefObject<Konva.Stage | null>;
  elements: Map<string, unknown>;
};

type UseCanvasServicesResult = {
  serviceNodes: React.ReactNode;
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
