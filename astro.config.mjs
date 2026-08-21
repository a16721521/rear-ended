import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://gotrearended.com',
  trailingSlash: 'always',
  integrations: [
    sitemap(),
    react(),
  ],
  output: 'static',
  build: {
    format: 'directory',
  },
  vite: {
    css: {
      devSourcemap: true,
    },
  },
});
