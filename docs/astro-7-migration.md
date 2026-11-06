# Astro migration

Lessons uses Astro 7 with static output and no server adapter. Astro, the React integration and the MDX integration are upgraded together. Sitemap remains on its compatible current release.

The migration follows [Astro's upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/):

- Vite uses the version required by Astro instead of the previous Vite 7 override. The devalue override is also removed so Astro can use its required version.
- `@astrojs/markdown-remark` and `unified()` preserve remark-math and rehype-katex processing for all MDX lessons.
- `compressHTML: true` preserves the previous inline whitespace handling.
- The OG screenshotter uses `astro preview --ignore-lock` to keep its temporary server in the foreground and independent of an existing agent preview.
- The security audit runs without ignored advisories.

The site continues to publish only generated static assets through Wrangler. No content or persistent learner data is migrated.

Before deployment, run `bun audit`, `bun test` and `bun run pre-commit`, then verify bilingual lessons, rendered formulas, island hydration, catalog navigation and redirects in the generated site.

To roll back, revert the migration commit, run `bun install --frozen-lockfile`, rebuild and deploy the previous static output. Browser progress remains in the existing local storage format.

## Validation

Validated on 6 November 2026 with Astro 7.4.7, MDX 8.1.3 and React integration 7.1.4:

- `bun audit`: no vulnerabilities, without exclusions.
- `bun test`: 51 tests passed.
- `bun run check`: 21,915 formulas and 12,802 JSX island elements checked across 1,080 MDX files; type checks passed with 53 existing hints.
- Static build: 1,085 pages generated.
- Playwright: English and Spanish sampling lessons each rendered 60 KaTeX expressions, hydrated their first MCQ and accepted and graded an answer; no browser errors. Home, both catalogs and the Spanish mobile lesson were visually inspected. The home animation completed and exposed Replay.
- OG generation: five representative routes regenerated successfully while a separate preview server was running.
