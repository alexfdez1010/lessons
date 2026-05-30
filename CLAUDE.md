# Lessons — project guide

Interactive, animated, **bilingual (en/es)** educational webpages. Each *topic* is taught
across multiple slug-based pages, with reusable interactive exercises (quizzes, steppers,
reveals) and a strong SEO + Open Graph pipeline. Built to deploy on Vercel at
**https://lessons.alejandrofernandezcamello.me**.

## Stack

- **Astro 6** (static output, `@astrojs/vercel` adapter) — fast, SEO-friendly rendering.
- **React 19** islands for all interactivity/animation (hydrated with `client:visible`).
- **Tailwind CSS v4** (via `@tailwindcss/vite`) — design tokens in `src/styles/global.css`.
- **MDX** content collections for lessons/topics.
- **Bun** is the runtime + package manager. Use `bun` / `bunx`, never npm/pnpm/yarn.
- **Playwright** generates OG share images from rendered pages.

## ⚠️ Import alias — ALWAYS use `@`

Every import of a file under `src/` MUST use the `@` alias (`@` = `src/`). Never use
relative `../` paths. Configured in `tsconfig.json` (`paths: { "@/*": ["src/*"] }`).

```ts
import BaseLayout from '@/layouts/BaseLayout.astro';
import { MCQ, Quiz } from '@/components/react';
import { useTranslations, localizePath } from '@/i18n/utils';
```

Exceptions: `astro.config.mjs` and files under `scripts/` live outside `src/` and use
relative/node imports.

## Directory map

```
src/
  components/
    react/        # Reusable interactive islands (MCQ, Quiz, Reveal, StepThrough, CopyButton, Callout). Barrel: index.ts
    seo/Seo.astro # All <head> meta: title, OG, Twitter, hreflang, JSON-LD
    ui/           # Header, Footer, Breadcrumbs (Astro chrome)
  content/
    topics/<lang>/<topic>.mdx           # id: "<lang>/<topic>"
    lessons/<lang>/<topic>/<lesson>.mdx # id: "<lang>/<topic>/<lesson>"
  content.config.ts                     # Collection schemas (topics, lessons)
  i18n/ui.ts, i18n/utils.ts             # Dictionaries + helpers
  layouts/BaseLayout.astro, LessonLayout.astro
  lib/site.ts, lib/content.ts, lib/og.ts
  pages/                                # Routes (en at root, es under /es/). og/** = OG card routes
  styles/global.css                     # Design tokens (@theme) — single source of truth
scripts/generate-og.ts                  # Playwright OG screenshotter
public/og/                              # Generated OG PNGs (committed)
```

## Routing & i18n

English is the default locale served at the root (`/catalog`); Spanish is prefixed
(`/es/catalog`). Configured via Astro `i18n` (`prefixDefaultLocale: false`).

- URL scheme: `/<topic>` (topic landing) and `/<topic>/<lesson>` (lesson); `/es/...` for Spanish.
- Page chrome strings live in `src/i18n/ui.ts` — add a key to **both** locales.
- In `.astro` files: `const lang = getLangFromUrl(Astro.url); const t = useTranslations(lang);`
- Build links with `localizePath('/catalog', lang)` — pass **bare** paths (no locale prefix).
- Every page passes `lang` + `alternates` to the layout so `hreflang` and the header
  language switcher work. Use `src/lib/content.ts` helpers for content-page alternates.

## Authoring content

A topic = a subject with many lessons. To add content, create MDX under the locale folder
and set frontmatter (see schema in `src/content.config.ts`):

- Topic: `src/content/topics/en/<topic>.mdx` → `title, description, tagline?, icon, order, accent('brand'|'accent')`.
- Lesson: `src/content/lessons/en/<topic>/<lesson>.mdx` → `title, description, topic: "en/<topic>", order, minutes?, updated?`.
- Add the Spanish twins under `.../es/...` with `topic: "es/<topic>"`.
- Use `##`/`###` headings (they feed the lesson Table of Contents).
- Import interactive components from `@/components/react` and add `client:visible`
  (except `<Callout>`, which is presentational). In Spanish lessons pass the Spanish label
  props (e.g. `checkLabel`, `scoreLabel`, `copiedLabel`).

The **`/new-lesson` skill** scaffolds a topic or lesson end-to-end — prefer it.

## Design system

Blue-forward, light-first. All tokens (colors `brand-*`/`accent-*`/`ink-*`/`surface*`,
fonts `font-display/sans/mono`, `rounded-card/pill`, `shadow-soft/lift`,
`animate-fade-up/float`, `.prose-lesson`) are defined in `src/styles/global.css`'s `@theme`
block and documented in **DESIGN.md**. Use Tailwind utilities; do not hardcode hex values.

## SEO + OG image pipeline

- `Seo.astro` emits canonical, robots, Open Graph, Twitter card, `hreflang` alternates and
  JSON-LD. `BaseLayout` auto-derives each page's OG image path via `src/lib/og.ts`.
- OG images are screenshots of branded `/og/...` card routes, captured by Playwright into
  `public/og/<slug>.png`. The slug convention lives in `src/lib/og.ts` (single source of truth).
- Regenerate with `bun run og:generate` (needs a build first) or `bun run og:build`.

## Commands

| Command | Purpose |
|---|---|
| `bun install` + `bunx playwright install chromium` | First-time setup |
| `bun run dev` | Dev server |
| `bun run build` | Static build → `dist/` (+ `.vercel/output`) |
| `bun run preview` | Preview the build |
| `bun run check` | `astro check` + `tsc --noEmit` |
| `bun run og:generate` / `og:build` | Generate OG images |
| `bun run pre-commit` | Build + regenerate OG (run by the pre-push git hook) |

## Git automation

A **husky `pre-push` hook** (`.husky/pre-push`) runs `bun run pre-commit` then
`git add public/og`, so OG images are regenerated and committed before every push.

## Conventions

- TypeScript strict everywhere. Prefer `interface Props` in `.astro` frontmatter.
- Keep components reusable and locale-agnostic (pass user-facing strings as props).
- Accessibility is required: semantic landmarks, `aria-live` for dynamic results,
  keyboard operability, and `prefers-reduced-motion` is respected globally.
