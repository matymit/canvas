// src/test/performance-setup.ts

import { beforeAll, afterAll } from 'vitest';

// Mock performance APIs for testing
beforeAll(() => {
  // Mock Performance Observer
  global.PerformanceObserver = class MockPerformanceObserver {
    constructor(_callback: (list: PerformanceObserverEntryList) => void) {}
    observe() {}
    disconnect() {}
  } as unknown as PerformanceObserver;

  // Mock performance.memory
  Object.defineProperty(global.performance, 'memory', {
    value: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB mock
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB mock
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB mock
    },
    writable: true,
  });

  // Mock requestAnimationFrame
  global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  };

  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
});

afterAll(() => {
  // Cleanup if needed
});