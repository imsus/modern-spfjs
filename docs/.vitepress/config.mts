import { defineConfig } from 'vitepress';

export default defineConfig({
  // Deployed to GitHub Pages as a project site (https://imsus.github.io/
  // modern-spfjs/) — the base must match the repo name.
  base: '/modern-spfjs/',
  title: 'modern-spf',
  description:
    'A modern re-creation of YouTube\'s SPF: fast same-origin navigation by fetching only the fragments that change.',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/spf' },
      { text: 'Protocol', link: '/protocol' },
      { text: 'Architecture', link: '/design' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Navigation', link: '/guide/navigation' },
          { text: 'Streaming', link: '/guide/streaming' },
          { text: 'Caching', link: '/guide/caching' },
          { text: 'Scripts & styles', link: '/guide/resources' },
          { text: 'Prefetch', link: '/guide/prefetch' },
          { text: 'View transitions', link: '/guide/transitions' },
          { text: 'Configuration', link: '/guide/configuration' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: 'spf namespace', link: '/api/spf' },
          { text: 'Events', link: '/api/events' },
          { text: 'Cache', link: '/api/cache' },
          { text: 'Scripts', link: '/api/script' },
          { text: 'Styles', link: '/api/style' },
          { text: 'Types', link: '/api/types' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Design', link: '/design' },
          { text: 'Glossary', link: '/glossary' },
          { text: 'Wire protocol', link: '/protocol' },
          {
            text: 'ADR 0001 — concept-compatible, not drop-in',
            link: '/adr/0001-concept-compatible-not-dropin',
          },
          { text: 'ADR 0002 — ESM-native resource manager', link: '/adr/0002-esm-native-resource-manager' },
          { text: 'ADR 0003 — import-map-driven modules', link: '/adr/0003-import-map-driven-modules' },
          { text: 'Research notes (original SPF)', link: '/research' },
        ],
      },
    ],
    footer: {
      message: 'MIT licensed',
    },
  },
});
