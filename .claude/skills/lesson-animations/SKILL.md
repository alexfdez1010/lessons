---
name: lesson-animations
description: Design and build animations that make a Lessons topic genuinely easier to understand — visual, moving explanations of the core idea (not decoration), authored as reusable React islands using the project's motion tokens and always respecting prefers-reduced-motion. Use when authoring a lesson that has a process/relationship/transformation worth showing, or when the user asks to "animate X", "add a visual", "make it move", or "explain this with an animation".
---

# Animations that teach

Every lesson should include **at least one animation that explains the topic
better than text or a static image could**. Animation is a teaching tool here,
not decoration — if it doesn't increase understanding, don't add it.

## When an animation earns its place

Animate when the idea is about **change over time, a process, or a relationship**:
- a process with steps (forward pass, request lifecycle, sorting)
- a transformation (input → output, before → after)
- a relationship where moving one knob changes another (weights → output,
  learning rate → convergence)
- accumulation / growth / decay

If the idea is a static fact or definition, use a `Callout`, diagram, or
`MatchConcepts` exercise instead.

## How to build it (reusable island)

Author animations as React islands in `src/components/react/` and follow the
**same rules as every component** (see `exercise-components`): barrel export,
`@` alias + `cx`, design tokens only, JSDoc'd props, `bun run check` clean.
Prefer an **interactive** island (user scrubs a slider / steps through) over a
passive loop — interaction cements understanding.

Building blocks already in the project:

- **Motion tokens** in `src/styles/global.css`: `animate-fade-up`, `animate-float`
  (Tailwind: `animate-fade-up`, `animate-float`). Add new `@keyframes` + an
  `--animate-*` token there if you need more — never inline hard-coded hex or
  one-off CSS in a component.
- **`StepThrough`** — for a discrete, click-advanced sequence of stages.
- **`Reveal`** — to animate an element in on scroll.
- Plain React state + CSS transitions / SVG for custom interactive visuals
  (sliders driving a value, an animated SVG graph, a canvas).

## Non-negotiables

1. **Accessibility / motion safety.** Wrap motion in
   `@media (prefers-reduced-motion: reduce)` (the project already does this
   globally in `global.css`) — provide a static, equally-informative fallback.
   No essential information conveyed by motion alone.
2. **Performance.** Animate `transform`/`opacity`, not layout properties. Keep
   islands light; hydrate with `client:visible`.
3. **Labeled & controllable.** Interactive controls are real, keyboard-operable
   inputs with labels and visible focus rings; loops should be calm and not
   distract from reading.
4. **Tokens & alias only.** Tailwind design tokens, `@` imports, `cx` helper.

## Wire it into the lesson

```mdx
import { Reveal, StepThrough } from '@/components/react';
// or your custom island, e.g.:
import { NeuronPlayground } from '@/components/react';

<NeuronPlayground client:visible />
```

Add Spanish label props in the `es` twin. Then `bun run check` and regenerate OG.
