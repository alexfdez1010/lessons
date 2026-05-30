---
name: exercise-components
description: Build and use reusable interactive exercise islands for the Lessons site — multiple-choice and multi-answer questions, quizzes, and concept→definition matching/linking exercises. Covers using the existing components (MCQ, Quiz) AND authoring new reusable React islands the right way (barrel export, design tokens, a11y, i18n label props). Use when the user asks to "add a quiz/exercise", "multi-select question", "match concepts to definitions", "make a reusable exercise component", or to extend the component library.
---

# Exercises & reusable interactive components

Exercises live in `src/components/react/` as React 19 islands and are dropped
into MDX with a `client:*` directive. Always prefer **reusing/extending** an
existing component over inlining one-off JSX in a lesson.

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
import { MCQ, Quiz, MatchConcepts } from '@/components/react';

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
