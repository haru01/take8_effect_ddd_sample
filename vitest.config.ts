import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@enrollment': resolve(__dirname, './src/contexts/enrollment'),
      '@shared': resolve(__dirname, './src/contexts/shared'),
    },
  },
});