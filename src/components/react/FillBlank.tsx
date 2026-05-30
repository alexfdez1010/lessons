import { useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Props for the {@link FillBlank} component. */
export interface FillBlankProps {
  /** Optional prompt shown above the sentence. */
  question?: string;
  /**
   * The sentence to complete. Mark each blank with a `{{answer}}` token.
   * Supply alternatives with a pipe: `{{neuron|node|unit}}` accepts any of them
   * (the first is the canonical answer revealed on a miss).
   */
  text: string;
  /** Explanation revealed after checking. */
  explanation?: string;
  /** Match answers case-sensitively. Defaults to `false`. */
  caseSensitive?: boolean;
  /** Hint shown while typing. */
  instructions?: string;
  /** Label for the check button. Defaults to `'Check'`. */
  checkLabel?: string;
  /** Label for the retry button. Defaults to `'Try again'`. */
  retryLabel?: string;
  /** Heading above the revealed explanation. Defaults to `'Explanation'`. */
  explanationLabel?: string;
  /** Called with overall correctness so a parent (e.g. Quiz) can aggregate. */
  onResult?: (correct: boolean) => void;
  className?: string;
}

type Segment = { kind: 'text'; value: string } | { kind: 'blank'; answers: string[]; index: number };

/** Split the source into plain-text and blank segments. */
function parse(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\{\{(.+?)\}\}/g;
  let last = 0;
  let blankIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', value: text.slice(last, m.index) });
    segments.push({
      kind: 'blank',
      answers: m[1].split('|').map((a) => a.trim()),
      index: blankIndex++,
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}

/**
 * Fill-in-the-blank (cloze) exercise — the learner **types** the missing words
 * rather than recognising them in a list. This is *active recall* (the
 * generation effect): producing an answer from memory cements it far better
 * than picking from options, so reach for it when a term is worth remembering
 * verbatim.
 *
 * Each blank grades independently on **Check**: a correct entry turns
 * success-green, a wrong one turns danger-red and reveals the expected answer.
 * Matching trims whitespace and is case-insensitive by default; supply
 * synonyms with `{{answer|alt}}`. All user-facing strings are props.
 */
export function FillBlank({
  question,
  text,
  explanation,
  caseSensitive = false,
  instructions = 'Type the missing word(s), then check.',
  checkLabel = 'Check',
  retryLabel = 'Try again',
  explanationLabel = 'Explanation',
  onResult,
  className,
}: FillBlankProps) {
  const segments = useMemo(() => parse(text), [text]);
  const blankCount = useMemo(
    () => segments.filter((s) => s.kind === 'blank').length,
    [segments],
  );
  const [values, setValues] = useState<string[]>(() => Array.from({ length: blankCount }, () => ''));
  const [checked, setChecked] = useState(false);

  const norm = (s: string) => (caseSensitive ? s.trim() : s.trim().toLowerCase());
  const isBlankCorrect = (seg: Extract<Segment, { kind: 'blank' }>) =>
    seg.answers.some((a) => norm(a) === norm(values[seg.index] ?? ''));

  const correctCount = segments.reduce(
    (acc, s) => (s.kind === 'blank' && isBlankCorrect(s) ? acc + 1 : acc),
    0,
  );
  const allCorrect = correctCount === blankCount;
  const allFilled = values.every((v) => v.trim().length > 0);

  const setValue = (index: number, v: string) => {
    if (checked) return;
    setValues((prev) => {
      const next = prev.slice();
      next[index] = v;
      return next;
    });
  };

  const check = () => {
    setChecked(true);
    onResult?.(allCorrect);
  };
  const reset = () => {
    setChecked(false);
    setValues(Array.from({ length: blankCount }, () => ''));
  };

  return (
    <div
      className={cx(
        'my-6 rounded-card border border-ink-200 bg-surface p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      {question ? (
        <p className="mb-1 font-display text-base font-semibold text-balance text-ink-900 sm:text-lg">
          {question}
        </p>
      ) : null}
      {!checked ? <p className="mb-3 text-sm text-ink-500">{instructions}</p> : null}

      <p className="text-base leading-loose text-ink-800">
        {segments.map((s, i) => {
          if (s.kind === 'text') return <span key={i}>{s.value}</span>;
          const ok = checked && isBlankCorrect(s);
          const bad = checked && !isBlankCorrect(s);
          const size = Math.max(6, s.answers[0].length + 1);
          return (
            <span key={i} className="inline-flex flex-col">
              <input
                type="text"
                aria-label={`Blank ${s.index + 1}`}
                value={values[s.index] ?? ''}
                disabled={checked}
                size={size}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => setValue(s.index, e.target.value)}
                className={cx(
                  'mx-1 rounded-md border-b-2 bg-surface-sunken px-2 py-0.5 text-center font-medium text-ink-900 outline-none transition',
                  'focus:border-brand-500 focus:bg-brand-50',
                  ok && 'border-[color:var(--color-success)] bg-[color:var(--color-success)]/10',
                  bad && 'border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10',
                  !checked && 'border-ink-300',
                )}
              />
              {bad ? (
                <span className="mx-1 text-center text-xs font-semibold text-[color:var(--color-success)]">
                  {s.answers[0]}
                </span>
              ) : null}
            </span>
          );
        })}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!checked ? (
          <button
            type="button"
            onClick={check}
            disabled={!allFilled}
            className={cx(
              'inline-flex items-center rounded-pill bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors duration-200',
              'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600',
            )}
          >
            {checkLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-pill border border-ink-200 bg-surface px-5 py-2 text-sm font-semibold text-ink-700 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {retryLabel}
          </button>
        )}
        {checked && (
          <span
            className={cx(
              'text-sm font-semibold',
              allCorrect
                ? 'text-[color:var(--color-success)]'
                : 'text-[color:var(--color-danger)]',
            )}
            aria-live="polite"
          >
            {allCorrect ? '✓ Correct' : `✗ ${correctCount} / ${blankCount} correct`}
          </span>
        )}
      </div>

      {checked && explanation && (
        <div className="mt-4 rounded-card border border-brand-200 bg-brand-50/70 p-4 text-sm leading-relaxed text-ink-700 animate-fade-up">
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-brand-700">
            {explanationLabel}
          </p>
          {explanation}
        </div>
      )}
    </div>
  );
}

export default FillBlank;
