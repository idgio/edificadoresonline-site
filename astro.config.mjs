import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  redirects: {
    '/diplomados': {
      status: 307,
      destination: `/diplomados/${new Date().getFullYear()}`
    }
  }
});