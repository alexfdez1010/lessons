/**
 * Open Graph image path convention — the SINGLE source of truth shared by
 * the layouts (which reference the image) and scripts/generate-og.ts (which
 * writes the PNGs via Playwright). Keep both sides importing this so they
 * never drift.
 *
 * A route pathname maps to a flat slug used as the PNG filename:
 *   '/'                          -> 'default'
 *   '/catalog'                   -> 'catalog'
 *   '/es/transformers/attention' -> 'es-transformers-attention'
 *
 * Files live in /public/og/<slug>.png and are committed (generated in the
 * pre-commit step), so production references resolve to real static assets.
 */
export function ogSlug(pathname: string): string {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (clean === '') return 'default';
  return clean.replace(/\//g, '-').toLowerCase();
}

/** Public URL path of the OG image for a given route pathname. */
export function ogImagePath(pathname: string): string {
  return `/og/${ogSlug(pathname)}.png`;
}

/** The matching internal route that renders the screenshot-able OG card. */
export function ogCardRoute(pathname: string): string {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  return clean === '' ? '/og/default' : `/og/${clean}`;
}
