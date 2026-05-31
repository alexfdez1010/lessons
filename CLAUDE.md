# Lessons — project guide

Interactive, animated, **bilingual (en/es)** educational webpages. Each *topic* is taught
across multiple slug-based pages, with reusable interactive exercises (quizzes, steppers,
reveals) and a strong SEO + Open Graph pipeline. Built to deploy on Vercel at
**https://lessons.alejandrofernandezcamello.me**.

## 🎯 Mission — finance, zero to expert

**This is a finance learning platform.** Its single goal: take a learner with
**no prior finance knowledge** and make them a **complete expert**. Every course,
lesson, analogy, and exercise must serve that arc.

- **Assume zero background.** A beginner-tier lesson must not lean on any finance
  term it hasn't defined. Define jargon on first use; never assume the reader has
  seen a balance sheet, a ticker, or a Sharpe ratio before.
- **Build a ladder, not islands.** Order courses and lessons so each one only
  needs what came before it. Use the topic `dependencies` array to encode the
  path, and the new `difficulty` field (`beginner` → `intermediate` → `advanced`
  → `expert`) to label how far up the ladder a course sits.
- **End at genuine expertise.** `expert`-tier content goes all the way — the
  quantitative, edge-case, real-practitioner depth. Don't stop at "intro".
- **New courses are finance courses.** When scaffolding a topic, place it on the
  zero-to-expert ladder: pick its `difficulty`, wire its `dependencies`, and make
  sure its prerequisites are themselves taught on the platform.

## ⚡ Work in parallel — prioritize multiple agents

This codebase has lots of independent, parallelizable work (a lesson + its `es`
twin, multiple lessons in a topic, research + components + copy). **Prefer
fanning the work out across several subagents** instead of doing it all
sequentially — it's much faster.

- Spawn parallel `Agent`s (or a `Workflow` when the user opts in) for independent
  units: e.g. one agent per lesson, en/es twins in parallel, research vs.
  component-building vs. copywriting concurrently.
- Send independent agent calls in a **single message** so they run at once.
- Reserve sequential work for genuinely dependent steps (research → write →
  translate). Translation depends on the finished English source; everything
  upstream of it can parallelize.
- Each Spanish twin is **es-ES (Spain / Castilian)** — see `translate-lesson`.

## 📚 Go exhaustive — depth is the default for lessons

When asked to build, expand, or "go more exhaustive/extensive/in depth" on a
lesson, **bias hard toward thoroughness, not brevity**. A lesson is a teaching
artifact, not a summary — err on the side of *too much* over *too little*.

- **Cover every sub-idea.** Each metric/concept gets its **own `##` section**
  with: an intuitive analogy, the precise definition/formula, **at least one
  fully worked numeric example** (show the arithmetic), a common
  misconception/pitfall, and a `### When to use it` or trade-off note.
- **Graphs and visuals everywhere.** Every quantitative relationship,
  process, or transformation gets a **chart/animation island** beside its
  explanation — distributions, equity curves, scatter/regression, growth
  curves, before/after. Don't ship a metrics or math lesson with only one
  visual; build new reusable SVG/Canvas islands when none fit (design tokens,
  `prefers-reduced-motion`, locale-agnostic string props — see existing
  islands like `RiskReturnRace`, `LedgerReveal`).
- **Worked examples + tables.** Use Markdown tables to compare options
  side-by-side and step through real numbers. Multiple examples per concept.
- **Interaction density still applies** (pretest → explain → check, rotate
  types, spaced recall, MindMap + Quiz recap) — exhaustiveness *adds* to it,
  never replaces it.
- **Parallelize the depth** (see below): fan one agent per chart component,
  per section draft, and per locale so going deep doesn't mean going slow.

## ⚡ Work in parallel — prioritize multiple agents (use them aggressively)

Going exhaustive multiplies the independent work — so **fan it out across
many subagents by default**, in a single message, rather than doing it
sequentially. Treat parallel agents as the normal mode, not the exception.

