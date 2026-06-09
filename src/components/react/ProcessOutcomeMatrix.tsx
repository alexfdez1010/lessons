import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One quadrant of the process × outcome matrix. */
export interface ProcessOutcomeCell {
  /** The quadrant's name (e.g. "Deserved success"). */
  label: string;
  /** The teaching note: what this combination means and why it matters. */
  note: string;
  /** An optional concrete investing example for the quadrant. */
  example?: string;
}

export interface ProcessOutcomeMatrixProps {
  /** Heading above the matrix. */
  title?: string;
  /** One-line takeaway shown under the matrix. */
  caption?: string;
  /** Label for the axis that varies decision quality. Default "Decision quality". */
  processAxisLabel?: string;
  /** Label for the axis that varies the result. Default "How it turned out". */
  outcomeAxisLabel?: string;
  /** Word for the "good" end of each axis. Default "Good". */
  goodLabel?: string;
  /** Word for the "bad" end of each axis. Default "Bad". */
  badLabel?: string;
  /** Good process + good outcome. Defaults to "Deserved success". */
  goodProcessGoodOutcome?: ProcessOutcomeCell;
  /** Good process + bad outcome. Defaults to "Bad break". */
  goodProcessBadOutcome?: ProcessOutcomeCell;
  /** Bad process + good outcome. Defaults to "Dumb luck". */
  badProcessGoodOutcome?: ProcessOutcomeCell;
  /** Bad process + bad outcome. Defaults to "Poetic justice". */
  badProcessBadOutcome?: ProcessOutcomeCell;
  className?: string;
}

type CellKey = 'gg' | 'gb' | 'bg' | 'bb';

interface PositionedCell {
  key: CellKey;
  cell: ProcessOutcomeCell;
  /** true if the process (decision quality) is good for this cell. */
  goodProcess: boolean;
  /** true if the outcome is good for this cell. */
  goodOutcome: boolean;
}

/**
 * A 2×2 matrix teaching "resulting" — the trap of judging a decision by its
 * outcome instead of its quality. One axis is **decision quality** (good vs bad
 * process), the other is **how it turned out** (good vs bad outcome), giving the
 * four classic quadrants: a good process that pays off (*Deserved success*), a
 * good process that loses anyway (*Bad break*), a reckless call that happens to
 * win (*Dumb luck*), and a reckless call that deservedly blows up (*Poetic
 * justice*). The two diagonals where process and outcome agree are easy to read;
 * the two where they disagree are exactly where resulting fools people. Each
 * quadrant is a keyboard-accessible button; selecting one reveals its note and
 * example in a live region below. Fully locale-agnostic (every string is a prop)
 * and SSR-safe with a deterministic initial render. No animation to gate on
 * `prefers-reduced-motion` — selection state changes instantly.
 */
