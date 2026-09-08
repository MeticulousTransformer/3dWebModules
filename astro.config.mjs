import { defineConfig } from 'astro/config';

// GitHub Pages serves a project repo from https://<user>.github.io/<repo>/, so
// the built pages need that prefix baked in. The deploy workflow sets SITE_BASE
// to '/3dWebModules/'; everywhere else it is unset and the site lives at '/'.
// To reproduce the deployed build locally:  SITE_BASE=/3dWebModules/ npm run build
const BASE = process.env.SITE_BASE || '/';

// https://astro.build/config
export default defineConfig({
  site: 'https://meticuloustransformer.github.io',
  base: BASE,
  // Astro ships zero JavaScript by default. The only scripts on any page here
  // are the module loader and three.js, and both arrive lazily.
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  build: { inlineStylesheets: 'auto' },
  vite: {
    build: {
      target: 'es2022',
      // three.js is big. Keep it in one chunk that gets cached once and reused
      // by every module, instead of duplicated into each module's chunk.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three';
          },
        },
      },
    },
  },
});
