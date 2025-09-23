import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readDepcruiseGraph(jsonPath: string) {
  if (!fs.existsSync(jsonPath)) return null;
  const raw = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(raw) as {
    modules?: Array<{ source: string; dependencies?: Array<{ resolved?: string; module?: string }> }>;
  };
}

function computeGraph(graph: NonNullable<ReturnType<typeof readDepcruiseGraph>>) {
  const modules = graph.modules ?? [];
  const edges: Array<[string, string]> = [];
  const nodes = new Set<string>();
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();

  for (const m of modules) {
    const from = m.source;
    nodes.add(from);
    const deps = m.dependencies ?? [];
    outDeg.set(from, (outDeg.get(from) || 0) + deps.length);
    for (const d of deps) {
      const to = d.resolved || d.module || "";
      if (!to) continue;
      nodes.add(to);
      edges.push([from, to]);
      inDeg.set(to, (inDeg.get(to) || 0) + 1);
    }
  }

  // Tarjan SCC
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const adj = new Map<string, string[]>();
  edges.forEach(([a, b]) => {
    const list = adj.get(a) || [];
    list.push(b);
    adj.set(a, list);
  });
  const comps: string[][] = [];

  function strongconnect(v: string) {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) || []) {
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      comps.push(comp);
    }
  }
  for (const n of nodes) if (!idx.has(n)) strongconnect(n);

  return { edges, nodes, inDeg, outDeg, sccs: comps.filter((c) => c.length > 1) };
}

describe("Architecture Compliance (dependency graph)", () => {
  const jsonPath = path.resolve(__dirname, "../../../../.dependency-cache/depcruise-src.json");
  const graph = readDepcruiseGraph(jsonPath);

  if (!graph) {
    it.skip("dependency graph JSON missing - run `npm run deps:all:src`", () => {});
    return;
  }

  const { sccs, inDeg } = computeGraph(graph);

  it("has no module cycles (SCC size > 1)", () => {
    if (sccs.length > 0) {
      // Surface the first few cycles for debugging
      const preview = sccs.slice(0, 3).map((c) => c.slice(0, 10));
      // Fail if cycles exist
      expect({ cycles: preview }).toEqual({ cycles: [] });
    } else {
      expect(sccs.length).toBe(0);
    }
  });

  it("reports top imported modules (in-degree)", () => {
    const arr = Array.from(inDeg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    // Log for insight; not asserting thresholds here
    console.info("TOP IN-DEGREE", arr);
    expect(arr.length).toBeGreaterThan(0);
  });

  it("tracks unifiedCanvasStore in-degree (>0)", () => {
    const key = "src/features/canvas/stores/unifiedCanvasStore.ts";
    const deg = inDeg.get(key) || 0;
    expect(deg).toBeGreaterThan(0);
  });

  it("selectors module exists to reduce coupling", async () => {
    const fs = await import('node:fs');
    const p = await import('node:path');
    const sel = p.resolve(__dirname, '../../../../src/features/canvas/stores/selectors.ts');
    expect(fs.existsSync(sel)).toBe(true);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import Konva from "konva";
import { createRendererLayers } from "../../../features/canvas/renderer/layers";
import { useUnifiedCanvasStore } from "../../../features/canvas/stores/unifiedCanvasStore";
import type { CanvasElement } from "../../../../types/index";

describe("Architecture Compliance Tests", () => {
  describe("Four-Layer Pipeline Compliance", () => {
    let container: HTMLDivElement;
    let stage: Konva.Stage;
    let layers: ReturnType<typeof createRendererLayers>;

    beforeEach(() => {
      container = document.createElement("div");
      container.style.width = "600px";
      container.style.height = "400px";
      document.body.appendChild(container);

      stage = new Konva.Stage({
        container,
        width: 600,
        height: 400,
        listening: true,
      });

      layers = createRendererLayers(stage, {
        listeningPreview: false,
        listeningMain: true,
        listeningOverlay: true,
      });
    });

    it("should maintain exactly four layers", () => {
      const layerCount = stage.getChildren().length;
      expect(layerCount).toBe(4);
    });

    it("should have correct layer types in correct order", () => {
      const children = stage.getChildren();

      expect(children[0].name()).toBe("background-layer");
      expect(children[1].name()).toBe("main-layer");
      expect(children[2].name()).toBe("preview-layer");
      expect(children[3].name()).toBe("overlay-layer");
    });

    it("should configure background layer as non-listening", () => {
      expect(layers.background.listening()).toBe(false);
    });

    it("should configure main layer as listening", () => {
      expect(layers.main.listening()).toBe(true);
    });

    it("should configure preview layer as non-listening by default", () => {
      expect(layers.preview.listening()).toBe(false);
    });

    it("should configure overlay layer as listening", () => {
      expect(layers.overlay.listening()).toBe(true);
    });
  });

  describe("Store-Driven Rendering Compliance", () => {
    let container: HTMLDivElement;
    let stage: Konva.Stage;
    let layers: ReturnType<typeof createRendererLayers>;

    beforeEach(() => {
      container = document.createElement("div");
      container.style.width = "600px";
      container.style.height = "400px";
      document.body.appendChild(container);

      stage = new Konva.Stage({
        container,
        width: 600,
        height: 400,
        listening: true,
      });

      layers = createRendererLayers(stage, {
        listeningPreview: false,
        listeningMain: true,
        listeningOverlay: true,
      });
    });

    it("should use vanilla Konva directly without react-konva", () => {
      // Verify that we can create Konva objects directly
      expect(stage).toBeInstanceOf(Konva.Stage);
      expect(layers.background).toBeInstanceOf(Konva.Layer);
      expect(layers.main).toBeInstanceOf(Konva.Layer);
      expect(layers.preview).toBeInstanceOf(Konva.Layer);
      expect(layers.overlay).toBeInstanceOf(Konva.Layer);
    });

    it("should have store with element operations", () => {
      const store = useUnifiedCanvasStore.getState();

      expect(typeof store.element.upsert).toBe("function");
      expect(typeof store.element.update).toBe("function");
      expect(typeof store.element.delete).toBe("function");
      expect(typeof store.element.getById).toBe("function");
    });

    it("should have store with history operations", () => {
      const store = useUnifiedCanvasStore.getState();

      expect(typeof store.history.withUndo).toBe("function");
      expect(typeof store.history.record).toBe("function");
      expect(typeof store.history.push).toBe("function");
      expect(typeof store.history.clear).toBe("function");
    });

    it("should accept properly typed CanvasElement", () => {
      const store = useUnifiedCanvasStore.getState();

      const testElement: CanvasElement = {
        id: "test-element",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        style: {
          fill: "#ff0000",
          stroke: "#000000",
          strokeWidth: 2,
        },
      };

      // This should not throw a TypeScript error
      expect(() => {
        store.element.upsert(testElement);
      }).not.toThrow();
    });
  });
});
