import { resolve } from 'node:path';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  // Library build: ESM + CJS + IIFE (global `spf`).
  // NOTE: .d.ts generation is handled by `vp pack` (tsdown), which is
  // TypeScript-7-compatible — vite-plugin-dts is not (it needs the legacy
  // JS compiler API that the native compiler no longer exposes).
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'spf',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) =>
        format === 'es' ? 'index.js' : format === 'cjs' ? 'index.cjs' : 'index.global.js',
    },
    sourcemap: true,
  },

  // Vitest configuration (bundled via Vite+).
  test: {
    include: ['src/**/*.test.ts'],
  },

  // Oxlint configuration.
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**'],
  },

  // Oxfmt configuration.
  fmt: {
    semi: true,
    singleQuote: true,
  },
});
