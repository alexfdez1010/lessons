import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CreditSpreadDecompProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the default-probability slider. */
  defaultProbLabel?: string;
  /** Label for the loss-given-default slider. */
  lgdLabel?: string;
  /** Label for the risk-premium slider. */
  riskPremiumLabel?: string;
  /** Legend/segment label for the risk-free base yield. */
  riskFreeLabel?: string;
  /** Legend/segment label for the expected-loss component of the spread. */
  expectedLossLabel?: string;
  /** Legend/segment label for the risk-premium component of the spread. */
  premiumSegmentLabel?: string;
  /** Readout label for the total risky yield. */
  riskyYieldLabel?: string;
  /** Readout label for the total credit spread. */
  spreadLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Risk-free base yield as a percent value. Defaults to `4`. */
  riskFree?: number;
  /** Initial annual default probability as a percent (0–20). Defaults to `2`. */
  defaultProb?: number;
  /** Initial loss given default as a percent (0–100). Defaults to `60`. */
  lgd?: number;
  /** Initial extra risk premium as a percent value. Defaults to `0.8`. */
  riskPremium?: number;
  className?: string;
}

const fmtPct = (value: number, digits = 2): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;

/**
 * A risky bond's yield, decomposed into a stacked bar. The yield a corporate
 * bond must offer is the risk-free rate PLUS a credit spread, and that spread
 * itself splits into two pieces: the expected loss (default probability × loss
 * given default), which merely compensates for average losses, and a risk
 * premium that pays holders to bear the *uncertainty* of those losses. Drag the
 * default probability, the loss-given-default and the risk premium; the stacked
 * bar re-segments and the spread/total-yield readouts update live. Expected loss
 * is computed internally (PD × LGD); no numbers are hardcoded. Locale-agnostic,
 * no LaTeX inside the island.
 */
export function CreditSpreadDecomp({
  title = 'Decomposing the credit spread',
  defaultProbLabel = 'Default probability (per year)',
  lgdLabel = 'Loss given default',
  riskPremiumLabel = 'Risk premium',
  riskFreeLabel = 'Risk-free yield',
  expectedLossLabel = 'Expected loss (PD × LGD)',
  premiumSegmentLabel = 'Risk premium',
  riskyYieldLabel = 'Risky bond yield',
  spreadLabel = 'Credit spread',
  caption = 'A corporate yield stacks the risk-free rate, the expected loss (default odds times loss severity), and a risk premium for bearing uncertainty. Only part of the spread is fair compensation for average losses — the rest pays you to hold the risk.',
  riskFree = 4,
  defaultProb = 2,
  lgd = 60,
  riskPremium = 0.8,
  className,
}: CreditSpreadDecompProps) {
  const id = useId();
  const [pd, setPd] = useState(defaultProb);
  const [lgdState, setLgdState] = useState(lgd);
  const [premium, setPremium] = useState(riskPremium);

  const expectedLoss = (pd / 100) * (lgdState / 100) * 100; // percent
  const spread = expectedLoss + premium;
  const riskyYield = riskFree + spread;

  const W = 520;
  const H = 150;
  const padX = 20;
  const barTop = 30;
  const barH = 54;
  const total = riskFree + expectedLoss + premium;
  const innerW = W - padX * 2;
  const wOf = (v: number) => (v / (total || 1)) * innerW;

  const segs = [
    { label: riskFreeLabel, value: riskFree, color: 'var(--color-ink-300)' },
    { label: expectedLossLabel, value: expectedLoss, color: 'var(--color-brand-500)' },
    { label: premiumSegmentLabel, value: premium, color: 'var(--color-accent-500)' },
  ];

  let cursor = padX;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-accent-500 px-3 py-1 text-sm font-medium text-white">
          {spreadLabel}: {fmtPct(spread)}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-ink-300" aria-hidden="true" />
          {riskFreeLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {expectedLossLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-accent-500" aria-hidden="true" />
          {premiumSegmentLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: a ${fmtPct(riskFree)} risk-free yield plus a ${fmtPct(
          spread,
        )} credit spread (of which ${fmtPct(expectedLoss)} is expected loss and ${fmtPct(
          premium,
        )} is risk premium) gives a ${fmtPct(riskyYield)} risky yield.`}
      >
        {segs.map((s, i) => {
          const w = wOf(s.value);
          const x0 = cursor;
          cursor += w;
          return (
            <g key={i}>
              <rect x={x0} y={barTop} width={Math.max(0, w)} height={barH} fill={s.color} rx={i === 0 ? 4 : 0} />
              {w > 36 && (
                <text
                  x={x0 + w / 2}
                  y={barTop + barH / 2 + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontFamily="var(--font-mono, monospace)"
                  fill="white"
                >
                  {fmtPct(s.value)}
                </text>
              )}
            </g>
          );
        })}
        {/* Total tick */}
        <text x={padX} y={barTop - 8} fontSize={11} fill="var(--color-ink-500)">
          {riskFreeLabel}
        </text>
        <text x={W - padX} y={barTop - 8} textAnchor="end" fontSize={11} fill="var(--color-ink-500)">
          {riskyYieldLabel}: {fmtPct(riskyYield)}
        </text>
      </svg>

      {/* Sliders */}
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-pd`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{defaultProbLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(pd, 1)}</span>
          </label>
          <input
            id={`${id}-pd`}
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={pd}
            onChange={(e) => setPd(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-lgd`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{lgdLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(lgdState, 0)}</span>
          </label>
          <input
            id={`${id}-lgd`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={lgdState}
            onChange={(e) => setLgdState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-prem`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{riskPremiumLabel}</span>
            <span className="font-mono text-ink-900">{fmtPct(premium, 1)}</span>
          </label>
          <input
            id={`${id}-prem`}
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={premium}
            onChange={(e) => setPremium(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{expectedLossLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{fmtPct(expectedLoss)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spreadLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{fmtPct(spread)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{riskyYieldLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{fmtPct(riskyYield)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CreditSpreadDecomp;
