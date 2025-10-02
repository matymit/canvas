import { useEffect, useMemo } from "react";
import type { MutableRefObject, ReactNode, RefObject } from "react";
import type Konva from "konva";

import type ToolManager from "../../../managers/ToolManager";
import type { RafBatcher } from "../../../utils/performance/RafBatcher";
import StickyNoteTool from "../../tools/creation/StickyNoteTool";
import ConnectorTool from "../../tools/creation/ConnectorTool";
import TextTool from "../../tools/content/TextTool";
import ImageTool from "../../tools/content/ImageTool";
import TableTool from "../../tools/content/TableTool";
import MindmapTool from "../../tools/content/MindmapTool";
import CircleTool from "../../tools/shapes/CircleTool";
import { PenTool } from "../../tools/drawing/PenTool";
import MarkerTool from "../../tools/drawing/MarkerTool";
import HighlighterTool from "../../tools/drawing/HighlighterTool";
import EraserTool from "../../tools/drawing/EraserTool";
import { error as logError } from "../../../../../utils/debug";

type ConnectorLayers = {
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
};

type UseCanvasToolsArgs = {
  containerRef: RefObject<HTMLDivElement | null>;
  stageRef: MutableRefObject<Konva.Stage | null>;
  toolManagerRef: MutableRefObject<ToolManager | null>;
  connectorLayersRef: MutableRefObject<ConnectorLayers | null>;
  rafBatcherRef: MutableRefObject<RafBatcher>;
  selectedTool?: string;
};

type UseCanvasToolsResult = {
  activeToolNode: ReactNode;
};

export const useCanvasTools = ({
  containerRef,
  stageRef,
  toolManagerRef,
  connectorLayersRef,
  rafBatcherRef,
  selectedTool,
}: UseCanvasToolsArgs): UseCanvasToolsResult => {
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let cursor: string = "default";
    switch ((selectedTool ?? "select").toLowerCase()) {
      case "pan":
        cursor = "grab";
        break;
      case "pen":
      case "marker":
      case "highlighter":
      case "eraser":
      case "sticky-note":
      case "sticky":
      case "rectangle":
      case "draw-rectangle":
      case "ellipse":
      case "circle":
      case "draw-circle":
      case "triangle":
      case "draw-triangle":
      case "line":
      case "connector":
      case "connector-line":
      case "connector-arrow":
      case "image":
      case "table":
      case "mindmap":
        cursor = "crosshair";
        break;
      case "text":
        cursor = "text";
        break;
      case "select":
      default:
        cursor = "default";
    }

    containerRef.current.style.cursor = cursor;

    const manager = toolManagerRef.current;
    if (manager) {
      if ((selectedTool ?? "").toLowerCase() === "text") {
        manager.activateCanvasTool("text");
      } else {
        const activeTool = manager.getActiveCanvasTool();
        if (activeTool) {
          activeTool.detach();
        }
      }
    }
  }, [containerRef, toolManagerRef, selectedTool]);

  const activeToolNode = useMemo(() => {
    if (!stageRef.current) return null;

    const toolKey = (selectedTool ?? "select").toLowerCase();
    const toolProps = { isActive: true, stageRef };

    try {
      switch (toolKey) {
        case "sticky-note":
        case "sticky":
          return <StickyNoteTool key="sticky-tool" {...toolProps} />;
        case "text":
          return <TextTool key="text-tool" {...toolProps} />;
        case "image":
          return <ImageTool key="image-tool" {...toolProps} />;
        case "table":
          return <TableTool key="table-tool" {...toolProps} />;
        case "mindmap":
          return <MindmapTool key="mindmap-tool" {...toolProps} />;
        case "circle":
        case "ellipse":
        case "draw-circle": {
          const circleToolId = selectedTool ?? toolKey;
          return <CircleTool key="circle-tool" {...toolProps} toolId={circleToolId} />;
        }
        case "rectangle":
        case "draw-rectangle":
        case "triangle":
        case "draw-triangle":
          return null;
        case "connector":
        case "connector-line":
        case "connector-arrow": {
          const layers = connectorLayersRef.current;
          if (!layers) return null;
          return (
            <ConnectorTool
              key="connector-tool"
              {...toolProps}
              toolId={(selectedTool as "connector-line" | "connector-arrow") ?? "connector-line"}
              layers={layers}
            />
          );
        }
        case "pen":
          return <PenTool key="pen-tool" {...toolProps} rafBatcher={rafBatcherRef.current} />;
        case "marker":
          return <MarkerTool key="marker-tool" {...toolProps} rafBatcher={rafBatcherRef.current} />;
        case "highlighter":
          return <HighlighterTool key="highlighter-tool" {...toolProps} rafBatcher={rafBatcherRef.current} />;
        case "eraser":
          return <EraserTool key="eraser-tool" {...toolProps} rafBatcher={rafBatcherRef.current} />;
        default:
          return null;
      }
    } catch (error) {
      logError("Failed to render tool", {
        category: "FigJamCanvas",
        data: { selectedTool, error },
      });
      return null;
    }
  }, [connectorLayersRef, rafBatcherRef, selectedTool, stageRef]);

  return { activeToolNode };
};

export default useCanvasTools;
