/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Pre-bundle up front so lazy imports (leva) never trigger a mid-session
  // re-optimization that loads a second React copy.
  optimizeDeps: {
    include: [
      'react',
      'react-dom/client',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'zustand',
      'leva',
      'postprocessing',
      '@react-three/postprocessing',
    ],
  },
  build: {
    target: 'es2022',
    // three.js alone is ~750 kB minified (~190 kB gzip); that's expected.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Keep three/R3F in their own long-cached chunk.
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
