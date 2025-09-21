// features/canvas/hooks/useMemoryCleanup.ts
//
// React hook for automatic memory cleanup in canvas components.
// Provides utilities for tracking resources and cleaning them up on unmount.

import { useEffect, useRef, useCallback, useMemo } from "react";
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
  trackNode: (node: Konva.Node, metadata?: Record<string, unknown>) => string;
  trackListener: (
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    metadata?: Record<string, unknown>,
  ) => string;
  trackTimer: (
    timerId: number,
    type?: "timeout" | "interval",
    metadata?: Record<string, unknown>,
  ) => string;
  trackAnimation: (frameId: number, metadata?: Record<string, unknown>) => string;
  trackCustom: (
    resource: unknown,
    cleanup: () => void,
    metadata?: Record<string, unknown>,
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


    return cleanedCount;
  }, []);

  // Track a resource with automatic component-level cleanup
  const trackResource = useCallback(
    (trackFn: () => string) => {
      if (isUnmountedRef.current) {
        return "";
      }

      // Check resource limits
      if (trackedResourcesRef.current.size >= maxTrackedResources) {
        return "";
      }

      try {
        const resourceId = trackFn();
        if (resourceId) {
          trackedResourcesRef.current.add(resourceId);

        }
        return resourceId;
      } catch (error) {
        // Error: useMemoryCleanup[${componentIdRef.current}]: Error tracking resource: ${error}
        return "";
      }
    },
    [maxTrackedResources],
  );

  // Individual utility callbacks - must be at top level to follow React rules
  const trackNodeCallback = useCallback(
    (node: Konva.Node, metadata?: Record<string, unknown>) => {
      return trackResource(() =>
        memoryUtils.trackNode(node, {
          componentId: componentIdRef.current,
          componentName: trackComponentName,
          ...metadata,
        }),
      );
    },
    [trackResource, trackComponentName],
  );

  const trackListenerCallback = useCallback(
    (
      target: EventTarget,
      event: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
      metadata?: Record<string, unknown>,
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
  );

  const trackTimerCallback = useCallback(
    (
      timerId: number,
      type: "timeout" | "interval" = "timeout",
      metadata?: Record<string, unknown>,
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
  );

  const trackAnimationCallback = useCallback(
    (frameId: number, metadata?: Record<string, unknown>) => {
      return trackResource(() =>
        memoryUtils.trackAnimation(frameId, {
          componentId: componentIdRef.current,
          componentName: trackComponentName,
          ...metadata,
        }),
      );
    },
    [trackResource, trackComponentName],
  );

  const trackCustomCallback = useCallback(
    (resource: unknown, cleanup: () => void, metadata?: Record<string, unknown>) => {
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
  );

  const cleanupCallback = useCallback(
    (resourceId: string) => {
      const success = memoryUtils.cleanup(resourceId);
      if (success) {
        trackedResourcesRef.current.delete(resourceId);

      }
      return success;
    },
    [],
  );

  const cleanupAllCallback = useCallback(() => {
    return cleanupResources();
  }, [cleanupResources]);

  const getTrackedCountCallback = useCallback(() => {
    return trackedResourcesRef.current.size;
  }, []);

  const getResourceIdsCallback = useCallback(() => {
    return Array.from(trackedResourcesRef.current);
  }, []);

  const logMetricsCallback = useCallback(() => {
    // Metrics logging removed for production
  }, []);

  // Utility functions - wrapped in useMemo to prevent changing on every render
  const utils: MemoryCleanupUtils = useMemo(() => ({
    trackNode: trackNodeCallback,
    trackListener: trackListenerCallback,
    trackTimer: trackTimerCallback,
    trackAnimation: trackAnimationCallback,
    trackCustom: trackCustomCallback,
    cleanup: cleanupCallback,
    cleanupAll: cleanupAllCallback,
    getTrackedCount: getTrackedCountCallback,
    getResourceIds: getResourceIdsCallback,
    logMetrics: logMetricsCallback,
  }), [
    trackNodeCallback,
    trackListenerCallback,
    trackTimerCallback,
    trackAnimationCallback,
    trackCustomCallback,
    cleanupCallback,
    cleanupAllCallback,
    getTrackedCountCallback,
    getResourceIdsCallback,
    logMetricsCallback,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      cleanupResources();
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
