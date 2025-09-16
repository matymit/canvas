// vitest.performance.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'performance-budgets',
    include: ['**/*.performance.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    environment: 'jsdom',
    setupFiles: ['./src/test/performance-setup.ts'],
    reporters: ['verbose'],
    outputFile: './performance-test-results.json',
  },
});