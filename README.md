# 📚 Lessons

> Interactive, animated, **bilingual (English 🇬🇧 / Spanish 🇪🇸)** **finance** lessons that
> take you from **zero finance knowledge to complete expert** — read it, *see* it move,
> then test yourself with built-in exercises.

🌐 **Live:** [lessons.alejandrofernandezcamello.me](https://lessons.alejandrofernandezcamello.me)

🎨 **Design:** blue-forward, light-first — see **[DESIGN.md](DESIGN.md)**

🤝 **Status:** ✅ **Ready for contributions** — issues and pull requests welcome!

---

## ✨ Overview

**Lessons** is an open **finance** education platform with one mission: take a learner
with **no prior finance knowledge** and turn them into a **complete expert**. Every
*topic* is taught across multiple slug-based pages, ordered into a zero-to-expert path.
Each lesson mixes plain-language prose, animations that *teach* the core idea (not
decoration), and reusable interactive exercises (multiple-choice, quizzes, reveals,
steppers, concept matchers).

What you get out of the box:

- 🎯 **Zero-to-expert path** — courses carry a `difficulty` tier (`beginner` → `expert`)
  and `dependencies`, plotted on the catalog as a roadmap.sh-style graph so the learning
  order is obvious. Beginner tiers assume **no finance background at all**.
- 🧠 **Teach-first content** — clear copy, worked examples, and animations that explain.
- 🌍 **Fully bilingual** — every lesson ships an English source and a peninsular-Spanish (es-ES) twin in parity.
- 🧩 **Reusable islands** — interactive React components you drop into MDX with one directive.
- 🔍 **SEO + Open Graph baked in** — canonical URLs, `hreflang`, JSON-LD, and auto-generated share images.
- ⚡ **Static & fast** — Astro static output deployed on Vercel.

---

## 🛠️ Tech stack

| Layer | Choice |
| --- | --- |
| 🚀 Framework | **[Astro 6](https://astro.build)** — static output (`output: 'static'`) |
| 📦 Runtime / package manager | **[Bun](https://bun.sh)** — runtime, installer, script runner |
| ⚛️ Interactivity | **React 19** islands (`@astrojs/react`), hydrated `client:visible` |
| 🎨 Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) — tokens in `src/styles/global.css` |
| 📝 Content | **MDX** content collections (`@astrojs/mdx`) |
| 🌐 i18n | Astro i18n (en default, es prefixed) + `@astrojs/sitemap` |
| 🖼️ OG images | **Playwright** (chromium) screenshots of branded card routes |
| ▲ Hosting | **[Vercel](https://vercel.com)** (`@astrojs/vercel`) |

---

## 🚀 Getting started

```sh
bun install
bunx playwright install chromium   # one-time: needed for OG image generation
bun run dev                        # → http://localhost:4321
```

### 📋 Commands

| Command | Action |
| --- | --- |
| `bun run dev` | 🔥 Dev server with HMR at `localhost:4321` (drafts visible) |
| `bun run build` | 🏗️ Production build to `./dist/` |
| `bun run preview` | 👀 Preview the built site locally |
| `bun run check` | ✅ `astro check` + `tsc --noEmit` type checks |
| `bun run og:generate` | 🖼️ Screenshot OG cards from an existing `dist/` build |
| `bun run og:build` | 🏗️🖼️ `build` then `og:generate` |
| `bun run pre-commit` | 🧹 `audit:fix` + `check` + `build` + `og:generate` — run manually before committing |
| `bun run astro ...` | 🧰 Astro CLI (`astro add`, etc.) |

---

## 🧭 Project conventions

### The `@` import alias

Everything under `src/` imports siblings with the `@` alias (`@` = `src/`):

```ts
import { SITE } from '@/lib/site';
import { MCQ, Quiz } from '@/components/react';
```

Use it for **all** intra-`src` imports. Scripts under `scripts/` live outside
`src/` and use normal relative / node imports.

### ✍️ Content authoring

Content is two `astro:content` collections, validated in `src/content.config.ts`.
Collection ids are locale-prefixed: `<lang>/<topic>` for topics and
`<lang>/<topic>/<lesson>` for lessons.

```text
src/content/
├── topics/
│   ├── en/transformers.mdx          # /transformers
│   └── es/transformers.mdx          # /es/transformers
└── lessons/
    ├── en/transformers/attention.mdx   # /transformers/attention
    └── es/transformers/attention.mdx   # /es/transformers/attention
```

- **Topic frontmatter:** `title`, `description` (required); optional `tagline`,
  `icon` (emoji, default `📘`), `order`, `accent` (`brand` | `accent`), `draft`, `seo`.
- **Lesson frontmatter:** `title`, `description`, `topic` (owning topic's id)
  (required); optional `order`, `minutes`, `updated`, `draft`, `seo`.

Author bodies in MDX and import the React islands from `@/components/react`
(`Callout`, `MCQ`, `Quiz`, `Reveal`, `StepThrough`, `CopyButton`) with a client
directive. See **[DESIGN.md](DESIGN.md)** for the full component inventory.

### 🌐 i18n (en / es)

- English is the **default**, served unprefixed (`/catalog`).
- Spanish is prefixed (`/es/catalog`) — always **peninsular** Spanish (es-ES, Castilian).
- UI strings live in `src/i18n/ui.ts`; helpers in `src/i18n/utils.ts`.
- `hreflang` alternates and a localized sitemap are emitted automatically.

### 🖼️ SEO & Open Graph

Every page carries SEO meta via `src/components/seo/Seo.astro`. Each page's share
image path is resolved through `ogImagePath(pathname)` in **`src/lib/og.ts`** — the
single source of truth for the slug convention. `bun run pre-commit` screenshots a
branded **1200×630** card per page into `public/og/<slug>.png`, which are committed
so production references resolve to real static assets.

---

## 🤖 Agents & skills

This repo is **agent-friendly**. The same authoring know-how is available to every
assistant:

- 🟣 `CLAUDE.md` — project guide for Claude Code (also exposed as `Agents.md`, a symlink).
- 🧠 `.claude/skills/` — Claude Code skills (`research-topic`, `lesson-copy`,
  `lesson-animations`, `exercise-components`, `translate-lesson`, `new-lesson`).
- 💎 `.agents/skills/` — the same skills exposed for agent-agnostic tooling
  (a symlink to `.claude/skills`, so the two never drift).

The skills chain end-to-end: **research → copy → animations → exercises → translate**,
orchestrated by `new-lesson`.

---

## 🤝 Contributing

🎉 **This project is ready for and welcomes contributions!** Whether it's a new
lesson, a translation, a bug fix, or a new interactive component — jump in.

### Pull request process

1. 🍴 **Fork** the repo and create a branch off `main`:
   `git checkout -b feat/my-lesson`.
2. 🛠️ **Implement** your change. For new content, prefer the `new-lesson` skill so
   the English source and its Spanish twin stay in parity.
3. 🧹 **Run pre-commit** before every commit — there are **no git hooks**:
   ```sh
   bun run pre-commit   # audit:fix + check + build + og:generate
   git add public/og    # include regenerated OG cards
   ```
   ⚠️ Never commit on a red pre-commit. If it fails, fix the failure and re-run.
4. 💬 **Commit** with a clear, conventional message (e.g. `feat(lesson): add attention`).
5. 🚀 **Push** your branch and **open a pull request** against `main`.
6. 📝 In the PR description, explain *what* and *why*, link any issue, and note that
   bilingual parity is preserved (en + es) where relevant.
7. ✅ A maintainer reviews; address feedback and keep the branch green.

### Contribution checklist

- [ ] `bun run pre-commit` passes (type-check + build + OG regen).
- [ ] New/changed lessons ship **both** `en` and `es` twins.
- [ ] UI strings added to **both** locale dictionaries in `src/i18n/ui.ts`.
- [ ] Interactive components are reusable, accessible, and respect `prefers-reduced-motion`.
- [ ] No hardcoded hex values — use design tokens from `src/styles/global.css`.

---

## 👥 Contributors

Thanks to the people building Lessons 💙

| Avatar | Contributor | Role |
| --- | --- | --- |
| [<img src="https://github.com/alexfdez1010.png" width="60" alt="alexfdez1010" />](https://github.com/alexfdez1010) | **[Alejandro Fernández Camello](https://github.com/alexfdez1010)** | 🛠️ Creator & maintainer |

> Want to see your name here? Open a PR — see [Contributing](#-contributing) above. 🚀

---

## ▲ Deployment

Deployed to **Vercel** with the `@astrojs/vercel` adapter (static output).
`vercel.json` sets the framework, `bun install` as the install command, long-cache
(`immutable`) headers for `/og/*` and hashed `/_astro/*` assets, plus baseline
security headers.

Set **`PUBLIC_SITE_URL`** in the environment to drive canonical URLs, the sitemap
and absolute OG URLs (see `.env.example`). It defaults to the production domain.

---

## 📄 License

Released under the [MIT License](LICENSE). © 2026 Alejandro Fernández Camello.
