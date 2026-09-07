import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
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
