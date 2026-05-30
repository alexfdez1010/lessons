// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Canonical production origin. Override per-environment with PUBLIC_SITE_URL
// (Vercel deploys, previews). Drives sitemap, canonical tags and OG URLs.
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://lessons.alejandrofernandezcamello.me';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  output: 'static',
  // Bilingual. English is the default and served at the root (/about),
  // Spanish is prefixed (/es/about). hreflang alternates are emitted by Seo.astro
  // and the sitemap integration below.
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    react(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en-US', es: 'es-ES' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
