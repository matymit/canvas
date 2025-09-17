// features/canvas/hooks/useMemoryCleanup.ts
//
// React hook for automatic memory cleanup in canvas components.
// Provides utilities for tracking resources and cleaning them up on unmount.

import { useEffect, useRef, useCallback } from "react";
import {
  memoryUtils,
  getMemoryManager,
} from "../utils/performance/MemoryManager";
import type Konva from "konva";

export interface UseMemoryCleanupOptions {
  enableDebugLogging?: boolean;
  trackComponentName?: string;
  maxTrackedResources?: number;
}

export interface MemoryCleanupUtils {
  // Track resources for automatic cleanup
  trackNode: (node: Konva.Node, metadata?: Record<string, any>) => string;
  trackListener: (
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    metadata?: Record<string, any>,
  ) => string;
  trackTimer: (
    timerId: number,
    type?: "timeout" | "interval",
    metadata?: Record<string, any>,
  ) => string;
  trackAnimation: (frameId: number, metadata?: Record<string, any>) => string;
  trackCustom: (
    resource: any,
    cleanup: () => void,
    metadata?: Record<string, any>,
  ) => string;

  // Manual cleanup
  cleanup: (resourceId: string) => boolean;
  cleanupAll: () => number;

  // Resource information
  getTrackedCount: () => number;
  getResourceIds: () => string[];

  // Metrics and debugging
  logMetrics: () => void;
}

/**
 * Hook for automatic memory cleanup in canvas components.
 * Tracks resources and cleans them up when component unmounts.
 */
