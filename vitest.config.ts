import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/api/src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['packages/api/src/**/*.ts'],
      exclude: [
        'packages/api/src/**/*.test.ts',
        'packages/api/src/index.ts',
        'packages/api/src/swagger.ts',
      ],
      thresholds: {
        lines: 15,
        functions: 15,
        branches: 10,
        statements: 15,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@pawtag/db': path.resolve(__dirname, 'packages/db/src'),
      '@pawtag/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});
