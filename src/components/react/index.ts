/**
 * Barrel for the Lessons React islands.
 *
 * Import components and their prop/option types from a single path:
 * @example
 *   import { MCQ, Quiz, type MCQProps, type QuizProps } from '@/components/react';
 */

export { cx } from '@/components/react/cx';

export { MCQ, default as MCQDefault } from '@/components/react/MCQ';
export type { MCQProps, MCQOption } from '@/components/react/MCQ';

export { Quiz, default as QuizDefault } from '@/components/react/Quiz';
export type { QuizProps } from '@/components/react/Quiz';

export { Reveal, default as RevealDefault } from '@/components/react/Reveal';
export type { RevealProps } from '@/components/react/Reveal';

export { StepThrough, default as StepThroughDefault } from '@/components/react/StepThrough';
export type { StepThroughProps, Step } from '@/components/react/StepThrough';

export { CopyButton, default as CopyButtonDefault } from '@/components/react/CopyButton';
export type { CopyButtonProps } from '@/components/react/CopyButton';

export { Callout, default as CalloutDefault } from '@/components/react/Callout';
export type { CalloutProps, CalloutVariant } from '@/components/react/Callout';

export { LedgerReveal, default as LedgerRevealDefault } from '@/components/react/LedgerReveal';
export type { LedgerRevealProps, LedgerField } from '@/components/react/LedgerReveal';
