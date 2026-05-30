# Lessons

Interactive, animated, **bilingual (English / Spanish)** lessons that teach any
topic from scratch — read, visualize, and test yourself with built-in
exercises. Blue-forward, light-first design.

Live at **https://lessons.alejandrofernandezcamello.me**

---

## Tech stack

- **[Astro 6](https://astro.build)** — static output (`output: 'static'`)
- **[Bun](https://bun.sh)** — runtime, package manager, script runner
- **React 19** islands for interactive components (`@astrojs/react`)
- **Tailwind CSS v4** (`@tailwindcss/vite`) — tokens in `src/styles/global.css`
- **MDX** for authored lessons (`@astrojs/mdx`)
- **i18n** built into Astro (en default, es prefixed) + `@astrojs/sitemap`
- **Playwright** (chromium) to generate Open Graph share images
- **[Vercel](https://vercel.com)** deployment (`@astrojs/vercel`)

---

## Getting started

```sh
bun install
bunx playwright install chromium   # one-time: needed for OG image generation
bun run dev                        # http://localhost:4321
```

### Commands

| Command | Action |
| --- | --- |
| `bun run dev` | Dev server with HMR at `localhost:4321` (drafts visible) |
| `bun run build` | Production build to `./dist/` |
| `bun run preview` | Preview the built site locally |
| `bun run check` | `astro check` + `tsc --noEmit` type checks |
| `bun run og:generate` | Screenshot OG cards from an existing `dist/` build |
| `bun run og:build` | `build` then `og:generate` |
| `bun run pre-commit` | `check` + `build` + `og:generate` — run manually before committing |
| `bun run astro ...` | Astro CLI (`astro add`, etc.) |

---

## The `@` import alias

Everything under `src/` imports siblings with the `@` alias (`@` = `src/`):

```ts
import { SITE } from '@/lib/site';
import { MCQ, Quiz } from '@/components/react';
```

Use it for **all** intra-`src` imports. Scripts under `scripts/` live outside
`src/` and use normal relative / node imports instead.

---

## Content authoring

Content is two `astro:content` collections, validated in
`src/content.config.ts`. Collection ids are locale-prefixed:
`<lang>/<topic>` for topics and `<lang>/<topic>/<lesson>` for lessons.

```text
src/content/
├── topics/
│   ├── en/transformers.mdx          # /transformers
│   └── es/transformers.mdx          # /es/transformers
└── lessons/
    ├── en/transformers/attention.mdx   # /transformers/attention
    └── es/transformers/attention.mdx   # /es/transformers/attention
```

**Topic frontmatter**: `title`, `description` (required); optional `tagline`,
`icon` (emoji, default `📘`), `order` (sort), `accent` (`brand` | `accent`),
`draft`, and an `seo` block.

**Lesson frontmatter**: `title`, `description`, `topic` (reference to the
owning topic's id) (required); optional `order`, `minutes`, `updated`,
`draft`, and `seo`.

The `seo` block (both collections) supports `title`, `description`, `ogImage`,
`keywords[]`, `noindex`. Drafts (`draft: true`) are visible in `astro dev` but
excluded from production builds and the sitemap.

Author bodies in MDX and import the React islands from `@/components/react`
(`Callout`, `MCQ`, `Quiz`, `Reveal`, `StepThrough`, `CopyButton`) with a
client directive. See **[DESIGN.md](DESIGN.md)** for the full component
inventory, props and examples.

---

## i18n (en / es)

- English is the **default**, served unprefixed (`/catalog`).
- Spanish is prefixed (`/es/catalog`).
- `prefixDefaultLocale: false` — configured in `astro.config.mjs`.
- UI strings live in `src/i18n/ui.ts`; helpers (`localizePath`,
  `getLangFromUrl`, `alternates`, `parseId`, …) in `src/i18n/utils.ts`.
- `hreflang` alternates and a localized sitemap are emitted automatically.

---

## SEO & Open Graph images

Every page carries SEO meta (canonical, `hreflang`, Open Graph / Twitter)
via `src/components/seo/Seo.astro`. Each page's share image path is resolved
through `ogImagePath(pathname)` in **`src/lib/og.ts`** — the single source of
truth for the slug convention:

| Page pathname | OG slug → file | OG card route |
| --- | --- | --- |
| `/` | `default` → `/og/default.png` | `/og/default` |
| `/catalog` | `catalog` → `/og/catalog.png` | `/og/catalog` |
| `/es/transformers/attention` | `es-transformers-attention` → `/og/es-transformers-attention.png` | `/og/es/transformers/attention` |

### Pipeline (end to end)

1. **Card routes** — `src/pages/og/default.astro` (generic site card) and
   `src/pages/og/[...slug].astro` (one card per catalog / topic / lesson, both
   locales) render a standalone **1200×630** branded card (`#og-card`),
   pulling titles/descriptions from content. They are not linked from the site.
2. **`bun run pre-commit`** runs `astro build`, then
   **`scripts/generate-og.ts`**:
   - boots `astro preview` on port 4321 and waits for it,
   - walks `dist/` to enumerate real page routes,
   - maps each pathname → OG card route + PNG slug (mirroring `src/lib/og.ts`),
   - drives Playwright/chromium to screenshot `#og-card` into
     `public/og/<slug>.png` (2× scale, fonts settled),
   - tears down preview and reports a summary.
3. The PNGs in `public/og/` are committed so production references resolve to
   real static assets.

Run `bunx playwright install chromium` once before the first generation.

### Pre-commit (manual)

There are no git hooks. Before committing content or dependency changes, run:

```sh
bun run pre-commit   # audit fix + check + build + og:generate → public/og/*.png
git add public/og
```

So the committed cards never drift from the content and dependency
vulnerabilities are patched. Run it yourself — nothing is installed or
triggered automatically.

---

## Deployment

Deployed to **Vercel** with the `@astrojs/vercel` adapter (static output).
`vercel.json` sets the framework, `bun install` as the install command, and
adds long-cache (`immutable`) headers for `/og/*` and hashed `/_astro/*`
assets plus baseline security headers (`X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`).

Set **`PUBLIC_SITE_URL`** in the environment to drive canonical URLs, the
sitemap and absolute OG URLs (see `.env.example`). It defaults to the
production domain.
