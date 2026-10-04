import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Use shared TypeScript source in web dev/build so new exports
      // never depend on a stale packages/shared/dist.
      '@pawtag/shared/api': path.resolve(sharedSrc, 'api/index.ts'),
      '@pawtag/shared': path.resolve(sharedSrc, 'index.ts'),
    },
  },
  // Do not prebundle workspace shared from node_modules/dist.
  // Alias points at source; prebundle would re-introduce stale dist hashes
  // ("Outdated Optimize Dep" 504 after shared contract changes).
  optimizeDeps: {
    exclude: ['@pawtag/shared', '@pawtag/shared/api'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Suppress ECONNREFUSED errors during startup race condition
            // API server may not be ready yet when web app starts
          });
        },
      },
    },
  },
});
