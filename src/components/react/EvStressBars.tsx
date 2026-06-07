import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvStressScenario {
  /** Scenario name, e.g. "2008 crash". */
  name: string;
  /** Portfolio P&L under this scenario as a fraction (negative = loss). */
  impact: number;
}

export interface EvStressBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** Scenarios to plot. Pass locale-translated names. */
  scenarios?: EvStressScenario[];
  /** Slider label for the equity-shock dial. */
  shockLabel?: string;
  /** Label for the worst-case readout. */
  worstLabel?: string;
  /** Caption under the chart. */
  caption?: string;
  className?: string;
}

const pct = (value: number, digits = 1): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value * 100);

/**
 * Horizontal bar chart of portfolio P&L across stress scenarios, plus a live
 * "what if equities fall X%" dial that adds a synthetic scenario whose loss
 * scales with the dial. Bars are coloured by severity; the worst scenario is
 * highlighted and reported in the readout. This turns an abstract stress test
 * into a tangible ranking of how much each tail event would hurt, and lets a
 * learner sweep the hypothetical shock to feel sensitivity.
 */
export function EvStressBars({
  title = 'How much would each scenario hurt?',
  scenarios = [
    { name: '1987 Black Monday', impact: -0.22 },
    { name: '2008 crisis', impact: -0.38 },
    { name: '2020 COVID crash', impact: -0.31 },
    { name: 'Rates +300bp', impact: -0.14 },
    { name: 'Liquidity freeze', impact: -0.26 },
  ],
  shockLabel = 'Hypothetical equity shock',
  worstLabel = 'Worst-case portfolio loss',
  caption = 'Each bar is what the book would lose if that scenario replayed today — a stress test ranks tail events instead of summarising them into one number. Drag the dial to inject your own equity shock and watch where it lands in the ranking. Reverse stress testing flips the question: instead of "how bad is 2008?", it asks "what shock would wipe out our capital?" and works backwards to find it.',
  className,
}: EvStressBarsProps) {
  const id = useId();
  const [shock, setShock] = useState(0.2);

  // Synthetic scenario: a portfolio with ~0.9 equity beta loses 0.9 * shock.
  const synthetic: EvStressScenario = {
    name: shockLabel,
    impact: -0.9 * shock,
  };
  const all = [...scenarios, synthetic];

  const worst = all.reduce((m, s) => (s.impact < m.impact ? s : m), all[0]);
  const minImpact = Math.min(...all.map((s) => s.impact), -0.05);

  const W = 540;
  const rowH = 34;
  const padL = 14;
  const padR = 14;
  const padT = 10;
  const labelW = 150;
  const barAreaW = W - padL - padR - labelW;
  const H = padT * 2 + all.length * rowH;

  const barLen = (impact: number) => (Math.abs(impact) / Math.abs(minImpact)) * barAreaW;

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
          {pct(worst.impact)}%
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. The worst scenario is ${worst.name} at ${pct(worst.impact)} percent.`}
      >
        {all.map((s, i) => {
          const yRow = padT + i * rowH;
          const isWorst = s === worst;
          const isSynthetic = s === synthetic;
          return (
            <g key={i}>
              <text
                x={padL}
                y={yRow + rowH / 2 + 4}
                fontSize={12}
                fill="var(--color-ink-700)"
              >
                {s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name}
              </text>
              <rect
                x={padL + labelW}
                y={yRow + 6}
                width={Math.max(2, barLen(s.impact))}
                height={rowH - 14}
                rx={3}
                fill={
                  isWorst
                    ? 'var(--color-accent-500)'
                    : isSynthetic
                      ? 'var(--color-brand-400)'
                      : 'var(--color-brand-500)'
                }
                opacity={isWorst ? 0.95 : 0.7}
                style={{ transition: 'width 200ms ease' }}
              />
              <text
                x={padL + labelW + Math.max(2, barLen(s.impact)) + 6}
                y={yRow + rowH / 2 + 4}
                fontSize={11}
                fontWeight={isWorst ? 700 : 400}
                fill={isWorst ? 'var(--color-accent-600)' : 'var(--color-ink-500)'}
              >
                {pct(s.impact)}%
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4">
        <label
          htmlFor={`${id}-shock`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{shockLabel}</span>
          <span className="font-mono text-ink-900">−{pct(shock, 0)}%</span>
        </label>
        <input
          id={`${id}-shock`}
          type="range"
          min={5}
          max={60}
          step={1}
          value={shock * 100}
          onChange={(e) => setShock(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{worstLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {pct(worst.impact)}% · {worst.name}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvStressBars;
