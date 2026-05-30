/**
 * Barrel for the Lessons React islands.
 *
 * Import components and their prop/option types from a single path:
 * @example
 *   import { MCQ, Quiz, type MCQProps, type QuizProps } from '@/components/react';
 */

export { cx } from './cx';

export { MCQ, default as MCQDefault } from './MCQ';
export type { MCQProps, MCQOption } from './MCQ';

export { Quiz, default as QuizDefault } from './Quiz';
export type { QuizProps } from './Quiz';

export { Reveal, default as RevealDefault } from './Reveal';
export type { RevealProps } from './Reveal';

export { CopyButton, default as CopyButtonDefault } from './CopyButton';
export type { CopyButtonProps } from './CopyButton';

export { StepThrough, default as StepThroughDefault } from './StepThrough';
export type { StepThroughProps, Step } from './StepThrough';

export { Callout, default as CalloutDefault } from './Callout';
export type { CalloutProps, CalloutVariant } from './Callout';
