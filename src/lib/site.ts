/**
 * Global site metadata. Single source of truth for SEO defaults, branding
 * and social handles. Imported by the SEO component, layouts and OG tooling.
 */
export const SITE = {
  name: 'Finance Lessons',
  /** Used in <title> templates: "Page Title — Finance Lessons". */
  titleTemplate: (page?: string) =>
    page ? `${page} — Finance Lessons` : 'Finance Lessons — From zero to expert, visually',
  description:
    'Free, interactive, animated finance lessons that take you from zero knowledge to complete expert — read, visualize, and test yourself with built-in exercises. In English and Spanish.',
  /** Fallback locale for og:locale / html lang. */
  locale: 'en_US',
  lang: 'en',
  /** Default share image when a page has none. Generated into /public/og. */
  defaultOgImage: '/og/default.png',
  twitter: '@financelessons',
  author: 'Finance Lessons',
  themeColor: '#2563eb',
} as const;

/**
 * Resolve a canonical absolute URL for a path against Astro's configured
 * `site`. Always returns a trailing-slash-normalized absolute URL.
 */
export function canonical(path: string, origin: string | URL): string {
  const base = new URL(origin);
  const url = new URL(path, base);
  return url.href;
}
