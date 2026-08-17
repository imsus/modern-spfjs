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

  // Oxlint configuration (anti-slop plugin: tools/oxlint/anti-slop).
  lint: {
    ignorePatterns: [
      'dist/**',
      'node_modules/**',
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.continue/**',
      '.cursor/**',
      '.gemini/**',
      '.opencode/**',
      '.pi/**',
      '.roo/**',
      '.windsurf/**',
      'tools/oxlint/anti-slop/**',
    ],
    jsPlugins: [{ name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' }],
    rules: {
      'anti-slop/no-chained-type-assertions': 'error',
      'anti-slop/no-conditional-empty-object-spread': 'error',
      'anti-slop/no-known-value-widening': 'error',
      'anti-slop/no-module-mocking': 'error',
      'anti-slop/no-object-parameters': 'error',
      'anti-slop/no-reflect-apply': 'error',
      'anti-slop/no-reflect-get': 'error',
      'anti-slop/no-runtime-typeof': 'error',
      'anti-slop/no-shape-in-symbol-names': 'error',
      'anti-slop/no-unknown-parameters': 'error',
      'anti-slop/no-unknown-returns': 'error',
      'anti-slop/no-unknown-type-aliases': 'error',
      'anti-slop/no-unsafe-dictionary-type': 'error',
      'anti-slop/no-widen-then-assert': 'error',
      'anti-slop/require-safety-comment-for-type-assertion': 'error',
    },
  },

  // Oxfmt configuration.
  fmt: {
    semi: true,
    singleQuote: true,
    ignorePatterns: [
      'dist/**',
      'node_modules/**',
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.continue/**',
      '.cursor/**',
      '.gemini/**',
      '.opencode/**',
      '.pi/**',
      '.roo/**',
      '.windsurf/**',
      'tools/oxlint/anti-slop/**',
    ],
  },
});
