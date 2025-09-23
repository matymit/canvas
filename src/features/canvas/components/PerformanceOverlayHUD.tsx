import { useMemo } from "react";
import type { JSX } from "react";
// import usePerformanceMonitoring from "@features/canvas/hooks/usePerformanceMonitoring";

type MaybeNumber = number | undefined;

function fmt(n: MaybeNumber, digits = 0): string {
  if (n === undefined || Number.isNaN(n)) return "–";
  return n.toFixed(digits);
}

export default function PerformanceOverlayHUD(): JSX.Element | null {
  // Keep this component "dumb": it only reads from the perf hook to avoid tight coupling.
  // The hook/Provider are expected to provide current metrics and enabled state.
  // const perf = usePerformanceMonitoring();
  const perf = {
    fps: 60,
    memory: 45.6,
    nodes: 120,
    perfEnabled: true,
    enabled: true,
    metrics: {
      fps: 60,
      frameTimeMs: 16.7,
      konvaNodes: 120,
      rafQueue: 2,
      renderTime: 8.2,
      drawCalls: 15,
      culling: {
        visible: 89,
        total: 120
      },
      memory: {
        usedMB: 45.6,
        pressure: "normal"
      },
      layers: {
        background: { nodes: 1, draws: 1, count: 1 },
        main: { nodes: 85, draws: 12, count: 85 },
        preview: { nodes: 2, draws: 1, count: 2 },
        overlay: { nodes: 32, draws: 5, count: 32 }
      }
    }
  }; // Mock data

  const enabled = perf?.perfEnabled ?? perf?.enabled ?? false;
  const metrics = perf?.metrics ?? {};
  const layerSummary = useMemo(() => {
    const layers = metrics.layers ?? {};
    const bg = layers.background?.count ?? layers.background ?? undefined;
    const main = layers.main?.count ?? layers.main ?? undefined;
    const prev = layers.preview?.count ?? layers.preview ?? undefined;
    const over = layers.overlay?.count ?? layers.overlay ?? undefined;
    return { bg, main, prev, over };
  }, [metrics.layers]);

  if (!enabled) return null;

  const fps = metrics.fps as MaybeNumber;
  const frameMs = metrics.frameTimeMs as MaybeNumber;

  const nodes = metrics.konvaNodes as MaybeNumber;
  const rafQueue = metrics.rafQueue as MaybeNumber;
  const drawCalls = metrics.drawCalls as MaybeNumber;

  const cullingVisible = metrics.culling?.visible as MaybeNumber;
  const cullingTotal = metrics.culling?.total as MaybeNumber;

  const memUsedMB = metrics.memory?.usedMB as MaybeNumber;
  const memPressure = (metrics.memory?.pressure as string | undefined) ?? "normal";

  return (
    <div className="pointer-events-none select-none">
      <div className="absolute left-2 top-2 w-[260px] rounded-md bg-black/70 p-2 text-xs leading-5 text-green-200 shadow-lg ring-1 ring-black/50">
        <div className="flex items-baseline justify-between">
          <div className="font-semibold text-green-300">Canvas Perf</div>
          <div className="tabular-nums">
            <span className="font-semibold">{fmt(fps)}</span> fps
            <span className="ml-2">{fmt(frameMs)}</span> ms
          </div>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-x-3">
          <div className="opacity-80">
            Nodes <span className="tabular-nums font-semibold">{fmt(nodes)}</span>
          </div>
          <div className="opacity-80">
            RAFQ <span className="tabular-nums font-semibold">{fmt(rafQueue)}</span>
          </div>
          <div className="opacity-80">
            Draws <span className="tabular-nums font-semibold">{fmt(drawCalls)}</span>
          </div>
          <div className="opacity-80">
            Cull{" "}
            <span className="tabular-nums font-semibold">
              {fmt(cullingVisible)}/{fmt(cullingTotal)}
            </span>
          </div>
          <div className="opacity-80 col-span-2">
            Mem{" "}
            <span className="tabular-nums font-semibold">
              {fmt(memUsedMB)} MB
            </span>{" "}
            <span
              className={
                memPressure === "critical"
                  ? "text-red-300"
                  : memPressure === "moderate"
                  ? "text-yellow-300"
                  : "text-green-300"
              }
            >
              {memPressure}
            </span>
          </div>
        </div>

        <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-green-300/80">
          <div>BG:{fmt(layerSummary.bg)}</div>
          <div>MAIN:{fmt(layerSummary.main)}</div>
          <div>PREV:{fmt(layerSummary.prev)}</div>
          <div>OVR:{fmt(layerSummary.over)}</div>
        </div>
      </div>
    </div>
  );
}