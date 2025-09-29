import { getNodeConnectionPoint } from "@features/canvas/types/mindmap";
import type { TransformSnapshot } from "../types";
import type { MindmapNodeProjector, MindmapEdgeRenderer } from "../types";

interface MindmapControllerDeps {
  projectNode: MindmapNodeProjector;
  renderEdge: MindmapEdgeRenderer;
}

export class MindmapController {
  constructor(private readonly deps: MindmapControllerDeps) {}

  update(snapshot: TransformSnapshot | null, delta: { dx: number; dy: number }) {
    if (!snapshot) return;

    const { mindmapEdges, basePositions } = snapshot;
    mindmapEdges.forEach((edgeSnapshot) => {
      this.deps.renderEdge(edgeSnapshot, (nodeId, side) => {
        const baseline = basePositions.get(nodeId);
        const projected = this.deps.projectNode(nodeId, baseline, delta);
        if (!projected) return null;
        const anchor = getNodeConnectionPoint(projected, side);
        if (!anchor) return null;
        return anchor;
      });
    });
  }
}
