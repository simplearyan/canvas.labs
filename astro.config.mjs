// @ts-check
import { defineConfig } from 'astro/config';

import solidJs from '@astrojs/solid-js';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://simplearyan.github.io',
  base: '/canvas.labs',

  integrations: [solidJs()],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['mediabunny', 'jszip']
    }
  }
});