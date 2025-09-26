// vite.config.ts
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Map build target per platform for Tauri
function getBuildTarget(): string | string[] {
  const isWindows = process.env.TAURI_PLATFORM === 'windows';
  return isWindows ? 'chrome105' : 'safari13';
}

// Production performance budget checks
const PERFORMANCE_BUDGETS = {
  maxChunkSize: 1024, // 1MB warning limit
  maxAssetSize: 512,  // 512KB for individual assets
  maxTotalSize: 4096, // 4MB total bundle size
};

export default defineConfig(async (): Promise<UserConfig> => {
  const isDebug = !!process.env.TAURI_DEBUG;
  const isProd = process.env.NODE_ENV === 'production';
  const devHost = process.env.TAURI_DEV_HOST; // optional on-device dev

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@types': path.resolve(__dirname, 'types'),
      },
    },

    clearScreen: false,
    envPrefix: [
      'VITE_',
      'TAURI_',
      'TAURI_PLATFORM',
      'TAURI_ARCH',
      'TAURI_FAMILY',
      'TAURI_PLATFORM_VERSION',
      'TAURI_PLATFORM_TYPE',
      'TAURI_DEBUG',
    ],

    server: {
      port: 1420,
      strictPort: false, // Allow Vite to use next available port if 1420 is taken
      host: devHost || '127.0.0.1',
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },

    // Pre-bundle key deps for fast dev HMR (no react-konva)
    optimizeDeps: {
      include: ['konva', 'zustand', 'immer'],
      // Exclude all Tauri packages from pre-bundling to prevent resolution issues
      exclude: [
        '@tauri-apps/api',
        '@tauri-apps/plugin-dialog',
        '@tauri-apps/plugin-fs',
      ],
    },

    build: {
      target: getBuildTarget(),
      sourcemap: isDebug ? 'inline' : false, // Inline for debug, none for prod
      minify: isDebug ? false : 'esbuild',
      reportCompressedSize: !isProd, // Skip in prod for faster builds
      chunkSizeWarningLimit: PERFORMANCE_BUDGETS.maxChunkSize,
      
      rollupOptions: {
        // Mark Tauri APIs as external - they'll be available at runtime in Tauri context
        external: (id: string) => {
          // Only externalize in production builds for Tauri
          if (isProd && (
            id.startsWith('@tauri-apps/api') ||
            id.startsWith('@tauri-apps/plugin-dialog') ||
            id.startsWith('@tauri-apps/plugin-fs')
          )) {
            return true;
          }
          return false;
        },

        output: {
          // Keep predictable chunks (no react-konva)
          manualChunks: {
            vendor: ['react', 'react-dom'],
            canvas: ['konva'], // Isolated Konva chunk for better caching
            state: ['zustand', 'immer'],
          },
          entryFileNames: isProd ? 'assets/[name]-[hash].js' : 'assets/[name].js',
          chunkFileNames: isProd ? 'assets/[name]-[hash].js' : 'assets/[name].js',
          assetFileNames: isProd ? 'assets/[name]-[hash][extname]' : 'assets/[name][extname]',

          // Asset size validation
          ...(isProd && {
            validate: true,
            compact: true,
          }),
        },

        // Tree-shaking and dead code elimination
        treeshake: {
          moduleSideEffects: false,
          preset: 'recommended',
        },
      },
      
      // Disable dev-only features in production
      ...(isProd && {
        cssCodeSplit: true,
        assetsInlineLimit: 4096, // 4KB inline limit
        emptyOutDir: true,
      }),
    },

    // Production-specific optimizations
    ...(isProd && {
      esbuild: {
        drop: ['console', 'debugger'], // Remove console logs in production
        legalComments: 'none',
      },
    }),
  };
});