---
name: new-lesson
description: Scaffold a new bilingual (en/es) lesson or topic for the Lessons site — creates the MDX files in the correct locale folders with valid frontmatter, wires in the reusable interactive components, and regenerates OG images. Use when the user asks to "add a lesson", "add a topic", "create a lesson about X", "new lesson", or provides a subject to teach.
---

# Authoring a Lesson or Topic

This project teaches a **topic** across multiple slug-based **lesson** pages, in **English
and Spanish**. Follow these steps to add content consistently.

## 0. Research first

If the user gives a subject, do brief preliminary research so the lesson is accurate and
well-structured. Plan the lesson outline (2–6 `##` sections) before writing.

## 1. Decide: new topic or new lesson in an existing topic?

- List existing topics: look under `src/content/topics/en/`.
- A **topic** needs `src/content/topics/en/<topic>.mdx` + the `es` twin.
- A **lesson** goes in `src/content/lessons/en/<topic>/<lesson>.mdx` + the `es` twin.

Slugs must be kebab-case and SEO-friendly (e.g. `activation-functions`).

## 2. Topic frontmatter (`src/content/topics/<lang>/<topic>.mdx`)

```mdx
---
title: Neural Networks
description: A one-line summary used on cards and as the default meta description.
tagline: From a single neuron to deep networks.   # optional, shown under the hero
icon: 🧠                                            # emoji chip
order: 1                                            # sort order in the catalog
accent: brand                                       # 'brand' (blue) | 'accent' (sky)
---

Short intro prose for the topic landing page (rendered in `.prose-lesson`).
```

The Spanish file is identical structure under `.../es/<topic>.mdx`, translated.

## 3. Lesson frontmatter (`src/content/lessons/<lang>/<topic>/<lesson>.mdx`)

```mdx
---
title: What Is a Neuron?
description: SEO meta description (≤155 chars), specific and compelling.
topic: "en/neural-networks"        # MUST be the owning topic's id: "<lang>/<topic>"
order: 1                            # position within the topic
minutes: 6                         # estimated time
updated: 2026-05-30                # ISO date
---
```

- For the Spanish twin, set `topic: "es/neural-networks"`.
- Use `##` and `###` headings — they generate the on-page Table of Contents.

## 4. Use the reusable components (import via the `@` alias)

At the top of the MDX body:

```mdx
import { Callout, MCQ, Quiz, StepThrough, Reveal, CopyButton } from '@/components/react';
```

Interactive islands need `client:visible`; `Callout` is presentational (no directive).

```mdx
<Callout variant="tip" title="Key idea">A neuron is a weighted sum + a threshold.</Callout>

<MCQ
  client:visible
  question="What does an activation function add to a neuron?"
  options={[
    { text: 'Non-linearity', correct: true },
    { text: 'More memory' },
    { text: 'A faster CPU' },
  ]}
  explanation="Without a non-linear activation, stacked layers collapse into one linear map."
/>

<Quiz client:visible questions={[ /* array of MCQ prop objects */ ]} />

<StepThrough client:visible steps={[{ title: 'Step 1', body: '...' }]} />

<Reveal client:visible><Callout>Animates in on scroll.</Callout></Reveal>

<CopyButton client:visible value="bun add @astrojs/react" />
```

**Spanish lessons must pass Spanish label props** so the UI is fully localized, e.g.
`<MCQ ... checkLabel="Comprobar" retryLabel="Reintentar" />`,
`<Quiz ... questionLabel="Pregunta" ofLabel="de" scoreLabel="Tu puntuación" restartLabel="Reiniciar" nextLabel="Siguiente" backLabel="Atrás" />`,
`<CopyButton ... label="Copiar" copiedLabel="¡Copiado!" />`,
`<StepThrough ... nextLabel="Siguiente" prevLabel="Atrás" />`.
See `DESIGN.md` for the full prop reference of every component.

## 5. Always create BOTH locales

Every English file needs a Spanish twin at the mirrored `es` path. This keeps `hreflang`,
the sitemap, and the header language switcher correct. If a translation is genuinely
unavailable, the alternates helper falls back to the locale home — but prefer real twins.

## 6. Verify

```bash
bun run check     # astro check + tsc — must be 0 errors
bun run build     # routes for the new pages should appear
```

Routes appear automatically (no route file edits needed) because pages use
`getStaticPaths` over the content collections.

## 7. Regenerate OG images

```bash
bun run og:build   # build, then Playwright screenshots new /og cards into public/og/
```

(The pre-push git hook also does this, but running it now lets you preview the cards.)

## Conventions recap

- `@` import alias only — never relative `../`.
- Tailwind design tokens only (no raw hex) — see `DESIGN.md`.
- Keep content accurate, concise, and genuinely interactive — at least one exercise per lesson.
