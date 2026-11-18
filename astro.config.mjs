// Astro configuration for crystalandritual.com (static output).
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.crystalandritual.com',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Owner rule, CSS lives inside each page (mobile first, no render-blocking stylesheet).
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
});
