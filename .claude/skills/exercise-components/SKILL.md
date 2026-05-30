---
name: exercise-components
description: Build and use reusable interactive exercise islands for the Lessons site — multiple-choice and multi-answer questions, quizzes, and concept→definition matching/linking exercises. Covers using the existing components (MCQ, Quiz) AND authoring new reusable React islands the right way (barrel export, design tokens, a11y, i18n label props). Use when the user asks to "add a quiz/exercise", "multi-select question", "match concepts to definitions", "make a reusable exercise component", or to extend the component library.
---

# Exercises & reusable interactive components

Exercises live in `src/components/react/` as React 19 islands and are dropped
into MDX with a `client:*` directive. Always prefer **reusing/extending** an
existing component over inlining one-off JSX in a lesson.

## Placement & density (REQUIRED)

- **Every `##` section gets at least one exercise** — ideally two: a *prequestion*
  to open it and a *check* to close it. Lessons should be exercise-dense, not a
  text wall with a quiz at the bottom. When in doubt, add another exercise.
- **Open sections with a pretest** (`MCQ pretest`): asking the learner to *guess
  before reading* boosts encoding even when the guess is wrong (the
  pretesting effect). See "Pretest mode" below.
- Put the *check* exercises **after each explanation**, interleaved — not pooled
  at the end.
- **Rotate types every time** — never the same format twice in a row. Available:
  single `MCQ`, **multi-answer `MCQ`**, `MCQ pretest`, `MatchConcepts`
  (concept→definition), `Categorize` (sort into buckets), `FillBlank` (type the
  answer — active recall), scored `Quiz`.
- **Prefer recall over recognition** where a term is worth remembering verbatim:
  reach for `FillBlank` (the learner *produces* the answer) instead of another
  `MCQ` (the learner just *recognises* it). The generation effect makes it stick.
- **Spaced recall**: some questions reference *earlier* sections so the user
  recalls prior material, not only the latest paragraph.
- **Close the lesson with a chunking recap** — a learner-built `MindMap` plus a
  mixed `Quiz`, not a passive bullet summary. See the `lesson-animations` /
  `new-lesson` skills for the MindMap close.

## Pretest mode (prequestion)

`MCQ` takes a `pretest` boolean. In pretest mode it shows a low-stakes "Before
you read — take a guess" eyebrow and **never** reports to a `Quiz` score, so a
wrong guess costs nothing. Use one to **open** a section, before you've taught
the answer:

```mdx
<MCQ
  client:visible
  pretest
  question="Guess: what does a z-address hide that a t-address doesn't?"
  options={[
    { text: 'Sender, receiver, and amount', correct: true },
    { text: 'Only the amount' },
    { text: 'Nothing — both are public' },
  ]}
  explanation="A z-address shields all three. Keep this in mind as you read on."
/>
```

Spanish twins pass `pretestLabel="Antes de leer — adivina"`.

## Every island must teach or test *in place*

Don't use `StepThrough` (or any component) as a **fake-interactive list** or to
**point the learner at an exercise to do elsewhere** ("now try sketching this",
"go work through an example on paper"). An off-page instruction adds nothing —
the learner won't leave the page to do it. If a step is worth doing, make it a
real, graded island here (`FillBlank`, `Categorize`, `MCQ`, `MatchConcepts`).
Reserve `StepThrough` for genuinely sequential *content* the learner advances
through (a process with stages), never as a prompt to act outside the page.

## Existing components (reuse these first)

Import from the barrel: `import { MCQ, Quiz } from '@/components/react';`

- **`MCQ`** — single- or **multi-answer** question. Set `allowMultiple` to turn
  radios into checkboxes (multiple correct options):

  ```mdx
  <MCQ
    client:visible
    allowMultiple
    question="Which of these are activation functions?"
    options={[
      { text: 'ReLU', correct: true },
      { text: 'Sigmoid', correct: true },
      { text: 'Gradient descent' },
      { text: 'Softmax', correct: true },
    ]}
    explanation="Gradient descent is an optimizer, not an activation."
  />
  ```

- **`Quiz`** — sequences several `MCQ` prop objects and tracks a score.

Both accept i18n label props (`checkLabel`, `retryLabel`, `scoreLabel`, …) —
pass the Spanish strings in `es` lessons (see the `translate-lesson` skill).

