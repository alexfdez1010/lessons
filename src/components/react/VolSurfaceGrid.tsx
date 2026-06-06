import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type PresetKind = 'skew' | 'smile' | 'flat';
type TermKind = 'upward' | 'flat' | 'inverted';

export interface VolSurfaceGridProps {
  /** Heading above the grid. */
  title?: string;
  /** Initial base (at-the-money) implied vol as a fraction (e.g. `0.22` = 22%). Defaults to `0.22`. */
  baseVol?: number;
  /** Which strike-shape preset to start on. Defaults to `'skew'`. */
  preset?: PresetKind;
  /** Which term-structure shape to start on. Defaults to `'upward'`. */
  term?: TermKind;
  /** Preset button label — equity-index skew (downside puts richer). */
  skewLabel?: string;
  /** Preset button label — symmetric smile (both wings up). */
  smileLabel?: string;
  /** Preset button label — flat surface. */
  flatLabel?: string;
  /** Group label for the term-structure toggle. */
  termStructureLabel?: string;
  /** Term-structure toggle label — upward-sloping (contango). */
  termUpwardLabel?: string;
  /** Term-structure toggle label — flat term structure. */
  termFlatLabel?: string;
  /** Term-structure toggle label — inverted / downward (stress). */
  termInvertedLabel?: string;
  /** Axis label for the columns (strike / moneyness). */
  strikeAxisLabel?: string;
  /** Axis label for the rows (maturity). */
  maturityAxisLabel?: string;
  /** Short label for implied vol used in readouts and the legend. */
  ivLabel?: string;
  /** Readout label for the selected cell's moneyness / strike. */
  moneynessReadoutLabel?: string;
  /** Readout label for the selected cell's maturity. */
  maturityReadoutLabel?: string;
  /** Suffix appended to a maturity in months (e.g. "3 mo"). */
  monthsSuffix?: string;
  /** Legend label for the low end of the colour scale. */
  lowLabel?: string;
  /** Legend label for the high end of the colour scale. */
  highLabel?: string;
  /** One-line takeaway shown under the grid. */
  caption?: string;
  className?: string;
}

interface Shape {
  /** Tilt: positive lifts downside (low-moneyness) vol — the equity smirk. */
  skew: number;
  /** Bow: positive lifts both wings — the smile. */
  curvature: number;
}

const PRESETS: Record<PresetKind, Shape> = {
  skew: { skew: 0.16, curvature: 0.05 },
  smile: { skew: 0.0, curvature: 0.32 },
  flat: { skew: 0, curvature: 0 },
};

// term-slope multiplier applied to the maturity term f(T).
const TERM_SLOPE: Record<TermKind, number> = {
  upward: 0.07,
  flat: 0,
  inverted: -0.07,
};

// Columns: moneyness K/S from deep OTM puts (left) to OTM calls (right).
const MONEYNESS = [0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2];
// Rows: maturities in months.
const MATURITIES = [1, 3, 6, 12, 24];

// IV is clamped to a sane quoting range.
const IV_MIN = 0.08;
const IV_MAX = 0.6;

const pct = (value: number, digits = 0): string =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