export function useMemoryCleanup(
  options: UseMemoryCleanupOptions = {},
): MemoryCleanupUtils {
  const {
    enableDebugLogging = false,
    trackComponentName = "Unknown",
    maxTrackedResources = 100,
  } = options;

  const trackedResourcesRef = useRef<Set<string>>(new Set());
  const componentIdRef = useRef(
    `${trackComponentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );
  const isUnmountedRef = useRef(false);

  // Cleanup function
  const cleanupResources = useCallback(() => {
    const resourceIds = Array.from(trackedResourcesRef.current);
    let cleanedCount = 0;

    for (const resourceId of resourceIds) {
      if (memoryUtils.cleanup(resourceId)) {
        cleanedCount++;
      }
      trackedResourcesRef.current.delete(resourceId);
    }

    if (enableDebugLogging && cleanedCount > 0) {
      console.debug(
        `useMemoryCleanup[${componentIdRef.current}]: Cleaned up ${cleanedCount} resources`,
      );
    }

    return cleanedCount;
  }, [enableDebugLogging]);

  // Track a resource with automatic component-level cleanup
  const trackResource = useCallback(
    (trackFn: () => string) => {
      if (isUnmountedRef.current) {
        console.warn(
          `useMemoryCleanup[${componentIdRef.current}]: Attempted to track resource after unmount`,
        );
        return "";
      }

      // Check resource limits
      if (trackedResourcesRef.current.size >= maxTrackedResources) {
        console.warn(
          `useMemoryCleanup[${componentIdRef.current}]: Resource limit exceeded ` +
            `(${trackedResourcesRef.current.size}/${maxTrackedResources}). Consider cleanup.`,
        );
        return "";
      }

      try {
        const resourceId = trackFn();
        if (resourceId) {
          trackedResourcesRef.current.add(resourceId);

          if (enableDebugLogging) {
            console.debug(
              `useMemoryCleanup[${componentIdRef.current}]: Tracked resource ${resourceId} ` +
                `(${trackedResourcesRef.current.size} total)`,
            );
          }
        }
        return resourceId;
      } catch (error) {
        console.error(
          `useMemoryCleanup[${componentIdRef.current}]: Error tracking resource:`,
          error,
        );
        return "";
      }
    },
    [maxTrackedResources, enableDebugLogging],
  );

  // Utility functions
  const utils: MemoryCleanupUtils = {
    trackNode: useCallback(
      (node: Konva.Node, metadata?: Record<string, any>) => {
        return trackResource(() =>
          memoryUtils.trackNode(node, {
            componentId: componentIdRef.current,
            componentName: trackComponentName,
            ...metadata,
          }),
        );
      },
      [trackResource, trackComponentName],
    ),

    trackListener: useCallback(
      (
        target: EventTarget,
        event: string,
        listener: EventListener,
        options?: AddEventListenerOptions,
        metadata?: Record<string, any>,
      ) => {
        return trackResource(() =>
          memoryUtils.trackListener(target, event, listener, options, {
            componentId: componentIdRef.current,
            componentName: trackComponentName,
            ...metadata,
          }),
        );
      },
      [trackResource, trackComponentName],
    ),

    trackTimer: useCallback(
      (
        timerId: number,
        type: "timeout" | "interval" = "timeout",
        metadata?: Record<string, any>,
      ) => {
        return trackResource(() =>
          memoryUtils.trackTimer(timerId, type, {
            componentId: componentIdRef.current,
            componentName: trackComponentName,
            ...metadata,
          }),
        );
      },
      [trackResource, trackComponentName],
    ),

    trackAnimation: useCallback(
      (frameId: number, metadata?: Record<string, any>) => {
        return trackResource(() =>
          memoryUtils.trackAnimation(frameId, {
            componentId: componentIdRef.current,
            componentName: trackComponentName,
            ...metadata,
          }),
        );
      },
      [trackResource, trackComponentName],
    ),

    trackCustom: useCallback(
      (resource: any, cleanup: () => void, metadata?: Record<string, any>) => {
        return trackResource(() => {
          const manager = getMemoryManager();
          return manager.trackCustomResource(resource, cleanup, {
            componentId: componentIdRef.current,
            componentName: trackComponentName,
            ...metadata,
          });
        });
      },
      [trackResource, trackComponentName],
    ),

    cleanup: useCallback(
      (resourceId: string) => {
        const success = memoryUtils.cleanup(resourceId);
        if (success) {
          trackedResourcesRef.current.delete(resourceId);

          if (enableDebugLogging) {
            console.debug(
              `useMemoryCleanup[${componentIdRef.current}]: Cleaned up resource ${resourceId} ` +
                `(${trackedResourcesRef.current.size} remaining)`,
            );
          }
        }
        return success;
      },
      [enableDebugLogging],
    ),

    cleanupAll: useCallback(() => {
      return cleanupResources();
    }, [cleanupResources]),

    getTrackedCount: useCallback(() => {
      return trackedResourcesRef.current.size;
    }, []),

    getResourceIds: useCallback(() => {
      return Array.from(trackedResourcesRef.current);
    }, []),

    logMetrics: useCallback(() => {
      const globalMetrics = memoryUtils.getMetrics();
      const componentMetrics = {
        componentId: componentIdRef.current,
        componentName: trackComponentName,
        trackedResources: trackedResourcesRef.current.size,
        resourceIds: Array.from(trackedResourcesRef.current),
      };

      console.group(`useMemoryCleanup[${componentIdRef.current}] Metrics`);
      console.log("Component metrics:", componentMetrics);
      console.log("Global memory metrics:", globalMetrics);
      console.groupEnd();
    }, [trackComponentName]),
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      const cleaned = cleanupResources();

      if (enableDebugLogging) {
        console.debug(
          `useMemoryCleanup[${componentIdRef.current}]: Component unmounted, ` +
            `cleaned up ${cleaned} resources`,
        );
      }
    };
  }, [cleanupResources, enableDebugLogging]);

  // Development-only: log metrics periodically
  useEffect(() => {
    if (!enableDebugLogging || process.env.NODE_ENV === "production") return;

    const interval = setInterval(() => {
      if (trackedResourcesRef.current.size > 0) {
        utils.logMetrics();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [enableDebugLogging, utils]);

  return utils;
}

/**
 * Hook specifically for Konva node cleanup in components.
 * Simplified interface for common Konva use cases.
 */
export function useKonvaCleanup(componentName?: string) {
  const memoryCleanup = useMemoryCleanup({
    trackComponentName: componentName || "KonvaComponent",
    enableDebugLogging: process.env.NODE_ENV !== "production",
  });

  return {
    trackNode: memoryCleanup.trackNode,
    cleanup: memoryCleanup.cleanup,
    cleanupAll: memoryCleanup.cleanupAll,
    getTrackedCount: memoryCleanup.getTrackedCount,
  };
}

/**
 * Hook for tracking event listeners with automatic cleanup.
 */
export function useEventListenerCleanup(componentName?: string) {
  const memoryCleanup = useMemoryCleanup({
    trackComponentName: componentName || "EventComponent",
    enableDebugLogging: process.env.NODE_ENV !== "production",
  });

  const addTrackedListener = useCallback(
    (
      target: EventTarget,
      event: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      return memoryCleanup.trackListener(target, event, listener, options);
    },
    [memoryCleanup],
  );

  return {
    addTrackedListener,
    cleanup: memoryCleanup.cleanup,
    cleanupAll: memoryCleanup.cleanupAll,
    getTrackedCount: memoryCleanup.getTrackedCount,
  };
}

/**
 * Hook for tracking timers with automatic cleanup.
 */
export function useTimerCleanup(componentName?: string) {
  const memoryCleanup = useMemoryCleanup({
    trackComponentName: componentName || "TimerComponent",
    enableDebugLogging: process.env.NODE_ENV !== "production",
  });

  const setTrackedTimeout = useCallback(
    (callback: () => void, delay: number) => {
      const timerId = setTimeout(callback, delay);
      const trackingId = memoryCleanup.trackTimer(
        timerId as unknown as number,
        "timeout",
      );
      return { timerId, trackingId };
    },
    [memoryCleanup],
  );

  const setTrackedInterval = useCallback(
    (callback: () => void, delay: number) => {
      const timerId = setInterval(callback, delay);
      const trackingId = memoryCleanup.trackTimer(
        timerId as unknown as number,
        "interval",
      );
      return { timerId, trackingId };
    },
    [memoryCleanup],
  );

  return {
    setTrackedTimeout,
    setTrackedInterval,
    cleanup: memoryCleanup.cleanup,
    cleanupAll: memoryCleanup.cleanupAll,
    getTrackedCount: memoryCleanup.getTrackedCount,
  };
}

export default useMemoryCleanup;