## Concept → definition matching (new component pattern)

For "link concepts to their definitions" exercises, build a reusable
`MatchConcepts` (a.k.a. concept-linking) island rather than ad-hoc markup.
Shape it like the others:

```tsx
// src/components/react/MatchConcepts.tsx
export interface MatchPair {
  /** The concept/term shown on the left. */
  term: string;
  /** Its correct definition shown on the right. */
  definition: string;
}
export interface MatchConceptsProps {
  pairs: MatchPair[];
  /** Revealed-on-success / labels, localizable. */
  checkLabel?: string;   // default 'Check'
  retryLabel?: string;   // default 'Try again'
  className?: string;
  onResult?: (correct: boolean) => void;  // lets Quiz aggregate score
}
```

Behavior: shuffle definitions, let the user link each term→definition
(click-to-pair or drag), **Check** grades, correct links go success-green and
wrong ones danger-red, an `aria-live` region announces the result, **Try again**
resets. Mirror `MCQ`'s interaction and grading model exactly so it composes
inside `Quiz`.

For a lighter "term ⇒ meaning" glossary link (definition on hover/expand, not a
graded exercise), prefer `Reveal`/`Callout` or a small `Defn` inline component
over a full matcher.

## `Categorize` — sort items into buckets

For "which group does this belong to?" ideas (transparent vs shielded, on-chain
vs off-chain). Each item exposes one button per bucket; **Check** grades all of
them and reveals the right bucket on a miss.

```mdx
<Categorize
  client:visible
  question="Sort each detail by whether a shielded (z→z) payment hides it."
  buckets={['Hidden', 'Public']}
  items={[
    { text: 'Sender address', bucket: 'Hidden' },
    { text: 'Amount sent', bucket: 'Hidden' },
    { text: 'That a valid tx happened', bucket: 'Public' },
  ]}
  explanation="A shielded transfer hides sender, receiver, and amount — but the network still confirms a valid transaction occurred."
/>
```

## `FillBlank` — type the answer (active recall)

The strongest rotation: the learner *produces* the word from memory instead of
recognising it. Mark blanks with `{{answer}}`; accept synonyms with a pipe
`{{answer|alt}}`. Matching trims and is case-insensitive by default.

```mdx
<FillBlank
  client:visible
  question="Complete the definition from memory."
  text="A {{zero-knowledge}} proof convinces a verifier a statement is true while revealing {{nothing}} beyond its validity."
  explanation="Zero-knowledge = prove validity, reveal nothing else."
/>
```

Both expose `onResult(correct)`, so they compose inside `Quiz` like `MCQ`. Pass
Spanish label props (`checkLabel`, `retryLabel`, `explanationLabel`, plus
`instructions`) in the `es` twin.

## Rules for ANY new reusable component

1. **File + barrel.** Create `src/components/react/<Name>.tsx`; export the
   component, its `default`, and all prop/option types from
   `src/components/react/index.ts` (follow the existing pattern exactly).
2. **`@` alias only**, and use the shared `cx` helper (`@/components/react/cx`)
   for class merging — never relative imports, never `clsx` ad-hoc.
3. **Design tokens only.** Style with Tailwind token utilities
   (`bg-surface`, `text-ink-700`, `bg-brand-600`, success/danger tokens) — no
   raw hex. See `DESIGN.md`.
4. **Accessibility is required.** Real form controls (`<input>`/`<button>`),
   `radiogroup`/`group` semantics, full keyboard operability, `aria-live` for
   dynamic results, visible focus rings, and honor `prefers-reduced-motion`.
5. **i18n.** Every user-facing string is a prop with an English default so
   Spanish lessons can pass translated labels. No hard-coded copy inside.
6. **Composability.** Graded exercises expose `onResult(correct)` so `Quiz` can
   aggregate them.
7. **Type + verify.** Document props with JSDoc, then `bun run check` (0 errors).

## Wire it into a lesson

```mdx
import { MCQ, Quiz, MatchConcepts, Categorize, FillBlank, MindMap } from '@/components/react';

<MatchConcepts
  client:visible
  pairs={[
    { term: 'Weight', definition: 'How much an input matters.' },
    { term: 'Bias', definition: 'A constant shift added to the weighted sum.' },
  ]}
/>
```

Aim for **at least one exercise per lesson**. Then regenerate OG and run
`bun run check`.