// term factor f(T): roughly diminishing with the square root of maturity, so
// the front of the curve moves more per added month than the back.
const termFactor = (months: number): number => {
  const years = months / 12;
  return Math.sqrt(years) - Math.sqrt(1); // anchored so the 12-mo point is ~base
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Interactive implied-volatility surface. Black–Scholes assumes one constant
 * volatility, yet real markets quote a *different* implied vol at every (strike,
 * maturity) pair — a two-dimensional surface. This island renders that surface
 * as a heatmap grid: rows are maturities (1–24 months), columns are strike
 * moneyness K/S (deep OTM puts on the left → OTM calls on the right), and each
 * cell is coloured by its implied vol with the number printed inside.
 *
 * The model behind every cell is
 *   iv(m, T) = base + skew·(−ln m) + curvature·(ln m)² + termSlope·f(T),
 * clamped to a sane quoting range. The `skew` term lifts low-moneyness (put)
 * vol into the equity smirk; `curvature` bows both wings up into a smile;
 * `termSlope·f(T)` tilts the whole curve across maturities into an upward,
 * flat, or inverted term structure. Strike-shape presets (Equity skew / Smile /
 * Flat) and a separate term-structure toggle reshape the surface; clicking any
 * cell reads out its moneyness, maturity, and implied vol. Cells are buttons, so
 * the whole grid is keyboard operable, and the colour mapping carries no motion
 * (nothing essential animates).
 */
export function VolSurfaceGrid({
  title = 'The volatility surface',
  baseVol = 0.22,
  preset = 'skew',
  term = 'upward',
  skewLabel = 'Equity skew',
  smileLabel = 'Smile',
  flatLabel = 'Flat',
  termStructureLabel = 'Term structure',
  termUpwardLabel = 'Upward',
  termFlatLabel = 'Flat',
  termInvertedLabel = 'Inverted',
  strikeAxisLabel = 'Strike moneyness (K / S)',
  maturityAxisLabel = 'Maturity',
  ivLabel = 'Implied vol',
  moneynessReadoutLabel = 'Moneyness (K / S)',
  maturityReadoutLabel = 'Maturity',
  monthsSuffix = 'mo',
  lowLabel = 'Lower vol',
  highLabel = 'Higher vol',
  caption = 'Implied vol is not one number — it is a surface. Read across a row to see the skew/smile (strike); read down a column to see the term structure (maturity). Equity indices lean their puts up into a left-side skew, while a calm market slopes vol up with maturity and a panicked one inverts it.',
  className,
}: VolSurfaceGridProps) {
  const id = useId();

  const [shapeKind, setShapeKind] = useState<PresetKind>(preset);
  const [termKind, setTermKind] = useState<TermKind>(term);
  // Selected cell as [maturityIndex, moneynessIndex]; default to ATM @ 3mo-ish.
  const [selected, setSelected] = useState<[number, number]>([1, 3]);

  const base = clamp(baseVol, IV_MIN, IV_MAX);
  const shape = PRESETS[shapeKind];
  const termSlope = TERM_SLOPE[termKind];

  const iv = (moneyness: number, months: number): number => {
    const lm = Math.log(moneyness);
    const raw =
      base + shape.skew * -lm + shape.curvature * lm * lm + termSlope * termFactor(months);
    return clamp(raw, IV_MIN, IV_MAX);
  };

  // Build the grid of IV values.
  const grid = MATURITIES.map((months) => MONEYNESS.map((m) => iv(m, months)));

  // Colour scale: map IV in [IV_MIN, IV_MAX] onto a brand→accent ramp.
  // brand (cooler/lower) → accent (warmer/higher). Returns inline CSS color.
  const cellColor = (value: number): string => {
    const tRaw = (value - IV_MIN) / (IV_MAX - IV_MIN);
    const t = clamp(tRaw, 0, 1);
    // Blend two design-token colours via color-mix so we stay token-driven.
    const lowPct = Math.round((1 - t) * 100);
    return `color-mix(in oklab, var(--color-brand-500) ${lowPct}%, var(--color-accent-500))`;
  };

  // Text stays readable: dark ink on lighter cells, white on saturated cells.
  const cellTextColor = (value: number): string => {
    const t = clamp((value - IV_MIN) / (IV_MAX - IV_MIN), 0, 1);
    return t > 0.45 ? 'var(--color-white)' : 'var(--color-ink-900)';
  };

  const [selRow, selCol] = selected;
  const selMaturity = MATURITIES[selRow];
  const selMoneyness = MONEYNESS[selCol];
  const selIv = grid[selRow][selCol];

  const shapeButtons: { kind: PresetKind; label: string }[] = [
    { kind: 'skew', label: skewLabel },
    { kind: 'smile', label: smileLabel },
    { kind: 'flat', label: flatLabel },
  ];

  const termButtons: { kind: TermKind; label: string }[] = [
    { kind: 'upward', label: termUpwardLabel },
    { kind: 'flat', label: termFlatLabel },
    { kind: 'inverted', label: termInvertedLabel },
  ];

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
          {ivLabel}: {pct(selIv, 1)}
        </span>
      </figcaption>

      {/* Strike-shape presets */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={strikeAxisLabel}>
        {shapeButtons.map((b) => {
          const active = b.kind === shapeKind;
          return (
            <button
              key={b.kind}
              type="button"
              aria-pressed={active}
              onClick={() => setShapeKind(b.kind)}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-200 bg-surface text-ink-700 hover:border-brand-400',
              )}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Term-structure toggle */}
      <div
        className="mt-2 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={termStructureLabel}
      >
        <span className="text-sm font-medium text-ink-500">{termStructureLabel}:</span>
        {termButtons.map((b) => {
          const active = b.kind === termKind;
          return (
            <button
              key={b.kind}
              type="button"
              aria-pressed={active}
              onClick={() => setTermKind(b.kind)}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-accent-500 text-white'
                  : 'border border-ink-200 bg-surface text-ink-700 hover:border-accent-400',
              )}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Heatmap grid */}
      <div className="mt-4 overflow-x-auto">
        <table
          className="w-full border-separate border-spacing-1 text-center"
          aria-label={`${title}. ${strikeAxisLabel} across columns, ${maturityAxisLabel} down rows.`}
        >
          <caption className="sr-only">
            {ivLabel} by {strikeAxisLabel} and {maturityAxisLabel}.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="p-1 text-xs font-medium text-ink-500">
                <span className="block">{maturityAxisLabel}</span>
                <span className="block text-ink-400">{strikeAxisLabel}</span>
              </th>
              {MONEYNESS.map((m) => (
                <th
                  key={`col-${m}`}
                  scope="col"
                  className="p-1 text-xs font-medium text-ink-600"
                >
                  {m.toFixed(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATURITIES.map((months, r) => (
              <tr key={`row-${months}`}>
                <th
                  scope="row"
                  className="whitespace-nowrap p-1 text-xs font-medium text-ink-600"
                >
                  {months} {monthsSuffix}
                </th>
                {MONEYNESS.map((m, c) => {
                  const value = grid[r][c];
                  const isSel = r === selRow && c === selCol;
                  return (
                    <td key={`cell-${months}-${m}`} className="p-0">
                      <button
                        type="button"
                        onClick={() => setSelected([r, c])}
                        aria-pressed={isSel}
                        aria-label={`${moneynessReadoutLabel} ${m.toFixed(2)}, ${maturityReadoutLabel} ${months} ${monthsSuffix}, ${ivLabel} ${pct(
                          value,
                          1,
                        )}`}
                        className={cx(
                          'flex h-10 w-full min-w-12 items-center justify-center rounded-card font-mono text-xs font-semibold tabular-nums transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700',
                          isSel
                            ? 'ring-2 ring-ink-900 ring-offset-1 ring-offset-surface'
                            : 'hover:ring-2 hover:ring-ink-300',
                        )}
                        style={{
                          backgroundColor: cellColor(value),
                          color: cellTextColor(value),
                        }}
                      >
                        {pct(value, 0)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Colour-scale legend */}
      <div className="mt-3 flex items-center gap-3 text-xs text-ink-500">
        <span>{lowLabel}</span>
        <span
          className="h-3 flex-1 rounded-pill"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(to right, var(--color-brand-500), var(--color-accent-500))',
          }}
        />
        <span>{highLabel}</span>
      </div>

      {/* Readout */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{moneynessReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {selMoneyness.toFixed(2)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{maturityReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-700">
            {selMaturity} {monthsSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ivLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{pct(selIv, 1)}</dd>
        </div>
      </dl>

      <p id={`${id}-cap`} className="mt-3 text-sm leading-relaxed text-ink-600">
        {caption}
      </p>
    </figure>
  );
}

export default VolSurfaceGrid;
