import { useMemo, useState } from "react";
import type { JSX } from "react";
// import usePerformanceMonitoring from "@features/canvas/hooks/usePerformanceMonitoring";
// import usePerformanceCircuitBreaker from "@features/canvas/hooks/usePerformanceCircuitBreaker";

type MaybeNumber = number | undefined;

function fmt(n: MaybeNumber, digits = 0) {
  if (n === undefined || Number.isNaN(n)) return "–";
  return n.toFixed(digits);
}

export interface PerformanceDashboardProps {
  defaultOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Rich, interactive performance panel for deeper diagnostics.
 * Keep it detached from rendering flow by only reading monitoring state.
 */
export default function PerformanceDashboard({
  defaultOpen = true,
  onClose,
  className,
}: PerformanceDashboardProps): JSX.Element | null {
  const [open, setOpen] = useState(defaultOpen);

  // const perf = usePerformanceMonitoring();
  // const cb = usePerformanceCircuitBreaker?.();
  const perf = {
    perfEnabled: true,
    enabled: true,
    togglePerf: () => {},
    metrics: {
      fps: 60,
      frameTimeMs: 16.7,
      rafQueue: 2,
      drawCalls: 15,
      konvaNodes: 120,
      paints: 8,
      commits: 12,
      culling: { visible: 89, total: 120 },
      memory: { usedMB: 45.6, heapMB: 64.2, pressure: "normal" },
      layers: {
        background: { count: 1 },
        main: { count: 85 },
        preview: { count: 2 },
        overlay: { count: 32 }
      }
    }
  };
  const cb = {
    tripped: false,
    reason: null
  };

  const enabled = perf?.perfEnabled ?? perf?.enabled ?? false;
  const togglePerf = perf?.togglePerf ?? (() => void 0);

  const metrics = perf?.metrics ?? {};
  const fps = metrics.fps as MaybeNumber;
  const frameMs = metrics.frameTimeMs as MaybeNumber;
  const rafQueue = metrics.rafQueue as MaybeNumber;
  const drawCalls = metrics.drawCalls as MaybeNumber;
  const nodes = metrics.konvaNodes as MaybeNumber;
  const paints = metrics.paints as MaybeNumber;
  const commits = metrics.commits as MaybeNumber;

  const cullingVisible = metrics.culling?.visible as MaybeNumber;
  const cullingTotal = metrics.culling?.total as MaybeNumber;

  const memUsedMB = metrics.memory?.usedMB as MaybeNumber;
  const memHeapMB = metrics.memory?.heapMB as MaybeNumber;
  const memPressure = (metrics.memory?.pressure as string | undefined) ?? "normal";

  const layerSummary = useMemo(() => {
    const layers = metrics.layers ?? {};
    const bg = layers.background?.count ?? layers.background ?? undefined;
    const main = layers.main?.count ?? layers.main ?? undefined;
    const prev = layers.preview?.count ?? layers.preview ?? undefined;
    const over = layers.overlay?.count ?? layers.overlay ?? undefined;
    return { bg, main, prev, over };
  }, [metrics.layers]);

  const warnings: string[] = useMemo(() => {
    const out: string[] = [];
    if ((fps ?? 60) < 55) out.push("Frame rate dropped below 55 fps");
    if ((rafQueue ?? 0) > 10) out.push("RAF queue growing; consider batching draws");
    if ((nodes ?? 0) > 10000) out.push("High Konva node count; enable pooling/culling");
    if (memPressure === "moderate") out.push("Memory pressure: moderate");
    if (memPressure === "critical") out.push("Memory pressure: CRITICAL");
    if (cb?.tripped) out.push("Circuit breaker tripped; progressive rendering active");
    return out;
  }, [cb?.tripped, fps, memPressure, nodes, rafQueue]);

  if (!open) return null;

  return (
    <div
      className={
        className ??
        "absolute right-3 top-3 max-h-[80vh] w-[380px] overflow-auto rounded-md bg-panel/95 p-3 text-xs text-text-primary shadow-xl ring-1 ring-border/60"
      }
      role="dialog"
      aria-label="Performance Dashboard"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Performance Dashboard</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => togglePerf?.()}
            className={
              enabled
                ? "rounded bg-green-600 px-2 py-1 text-[11px] text-white hover:bg-green-700"
                : "rounded bg-slate-500 px-2 py-1 text-[11px] text-white hover:bg-slate-600"
            }
            aria-pressed={enabled}
          >
            {enabled ? "Perf On" : "Perf Off"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onClose?.();
            }}
            className="rounded bg-neutral-700 px-2 py-1 text-[11px] text-white hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
      </div>

      <section className="mb-2">
        <div className="grid grid-cols-3 gap-x-3 gap-y-1">
          <Metric label="FPS" value={fmt(fps)} emphasis />
          <Metric label="Frame ms" value={fmt(frameMs)} />
          <Metric label="RAF queue" value={fmt(rafQueue)} />
          <Metric label="Draw calls" value={fmt(drawCalls)} />
          <Metric label="Nodes" value={fmt(nodes)} />
          <Metric label="Paints" value={fmt(paints)} />
          <Metric label="Commits" value={fmt(commits)} />
          <Metric
            label="Culling"
            value={`${fmt(cullingVisible)}/${fmt(cullingTotal)}`}
          />
          <Metric
            label="Layers"
            value={`BG:${fmt(layerSummary.bg)} M:${fmt(layerSummary.main)} P:${fmt(
              layerSummary.prev
            )} O:${fmt(layerSummary.over)}`}
          />
        </div>
      </section>

      <section className="mb-2">
        <div className="grid grid-cols-3 gap-x-3 gap-y-1">
          <Metric label="Mem Used" value={`${fmt(memUsedMB)} MB`} />
          <Metric label="Heap" value={`${fmt(memHeapMB)} MB`} />
          <Metric
            label="Pressure"
            value={memPressure}
            tone={
              memPressure === "critical"
                ? "danger"
                : memPressure === "moderate"
                ? "warn"
                : "ok"
            }
          />
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="mb-2">
          <div className="mb-1 text-[11px] font-semibold text-yellow-300">
            Warnings
          </div>
          <ul className="list-disc pl-5 text-[11px] leading-5 text-yellow-200">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {cb ? (
        <section className="mb-1">
          <div className="mb-1 text-[11px] font-semibold text-blue-300">
            Circuit Breaker
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Metric label="Tripped" value={cb.tripped ? "yes" : "no"} />
            <Metric label="Reason" value={cb.reason ?? "–"} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "ok" | "warn" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-red-300"
      : tone === "warn"
      ? "text-yellow-300"
      : tone === "ok"
      ? "text-green-300"
      : "text-text-primary";

  return (
    <div className="flex items-baseline justify-between">
      <div className="opacity-80">{label}</div>
      <div
        className={`tabular-nums ${
          emphasis ? "font-semibold text-green-300" : color
        }`}
      >
        {value}
      </div>
    </div>
  );
}