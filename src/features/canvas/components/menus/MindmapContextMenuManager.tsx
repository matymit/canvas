import React, { useCallback, useEffect, useState } from "react";
import type Konva from "konva";
import { MindmapContextMenu } from "./MindmapContextMenu";
import { MindmapContextMenuTool } from "../../tools/MindmapContextMenuTool";

interface MindmapContextMenuState {
  visible: boolean;
  nodeId: string | null;
  position: { x: number; y: number } | null;
}

export interface MindmapContextMenuManagerProps {
  stageRef: React.RefObject<Konva.Stage | null>;
}

export const MindmapContextMenuManager: React.FC<MindmapContextMenuManagerProps> = ({
  stageRef,
}) => {
  const [state, setState] = useState<MindmapContextMenuState>({
    visible: false,
    nodeId: null,
    position: null,
  });

  const closeMenu = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryHandle: ReturnType<typeof setTimeout> | null = null;
    let tool: MindmapContextMenuTool | null = null;
    const closeListener = () => closeMenu();

    let attachedStage: Konva.Stage | null = null;

    const attachWhenReady = () => {
      if (disposed) return;
      const stage = stageRef.current;
      if (!stage) {
        retryHandle = setTimeout(attachWhenReady, 100);
        return;
      }

      attachedStage = stage;
      tool = new MindmapContextMenuTool(stage, {
        onShowContextMenu: (nodeId, screenX, screenY) => {
          setState({
            visible: true,
            nodeId,
            position: { x: screenX, y: screenY },
          });
        },
      });

      stage.on("pointerdown.mindmap-menu", closeListener);
      stage.on("wheel.mindmap-menu", closeListener);
    };

    attachWhenReady();

    return () => {
      disposed = true;
      if (retryHandle) clearTimeout(retryHandle);
      attachedStage?.off("pointerdown.mindmap-menu", closeListener);
      attachedStage?.off("wheel.mindmap-menu", closeListener);
      tool?.destroy();
    };
  }, [stageRef, closeMenu]);

  const handleClose = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  if (!state.visible || !state.position || !state.nodeId) {
    return null;
  }

  return (
    <MindmapContextMenu
      nodeId={state.nodeId}
      x={state.position.x}
      y={state.position.y}
      onClose={handleClose}
      visible={state.visible}
    />
  );
};

export default MindmapContextMenuManager;
