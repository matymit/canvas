import type Konva from "konva";

export interface CategorizeSelectionArgs<ElementLike> {
  selectedIds: Set<string>;
  elements: Map<string, ElementLike>;
  getElementById?: (id: string) => ElementLike | undefined;
}

export interface CategorizeSelectionResult {
  connectorIds: string[];
  mindmapEdgeIds: string[];
  nonConnectorIds: string[];
}

export function categorizeSelection<ElementLike extends { type?: string }>(
  {
    selectedIds,
    elements,
    getElementById,
  }: CategorizeSelectionArgs<ElementLike>,
): CategorizeSelectionResult {
  const connectorIds: string[] = [];
  const mindmapEdgeIds: string[] = [];
  const nonConnectorIds: string[] = [];

  selectedIds.forEach((id) => {
    const element = elements.get(id) ?? getElementById?.(id);

    if (!element) {
      nonConnectorIds.push(id);
      return;
    }

    if (element.type === "connector") {
      connectorIds.push(id);
      return;
    }

    if (element.type === "mindmap-edge") {
      mindmapEdgeIds.push(id);
      return;
    }

    nonConnectorIds.push(id);
  });

  return { connectorIds, mindmapEdgeIds, nonConnectorIds };
}

export interface ResolveElementsToNodesArgs {
  stage: Konva.Stage | null | undefined;
  layers: Array<Konva.Container | null | undefined>;
  elementIds: Set<string>;
}

export function resolveElementsToNodes(
  {
    stage,
    layers,
    elementIds,
  }: ResolveElementsToNodesArgs,
): Konva.Node[] {
  const nodes: Konva.Node[] = [];
  const validLayers = layers.filter(
    (layer): layer is Konva.Container =>
      Boolean(layer && typeof layer.find === "function"),
  );

  const seen = new Set<string>();

  const considerNode = (elementId: string, candidate: Konva.Node | null) => {
    if (!candidate) return;

    const nodeElementId =
      candidate.getAttr<string | undefined>("elementId") || candidate.id();
    const nodeType = getElementTypeForNode(candidate);

    if (
      nodeType === "connector" ||
      nodeType === "mindmap-edge" ||
      !(candidate.id() === elementId || nodeElementId === elementId)
    ) {
      return;
    }

    const key = candidate._id?.toString() ?? `${candidate.id()}-${nodeElementId}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    nodes.push(candidate);
  };

  for (const elementId of elementIds) {
    let resolvedNode: Konva.Node | null = null;

    if (stage) {
      try {
        resolvedNode = stage.findOne<Konva.Node>(`#${elementId}`) ?? null;
      } catch {
        resolvedNode = null;
      }
    }

    considerNode(elementId, resolvedNode);

    if (!resolvedNode) {
      for (const layer of validLayers) {
        try {
          const collection = layer.find((node: Konva.Node) => {
            const nodeElementId =
              node.getAttr<string | undefined>("elementId") || node.id();
            return nodeElementId === elementId || node.id() === elementId;
          });

          const candidates = Array.isArray(collection)
            ? (collection as Konva.Node[])
            : typeof (collection as { toArray?: () => Konva.Node[] }).toArray ===
                "function"
              ? (collection as { toArray: () => Konva.Node[] }).toArray()
              : [];

          if (candidates.length === 0) {
            continue;
          }

          const preferred = candidates.find((node) => {
            const className =
              typeof (node as { getClassName?: () => string }).getClassName ===
              "function"
                ? (node as { getClassName: () => string }).getClassName()
                : node.getAttr<string>("className");
            const name = node.name();
            return (
              node.id() === elementId ||
              (className === "Group" &&
                name !== "connector" &&
                name !== "connector-anchor") ||
              name === "table-group" ||
              name === "image" ||
              name === "mindmap-node"
            );
          });

          considerNode(elementId, preferred ?? candidates[0] ?? null);

          if (preferred) {
            break;
          }
        } catch {
          // Ignore lookup errors and continue with other layers
        }
      }
    }
  }

  return nodes;
}

export function filterTransformableNodes(
  nodes: Konva.Node[],
  debug?: (message: string, data?: unknown) => void,
): Konva.Node[] {
  return nodes.filter((node) => {
    const className =
      typeof (node as { getClassName?: () => string }).getClassName ===
      "function"
        ? (node as { getClassName: () => string }).getClassName()
        : (node as unknown as { className?: string }).className;
    const type = getElementTypeForNode(node);
    const id = node.getAttr("elementId") || node.id();

    if (debug) {
      debug("Inspect node for transformer", {
        id,
        name: node.name(),
        className,
        type,
        nodeType: node.getAttr("nodeType"),
        elementType: node.getAttr("elementType"),
      });
    }

    return type !== "connector" && type !== "mindmap-edge";
  });
}

export function getElementTypeForNode(node: Konva.Node): string {
  const nodeType = node.getAttr<string | undefined>("nodeType");
  if (nodeType) return nodeType;
  const elementType = node.getAttr<string | undefined>("elementType");
  if (elementType) return elementType;
  const name = typeof node.name === "function" ? node.name() : "";
  if (name.includes("connector")) return "connector";
  if (name.includes("mindmap-edge")) return "mindmap-edge";
  const className =
    typeof (node as { getClassName?: () => string }).getClassName === "function"
      ? (node as { getClassName: () => string }).getClassName()
      : (node as unknown as { className?: string }).className ?? "";
  if (className.toLowerCase().includes("connector")) return "connector";
  if (className.toLowerCase().includes("mindmap")) return "mindmap-node";
  return "element";
}
