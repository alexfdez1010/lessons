import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single model tile: which discipline it belongs to, its name, and a one-line gist. */
export interface MentalModelTile {
  /** Discipline / field the model comes from (used to group + tint tiles). */
  discipline: string;
  /** Short model name shown on the tile. */
  name: string;
  /** One-sentence intuition shown in the detail panel when selected. */
  gist: string;
}

export interface MentalModelLatticeProps {
  /** Heading above the lattice. */
  title?: string;
  /** Pill label next to the title (e.g. number of disciplines). Defaults to a model count. */
  disciplineLabel?: string;
  /** The set of models. Grouped by `discipline` in first-seen order. Has a sensible default. */
  models?: MentalModelTile[];
  /** Prompt shown in the detail panel before anything is selected. */
  emptyHint?: string;
  /** Small lead-in sentence under the title. */
  intro?: string;
  /** One-line takeaway shown at the foot of the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_MODELS: MentalModelTile[] = [
  {
    discipline: 'Economics',
    name: 'Opportunity cost',
    gist: "The real cost of a choice is the best thing you gave up to make it.",
  },
  {
    discipline: 'Economics',
    name: 'Incentives',
    gist: 'People respond to rewards — follow the incentives to predict behaviour.',
  },
  {
    discipline: 'Economics',
    name: 'Supply & demand',
    gist: 'Price moves to where what people want meets what is available.',
  },
  {
    discipline: 'Economics',
    name: 'Comparative advantage',
    gist: 'Specialise in what you give up least to do, then trade for the rest.',
  },
  {
    discipline: 'Risk & probability',
    name: 'Expected value',
    gist: 'Weight each outcome by its odds — then decide on the long-run average.',
  },
  {
    discipline: 'Risk & probability',
    name: 'Margin of safety',
    gist: "Build in a buffer so that being wrong doesn't ruin you.",
  },
  {
    discipline: 'Risk & probability',
    name: 'Asymmetry / convexity',
    gist: 'Love bets with small possible losses and huge possible gains.',
  },
  {
    discipline: 'Risk & probability',
    name: 'Never risk ruin',
    gist: 'Avoid any bet that can wipe you out, however good the odds look.',
  },
  {
    discipline: 'Markets & behaviour',
    name: 'Compounding',
    gist: 'Small gains feeding on themselves explode over enough time.',
  },
  {
    discipline: 'Markets & behaviour',
    name: 'Mr. Market',
    gist: 'Price is a moody daily quote, not the truth about value.',
  },
  {
    discipline: 'Markets & behaviour',
    name: 'Diversification',
    gist: "Don't put all your eggs in one basket.",
  },
  {
    discipline: 'Markets & behaviour',
    name: 'Reflexivity',
    gist: 'Beliefs move prices and prices move beliefs — feedback loops.',
  },
  {
    discipline: 'Behavioural traps',
    name: 'Loss aversion',
    gist: 'Losses hurt about twice as much as equal gains feel good.',
  },
  {
    discipline: 'Behavioural traps',
    name: 'Anchoring',
    gist: 'The first number you see drags your estimate toward it.',
  },
  {
    discipline: 'Behavioural traps',
    name: 'Confirmation bias',
    gist: "We hunt for evidence we're already right and ignore the rest.",
  },
  {
    discipline: 'Behavioural traps',
    name: 'Herd / FOMO',
    gist: 'Copying the crowd feels safe and often is not.',
  },
];

/** Cycle of token-driven tints, one per discipline group (no hardcoded hex). */
const TINTS = [
  {
    chip: 'bg-brand-50 text-brand-700',
    tile: 'border-brand-200/70 bg-brand-50/40 text-ink-700 hover:border-brand-400',
    active: 'border-brand-500 bg-brand-600 text-white shadow-soft',
    dot: 'bg-brand-500',
    swatch: 'var(--color-brand-500)',
  },
  {
    chip: 'bg-accent-300/30 text-accent-600',
    tile: 'border-accent-400/50 bg-accent-300/15 text-ink-700 hover:border-accent-500',
    active: 'border-accent-500 bg-accent-600 text-white shadow-soft',
    dot: 'bg-accent-500',
    swatch: 'var(--color-accent-500)',
  },
  {
    chip: 'bg-ink-100 text-ink-700',
    tile: 'border-ink-200 bg-surface-sunken/40 text-ink-700 hover:border-ink-400',
    active: 'border-ink-700 bg-ink-800 text-white shadow-soft',
    dot: 'bg-ink-500',
    swatch: 'var(--color-ink-500)',
  },
  {
    chip: 'bg-brand-100 text-brand-800',
    tile: 'border-brand-300/60 bg-brand-100/30 text-ink-700 hover:border-brand-500',
    active: 'border-brand-700 bg-brand-700 text-white shadow-soft',
    dot: 'bg-brand-700',
    swatch: 'var(--color-brand-700)',
  },
] as const;

/**
 * Interactive "latticework of mental models" explorer (Munger's idea: good
 * thinking comes from a *grid* of models pulled from many disciplines, not one
 * favourite tool). Models are laid out as a grid of clickable tiles grouped and
 * tinted by discipline; selecting a tile highlights it and fills a detail panel
 * with the model's name, discipline and one-line gist. Tiles are real buttons
 * (keyboard operable, `aria-pressed`), the panel is `aria-live`, and the active
 * tile's lift transition is gated on `prefers-reduced-motion`.
 */
export function MentalModelLattice({
  title = 'A latticework of mental models',
  disciplineLabel,
  models = DEFAULT_MODELS,
  emptyHint = 'Pick any tile to see what the model says — and notice they come from different disciplines.',
  intro = 'Good thinking is a lattice of models from many fields, not one favourite tool. Click around.',
  caption = 'No single model explains everything. Stack them across disciplines and you can attack a problem from several angles at once.',
  className,
}: MentalModelLatticeProps) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);

  // Group models by discipline, preserving first-seen order of both groups and items.
  const disciplineOrder: string[] = [];
  const groups = new Map<string, Array<{ tile: MentalModelTile; index: number }>>();
  models.forEach((tile, index) => {
    if (!groups.has(tile.discipline)) {
      groups.set(tile.discipline, []);
      disciplineOrder.push(tile.discipline);
    }
    groups.get(tile.discipline)!.push({ tile, index });
  });

  const tintFor = (discipline: string) =>
    TINTS[disciplineOrder.indexOf(discipline) % TINTS.length];

  const reduce = prefersReducedMotion();
  const active = selected !== null ? models[selected] : null;
  const pill =
    disciplineLabel ??
    `${disciplineOrder.length} disciplines · ${models.length} models`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {pill}
        </span>
      </figcaption>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{intro}</p>

      {/* The lattice: one labelled column of tiles per discipline. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {disciplineOrder.map((discipline) => {
          const tint = tintFor(discipline);
          const items = groups.get(discipline) ?? [];
          return (
            <div key={discipline} className="flex flex-col gap-2">
              <span
                className={cx(
                  'inline-flex items-center gap-2 self-start rounded-pill px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
                  tint.chip,
                )}
              >
                <span
                  className={cx('h-2 w-2 rounded-pill', tint.dot)}
                  aria-hidden="true"
                />
                {discipline}
              </span>
              <ul className="flex flex-col gap-2">
                {items.map(({ tile, index }) => {
                  const isActive = selected === index;
                  return (
                    <li key={`${discipline}-${tile.name}`}>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() =>
                          setSelected((prev) => (prev === index ? null : index))
                        }
                        className={cx(
                          'w-full rounded-card border px-3 py-2 text-left text-sm font-medium',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                          !reduce && 'transition',
                          isActive ? tint.active : tint.tile,
                        )}
                      >
                        {tile.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Detail panel for the selected model. */}
      <div
        id={`${id}-detail`}
        aria-live="polite"
        className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3"
      >
        {active ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500"
              >
                <span
                  className="h-2 w-2 rounded-pill"
                  style={{ backgroundColor: tintFor(active.discipline).swatch }}
                  aria-hidden="true"
                />
                {active.discipline}
              </span>
              <span className="text-base font-semibold text-ink-900">
                {active.name}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              {active.gist}
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-ink-500">{emptyHint}</p>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MentalModelLattice;
