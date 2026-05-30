/**
 * generate-og.ts — Open Graph image generator (run with `bun`).
 *
 * Pipeline:
 *   1. Boot `astro preview` on a fixed port as a child process and wait until
 *      the port answers (the npm script runs `astro build` first).
 *   2. Walk the built `dist/` tree to enumerate the real page routes.
 *   3. For each route, drive Playwright/chromium to open the *actual page* in a
 *      1200×630 viewport, let animations settle, and screenshot it into
 *      public/og/<slug>.png.
 *   4. Tear down preview and report a summary.
 *
 * The OG image is a screenshot of the corresponding page itself (matching the
 * `me` repo's approach) — not a separate branded card route. The slug mapping
 * below MUST stay identical to src/lib/og.ts — it's replicated here (rather
 * than imported) because this script lives outside src/ and the `@` alias /
 * astro:content imports are unavailable to plain bun.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright';
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'public', 'og');
const PORT = 4321;
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const WIDTH = 1200;
const HEIGHT = 630;

/** Wait time (ms) after load to let island animations settle before capture. */
const SETTLE_DELAY = 2000;

/* ---- og.ts mirror — KEEP IN SYNC WITH src/lib/og.ts --------------------- */

/** '/'->'default', '/catalog'->'catalog', '/es/a/b'->'es-a-b'. */
function ogSlug(pathname: string): string {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (clean === '') return 'default';
  return clean.replace(/\//g, '-').toLowerCase();
}

/* ---- helpers ------------------------------------------------------------ */

/** Recursively collect every directory containing an index.html under dist. */
function collectRoutes(dir: string): string[] {
  const routes: string[] = [];
  const walk = (current: string) => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    if (entries.includes('index.html')) {
      const rel = relative(DIST, current).split('\\').join('/');
      routes.push(rel === '' ? '/' : `/${rel}`);
    }
    for (const name of entries) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
    }
  };
  walk(dir);
  return routes;
}

/** Wait until the preview server answers on the port (or time out). */
async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok || res.status === 404) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Preview server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('✗ dist/ not found. Run `astro build` first (use `bun run og:build`).');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // Enumerate real page routes, dropping any leftover og routes and 404.
  const allRoutes = collectRoutes(DIST);
  const pageRoutes = allRoutes.filter(
    (r) => !r.startsWith('/og') && r !== '/404' && !r.endsWith('/404'),
  );

  if (pageRoutes.length === 0) {
    console.warn('⚠ No page routes found in dist/. Nothing to screenshot.');
    return;
  }

  console.log(`▸ Found ${pageRoutes.length} page route(s) needing OG images.`);

  // Boot astro preview.
  console.log(`▸ Starting astro preview on ${BASE} …`);
  const server: ChildProcess = spawn(
    'bunx',
    ['astro', 'preview', '--host', HOST, '--port', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' },
  );

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const ok: string[] = [];
  const failed: { route: string; error: string }[] = [];

  try {
    await waitForServer(`${BASE}/`);
    console.log('▸ Preview ready. Launching chromium …');

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2, // crisp 2x output
    });

    for (const pathname of pageRoutes) {
      const slug = ogSlug(pathname);
      const outFile = join(OUT_DIR, `${slug}.png`);
      const page = await context.newPage();
      try {
        const res = await page.goto(`${BASE}${pathname}`, {
          waitUntil: 'networkidle',
          timeout: 20_000,
        });
        if (!res || !res.ok()) {
          throw new Error(`route ${pathname} returned ${res?.status() ?? 'no response'}`);
        }
        // Ensure web fonts are laid out, then let animations settle.
        await page.evaluate(() => (document as any).fonts?.ready);
        await page.waitForTimeout(SETTLE_DELAY);

        // Screenshot the visible 1200×630 viewport (top of the page).
        await page.screenshot({
          path: outFile,
          clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        });
        ok.push(slug);
        console.log(`  ✓ ${pathname}  →  public/og/${slug}.png`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ route: pathname, error: msg });
        console.warn(`  ✗ ${pathname}: ${msg}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }

  console.log(`\n▸ OG generation complete: ${ok.length} ok, ${failed.length} failed.`);
  if (failed.length) {
    for (const f of failed) console.log(`   ✗ ${f.route} — ${f.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✗ OG generation crashed:', err);
  process.exit(1);
});
