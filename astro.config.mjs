import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://gotrearended.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // /learn is a noindex stub until real articles exist — keep it out of the sitemap
      filter: (page) => !page.includes('/learn'),
    }),
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
