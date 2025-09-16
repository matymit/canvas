// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setupTests.ts'],
    // Exclude Playwright E2E specs from Vitest unit runs
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/features/canvas/__tests__/e2e/**',
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/test/**',
        '**/*.config.*',
        'vite.config.ts',
        'vitest*.config.ts',
        'postcss.config.*',
        'tailwind.config.*',
        'scripts/**',
        'src-tauri/**',
      ],
    },
  },
  resolve: {
    alias: {
      // Force browser build of Konva in tests to avoid requiring native 'canvas'
      konva: path.posix.join('konva', 'lib', 'index.js'),
    },
  },
});
