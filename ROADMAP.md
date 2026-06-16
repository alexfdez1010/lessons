# Lessons Roadmap — quant finance · crypto · DeFi

The build queue is no longer a checklist in this file. It lives as **structured,
UI-rendered data** in **`src/lib/upcoming.ts`** (`upcomingCourses`). Each entry is
a finance course that is *planned but not yet built*; the site renders them as
dimmed **"Coming soon"** nodes on the catalog dependency graph and on a dedicated
**`/upcoming`** page (linked from the header and home page).

This file is now just the **agent contract** — the rules. The queue itself, and
"what's next", is `src/lib/upcoming.ts`.

## Why the queue is data now

- **Shown in the UI for free.** Adding/removing a queue entry instantly updates
  the catalog graph, the `/upcoming` page, and the home-page teaser — no markup.
- **Adding a next course is trivial.** Append an `UpcomingCourse` object to
  `upcomingCourses` (slug, icon, difficulty, order, bilingual title/description,
  `dependencies`, `tags`, and a free-text `buildNotes` brief). Nothing else.
- **Graduating a course is trivial.** Once its topic MDX exists under
  `src/content/topics/`, **delete its entry from `upcomingCourses`**. The built
  topic is now the record (it appears on the live catalog automatically); an
  upcoming entry only ever describes what is still missing. Keeping a slug in
  both places would draw the node twice.

## Rules for the daily autonomous agent

The daily agent (`scripts/daily-lesson.sh`, 06:00 / 18:00 Europe/Madrid) builds
the **lowest-`order` entry** in `upcomingCourses`, then **deletes that entry**.

- Build strictly within: quantitative finance, crypto, DeFi (plus the bilingual
  finance scope in CLAUDE.md).
- Go in order. Build the lowest-`order` upcoming entry first. Never build
  something easier than the most recently built course (keep the ramp monotone).
- One topic per run, en + es twin, per CLAUDE.md. Use the entry's `buildNotes`
  as the build brief, its `dependencies`/`tags` for catalog wiring, and keep the
  same `slug` for the topic MDX so it graduates cleanly.
- After building a course, **remove its entry from `upcomingCourses`** (this is
  the "tick it off" step — the topic MDX is now the record).
- When fewer than **3** entries remain in `upcomingCourses`, **append** the next
  harder topics (each one notch up, horizontal-then-deeper) so the queue never
  empties.
- Difficulty legend: ⬤ beginner · ⬤⬤ intermediate · ⬤⬤⬤ advanced · ⬤⬤⬤⬤ expert
  (mirrors the `difficulty` field on each entry).

_Stages −1 through 7 are built and live in the catalog — see
`src/content/topics/en/`. Everything still to build is in `src/lib/upcoming.ts`._

## Build log

Most recently graduated courses (removed from `upcomingCourses` once their topic
MDX landed):

- [x] **Algorithmic Trading & Execution** (`algorithmic-trading-and-execution`, expert) — built 2026-06-13.
- [x] **Exotic Options & Structured Products** (`exotic-options-and-structured-products`, expert) — built 2026-06-14.
- [x] **Counterparty Risk & XVA** (`counterparty-risk-and-xva`, expert) — built 2026-06-14.
- [x] **Systematic & Statistical Arbitrage** (`systematic-and-statistical-arbitrage`, expert) — built 2026-06-15.
- [x] **Mental Models for Finance** (`mental-models-for-finance`, beginner) — built 2026-06-16.