export function ProcessOutcomeMatrix({
  title = 'Judge the process, not the outcome',
  caption =
    'A good decision can lose and a reckless one can win — that is just variance. Over many bets only the quality of your process survives, so grade the decision you made with what you knew, not the result the dice rolled.',
  processAxisLabel = 'Decision quality',
  outcomeAxisLabel = 'How it turned out',
  goodLabel = 'Good',
  badLabel = 'Bad',
  goodProcessGoodOutcome = {
    label: 'Deserved success',
    note: 'A sound, well-reasoned decision that paid off. The process and the result agree, so the win is genuine evidence the process works — but only weak evidence on its own, because one good outcome can still be luck. Keep doing this, and keep checking it was the process, not the dice.',
    example:
      'You buy a broad, low-cost index fund after weighing your goals, horizon and costs; over a decade it compounds nicely. The plan was right and it worked.',
  },
  goodProcessBadOutcome = {
    label: 'Bad break',
    note: 'A good decision that lost anyway — the hardest cell to accept. Resulting tempts you to call the process "wrong" and abandon it after one bad draw. Do not. Over many repetitions a sound process still wins; punishing yourself for an unlucky result trains the wrong reflex.',
    example:
      'You diversify sensibly and one well-researched holding still gets hit by an unforeseeable shock. The decision was right for the information you had; the outcome just went against you.',
  },
  badProcessGoodOutcome = {
    label: 'Dumb luck',
    note: 'A reckless decision that happened to win — the most dangerous cell, because the reward teaches you the bad habit. Self-attribution turns luck into "skill", you size up, and the next roll of the dice eventually collects. A good result does not validate a bad process.',
    example:
      'You bet your savings on a single meme stock on a hunch and it triples. You "won", but the process — no thesis, no diversification, no plan — was reckless and will not survive repetition.',
  },
  badProcessBadOutcome = {
    label: 'Poetic justice',
    note: 'A reckless decision that deservedly blew up. The process and the result agree, which at least makes the lesson clear: fix the process. The risk here is the opposite of dumb luck — blaming "bad luck" when the decision was genuinely flawed.',
    example:
      'You chase a hot tip with no research and borrowed money, and it craters. Painful, but the loss is honest feedback that the process needs to change.',
  },
  className,
}: ProcessOutcomeMatrixProps) {
  const id = useId();
  const [selected, setSelected] = useState<CellKey | null>(null);

  // Layout order (reading top-left → bottom-right) with axis positions.
  // Outcome is the horizontal axis (Good left, Bad right);
  // decision quality is the vertical axis (Good top, Bad bottom).
  const cells: PositionedCell[] = [
    { key: 'gg', cell: goodProcessGoodOutcome, goodProcess: true, goodOutcome: true },
    { key: 'gb', cell: goodProcessBadOutcome, goodProcess: true, goodOutcome: false },
    { key: 'bg', cell: badProcessGoodOutcome, goodProcess: false, goodOutcome: true },
    { key: 'bb', cell: badProcessBadOutcome, goodProcess: false, goodOutcome: false },
  ];

  const active = selected ? cells.find((c) => c.key === selected) ?? null : null;
  const detailId = `${id}-detail`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Grid: a column header row for the outcome axis, then two rows for
          the decision-quality axis, with row labels down a left rail. */}
      <div className="mt-5">
        {/* Outcome axis caption */}
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">
          {outcomeAxisLabel}
        </p>

        <div className="mt-2 grid grid-cols-[auto_1fr_1fr] gap-2">
          {/* top-left empty corner */}
          <div aria-hidden="true" />
          {/* outcome column headers */}
          <div className="pb-1 text-center text-sm font-medium text-ink-700">
            {goodLabel}
          </div>
          <div className="pb-1 text-center text-sm font-medium text-ink-700">
            {badLabel}
          </div>

          {/* Row 1: good decision quality */}
          <RowLabel
            text={`${processAxisLabel}: ${goodLabel}`}
            shortText={goodLabel}
          />
          <Quadrant
            id={id}
            positioned={cells[0]}
            selected={selected === 'gg'}
            onSelect={setSelected}
            detailId={detailId}
            goodLabel={goodLabel}
            badLabel={badLabel}
            processAxisLabel={processAxisLabel}
            outcomeAxisLabel={outcomeAxisLabel}
          />
          <Quadrant
            id={id}
            positioned={cells[1]}
            selected={selected === 'gb'}
            onSelect={setSelected}
            detailId={detailId}
            goodLabel={goodLabel}
            badLabel={badLabel}
            processAxisLabel={processAxisLabel}
            outcomeAxisLabel={outcomeAxisLabel}
          />

          {/* Row 2: bad decision quality */}
          <RowLabel
            text={`${processAxisLabel}: ${badLabel}`}
            shortText={badLabel}
          />
          <Quadrant
            id={id}
            positioned={cells[2]}
            selected={selected === 'bg'}
            onSelect={setSelected}
            detailId={detailId}
            goodLabel={goodLabel}
            badLabel={badLabel}
            processAxisLabel={processAxisLabel}
            outcomeAxisLabel={outcomeAxisLabel}
          />
          <Quadrant
            id={id}
            positioned={cells[3]}
            selected={selected === 'bb'}
            onSelect={setSelected}
            detailId={detailId}
            goodLabel={goodLabel}
            badLabel={badLabel}
            processAxisLabel={processAxisLabel}
            outcomeAxisLabel={outcomeAxisLabel}
          />
        </div>
      </div>

      {/* Revealed detail for the selected quadrant. */}
      <div
        id={detailId}
        aria-live="polite"
        className="mt-4 min-h-[3.5rem] rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3 text-sm leading-relaxed"
      >
        {active ? (
          <div className="animate-fade-up">
            <p className="font-semibold text-brand-700">{active.cell.label}</p>
            <p className="mt-1 text-ink-700">{active.cell.note}</p>
            {active.cell.example ? (
              <p className="mt-2 text-ink-600">
                <span className="font-medium text-ink-700">e.g. </span>
                {active.cell.example}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-ink-500">
            Pick a quadrant to see what that mix of decision quality and outcome
            really means.
          </p>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

/** Left-rail label for a decision-quality row. */
function RowLabel({ text, shortText }: { text: string; shortText: string }) {
  return (
    <div className="flex w-14 items-center justify-center sm:w-20">
      <span
        className="text-center text-xs font-medium text-ink-700"
        aria-hidden="true"
      >
        {shortText}
      </span>
      <span className="sr-only">{text}</span>
    </div>
  );
}

interface QuadrantProps {
  id: string;
  positioned: PositionedCell;
  selected: boolean;
  onSelect: (key: CellKey) => void;
  detailId: string;
  goodLabel: string;
  badLabel: string;
  processAxisLabel: string;
  outcomeAxisLabel: string;
}

function Quadrant({
  positioned,
  selected,
  onSelect,
  detailId,
  goodLabel,
  badLabel,
  processAxisLabel,
  outcomeAxisLabel,
}: QuadrantProps) {
  const { key, cell, goodProcess, goodOutcome } = positioned;
  // Tint by outcome agreement: green when both align good, red when both align
  // bad, amber on the mismatched diagonals where resulting bites.
  const aligned = goodProcess === goodOutcome;
  const tone = aligned
    ? goodOutcome
      ? 'success'
      : 'danger'
    : 'mismatch';

  const toneClasses =
    tone === 'success'
      ? 'border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/8'
      : tone === 'danger'
        ? 'border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/8'
        : 'border-accent-500/40 bg-accent-500/8';

  const ariaLabel = `${cell.label}. ${processAxisLabel}: ${
    goodProcess ? goodLabel : badLabel
  }; ${outcomeAxisLabel}: ${goodOutcome ? goodLabel : badLabel}.`;

  return (
    <button
      type="button"
      onClick={() => onSelect(key)}
      aria-pressed={selected}
      aria-controls={detailId}
      aria-label={ariaLabel}
      className={cx(
        'flex min-h-[5rem] flex-col items-start justify-center rounded-card border px-3 py-3 text-left transition',
        toneClasses,
        selected
          ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface'
          : 'hover:shadow-soft',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      )}
    >
      <span className="text-sm font-semibold text-ink-900">{cell.label}</span>
      <span className="mt-0.5 text-xs text-ink-500">
        {processAxisLabel}: {goodProcess ? goodLabel : badLabel} ·{' '}
        {outcomeAxisLabel}: {goodOutcome ? goodLabel : badLabel}
      </span>
    </button>
  );
}

export default ProcessOutcomeMatrix;
