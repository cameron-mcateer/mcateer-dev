// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // TODO: set to the production URL (used by RSS, sitemap, canonical links).
  site: 'https://mcateer.dev',
  adapter: cloudflare(),
});