- One agent per **new chart/animation component**, run concurrently — but each
  agent only **creates its own file**; never let parallel agents edit the
  shared barrel `src/components/react/index.ts` (race). Wire the barrel
  centrally afterward.
- One agent per **section draft**, per **lesson**, per **locale twin**.
- Send all independent agent calls in **one message** so they run at once.
- Reserve sequential work for genuinely dependent steps (research → write →
  translate; build components → then author the MDX that imports them).

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

- Topic: `src/content/topics/en/<topic>.mdx` → `title, description, tagline?, icon, order, accent('brand'|'accent'), difficulty, dependencies[]`.
  - `difficulty` is **required by the mission**: `beginner` (assumes **no prior finance
    knowledge**) | `intermediate` | `advanced` | `expert` (deepest, most quantitative).
    It renders as a badge + legend on the catalog graph. Set the **same value in the en
    and es twins**. Pick it honestly relative to the zero-to-expert ladder, and make sure
    everything a non-`beginner` course assumes is taught by one of its `dependencies`.
- Lesson: `src/content/lessons/en/<topic>/<lesson>.mdx` → `title, description, topic: "en/<topic>", order, minutes?, updated?`.
- Add the Spanish twins under `.../es/...` with `topic: "es/<topic>"`.
- Use `##`/`###` headings (they feed the lesson Table of Contents).
- Import interactive components from `@/components/react` and add `client:visible`
  (except `<Callout>`, which is presentational). In Spanish lessons pass the Spanish label
  props (e.g. `checkLabel`, `scoreLabel`, `copiedLabel`).

The **`/new-lesson` skill** scaffolds a topic or lesson end-to-end — prefer it.
It chains the project skill suite:

- **`research-topic`** — research + sourced outline **before** writing (run first).
- **`lesson-copy`** — fun, witty, analogy-driven voice without losing accuracy.
- **`lesson-animations`** — at least one animation that *teaches* the core idea.
- **`exercise-components`** — build/reuse interactive exercises (multi-answer
  `MCQ`, `Quiz`, `concept → definition` matcher) as proper components.
- **`translate-lesson`** — keep the en/es twins in parity.

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
| `bun run audit` / `audit:fix` | Vuln report / `bun update` + report |
| `bun run pre-commit` | `audit:fix` + `check` + build + regenerate OG (run manually) |

## Workflow order — implement → pre-commit → commit → push (AUTOMATIC)

Every change follows this order, **automatically and without being asked**. After
you finish implementing a change, run the full sequence yourself — do **not** stop
to ask "want me to commit?" or hand the commands back to the user. No exceptions.

1. **Implement** the change in full.
2. Run **`bun run pre-commit`** (then `git add public/og`).
3. **Commit**.
4. **Push**.

Treat "the change is done" as the trigger to run steps 2–4 on your own. The only
time you pause is if `bun run pre-commit` fails (fix it, re-run) or the user
explicitly said not to commit. Never commit or push before the change is finished
and `bun run pre-commit` is green.

## Pre-commit (manual — no git hooks)

Husky was removed; there are **no git hooks**. **ALWAYS run `bun run pre-commit`
before every `git commit` and `git push`** — no exceptions, even for small or
non-content changes. After it finishes, `git add public/og` so regenerated OG
cards are included in the commit.

```bash
bun run pre-commit && git add public/og
git commit -m "…"
git push
```

It patches vulnerabilities (`audit:fix`), type-checks, builds, and regenerates
the OG cards so committed images never drift from the content. If `bun run
pre-commit` fails, fix the failure and re-run it — never commit or push on a red
pre-commit.

When `bun audit` flags a transitive advisory that `bun update` can't clear, pin
a safe version in the `overrides` block of `package.json` (see the existing
`yaml` / `path-to-regexp` pins), then re-run `bun install && bun audit`.

## Conventions

- TypeScript strict everywhere. Prefer `interface Props` in `.astro` frontmatter.
- Keep components reusable and locale-agnostic (pass user-facing strings as props).
- Accessibility is required: semantic landmarks, `aria-live` for dynamic results,
  keyboard operability, and `prefers-reduced-motion` is respected globally.
