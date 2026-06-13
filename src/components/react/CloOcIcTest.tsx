import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CloOcIcTestProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the defaults / par-erosion slider. */
  defaultsLabel?: string;
  /** Label for the (post-default) collateral-par readout. */
  collateralParLabel?: string;
  /** Label for the senior notes par readout. */
  seniorParLabel?: string;
  /** Label for the OC-ratio readout. */
  ocRatioLabel?: string;
  /** Label for the trigger readout. */
  triggerLabel?: string;
  /** Status text when the test passes. Defaults to `'OC test: PASS'`. */
  statusPassLabel?: string;
  /** Status text when the test fails. Defaults to `'OC test: FAIL'`. */
  statusFailLabel?: string;
  /** Flow label when cash reaches equity. Defaults to `'Cash → Equity distribution'`. */
  equityFlowLabel?: string;
  /** Flow label when cash is diverted to deleverage. Defaults to `'Cash → Pay down senior notes'`. */
  divertFlowLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** OC trigger as a percentage. Defaults to `128`. */
  triggerPct?: number;
  /** Starting collateral par (millions). Defaults to `500`. */
  collateralPar?: number;
  /** Par of notes senior to (and including) the tested tranche (millions). Defaults to `360`. */
  seniorPar?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value)}M`;

const pct = (value: number, suffix: string): string =>
  `${value.toFixed(1)}${suffix}`;

/** The CLO capital stack, top (most senior) to bottom (residual equity). */
const STACK: { label: string; senior: boolean }[] = [
  { label: 'AAA', senior: true },
  { label: 'AA', senior: true },
  { label: 'A', senior: false },
  { label: 'BBB', senior: false },
  { label: 'BB', senior: false },
  { label: 'Equity', senior: false },
];

/**
 * CLO over-collateralization (OC) coverage test. A CLO owns a pool of leveraged
 * loans (collateral par) and funds a stack of notes — AAA, AA, A, BBB, BB and
 * residual Equity at the bottom. The **senior OC ratio** is
 *
 *     OC ratio = collateral par / par of notes senior to (and including) the tested tranche
 *
 * Each test has a **trigger** (e.g. an AAA OC trigger of 128%). When defaults
 * erode collateral par and the OC ratio falls below the trigger, the test
 * **fails** and excess interest proceeds are **diverted** away from the equity
 * distribution to **pay down the senior notes** (force-deleverage) until the
 * test cures. This island lets the learner drive a defaults slider and watch the
 * OC gauge cross the trigger line while the cashflow arrow re-routes. The gauge
 * needle and the active arrow animate on change; respects
 * `prefers-reduced-motion` (jumps straight to the final state).
 */
export function CloOcIcTest({
  title = 'The CLO over-collateralization (OC) test',
  defaultsLabel = 'Defaulted collateral',
  collateralParLabel = 'Collateral par (after defaults)',
  seniorParLabel = 'Senior notes par (AAA + AA)',
  ocRatioLabel = 'Senior OC ratio',
  triggerLabel = 'OC trigger',
  statusPassLabel = 'OC test: PASS',
  statusFailLabel = 'OC test: FAIL',
  equityFlowLabel = 'Cash → Equity distribution',
  divertFlowLabel = 'Cash → Pay down senior notes',
  caption = "The OC test is the CLO's automatic circuit-breaker: when too many loans default, it stops paying the equity and force-deleverages the senior notes — a big reason CLO AAA tranches have essentially never lost principal.",
  percentSuffix = '%',
  currencyPrefix = '$',
  triggerPct = 128,
  collateralPar = 500,
  seniorPar = 360,
  className,
}: CloOcIcTestProps) {
  const id = useId();

  // Defaulted share of the *original* collateral par, 0..25%.
  const [defaultPct, setDefaultPct] = useState(0);
  const [progress, setProgress] = useState(1); // 0 → 1 (needle/arrow ease-in)
  const rafRef = useRef<number | null>(null);
  const prevRatioRef = useRef<number | null>(null);

  // Defaults wipe out collateral par; senior par is unchanged until a paydown.
  const erodedPar = collateralPar * (1 - defaultPct / 100);
  const ocRatio = (erodedPar / seniorPar) * 100; // percent
  const passes = ocRatio >= triggerPct;

  // Animate the needle between the previous and current OC ratio.
  const fromRatio = prevRatioRef.current ?? ocRatio;
  const shownRatio = fromRatio + (ocRatio - fromRatio) * progress;

  useEffect(() => {
    if (prefersReducedMotion()) {
      prevRatioRef.current = ocRatio;
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 500;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      } else {
        prevRatioRef.current = ocRatio;
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPct]);

  // --- Gauge geometry -------------------------------------------------------
  const W = 520;
  const H = 360;
  // Gauge spans a percent window centred so the trigger sits mid-bar.
  const gaugeMin = Math.min(100, triggerPct - 30);
  const gaugeMax = Math.max(triggerPct + 30, 150);
  const gx = 28;
  const gw = W - gx * 2;
  const gy = 40;
  const gh = 26;
  const ratioToX = (r: number) =>
    gx + ((Math.max(gaugeMin, Math.min(gaugeMax, r)) - gaugeMin) / (gaugeMax - gaugeMin)) * gw;
  const triggerX = ratioToX(triggerPct);
  const needleX = ratioToX(shownRatio);
  const fillW = Math.max(0, needleX - gx);

  // --- Cashflow diagram geometry --------------------------------------------
  const flowY = 150;
  const sourceX = W / 2;
  const sourceR = 34;
  const equityX = gx + 70;
  const divertX = W - gx - 70;
  const targetY = flowY + 86;
  const boxW = 156;
  const boxH = 52;

  // --- Mini capital stack ---------------------------------------------------
  const stackX = W - gx - 110;
  const stackTop = flowY + 150;
  const rowH = 22;

  const ariaLabel =
    `${title}: with ${pct(defaultPct, percentSuffix)} of collateral defaulted, collateral par is ` +
    `${money(currencyPrefix, erodedPar)} against ${money(currencyPrefix, seniorPar)} of senior notes, ` +
    `for a senior OC ratio of ${pct(ocRatio, percentSuffix)} versus a ${pct(triggerPct, percentSuffix)} trigger. ` +
    `The test ${passes ? 'passes' : 'fails'}, so excess cash is ` +
    `${passes ? 'paid to the equity distribution' : 'diverted to pay down the senior notes'}.`;

  const accentColor = passes ? 'var(--color-brand-600)' : 'var(--color-accent-600)';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-semibold text-white',
            passes ? 'bg-brand-600' : 'bg-accent-600',
          )}
        >
          {passes ? statusPassLabel : statusFailLabel}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-pill bg-brand-500" aria-hidden="true" />
          {equityFlowLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-pill bg-accent-500" aria-hidden="true" />
          {divertFlowLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <marker
            id={`${id}-arrow-on`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={accentColor} />
          </marker>
          <marker
            id={`${id}-arrow-off`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-ink-300)" />
          </marker>
        </defs>

        {/* --- OC ratio gauge --- */}
        <text x={gx} y={gy - 8} fill="var(--color-ink-500)" fontSize={11}>
          {ocRatioLabel}
        </text>
        <rect
          x={gx}
          y={gy}
          width={gw}
          height={gh}
          rx={6}
          fill="var(--color-surface-sunken)"
          stroke="var(--color-ink-200)"
        />
        {/* fill up to the needle */}
        <rect
          x={gx}
          y={gy}
          width={fillW}
          height={gh}
          rx={6}
          fill={passes ? 'var(--color-brand-500)' : 'var(--color-accent-500)'}
          opacity={0.4}
        />
        {/* trigger line */}
        <line
          x1={triggerX}
          y1={gy - 6}
          x2={triggerX}
          y2={gy + gh + 6}
          stroke="var(--color-ink-700)"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
        <text
          x={triggerX}
          y={gy + gh + 20}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-600)"
        >
          {`${triggerLabel} ${pct(triggerPct, percentSuffix)}`}
        </text>
        {/* needle */}
        <line
          x1={needleX}
          y1={gy - 6}
          x2={needleX}
          y2={gy + gh + 6}
          stroke={accentColor}
          strokeWidth={3}
        />
        <circle cx={needleX} cy={gy - 6} r={4} fill={accentColor} />
        <text
          x={needleX}
          y={gy - 14}
          textAnchor="middle"
          fontSize={11}
          fontFamily="var(--font-mono)"
          fontWeight={700}
          fill={accentColor}
        >
          {pct(shownRatio, percentSuffix)}
        </text>

        {/* --- Cashflow diagram --- */}
        {/* source node: interest proceeds */}
        <circle
          cx={sourceX}
          cy={flowY}
          r={sourceR}
          fill="var(--color-surface-sunken)"
          stroke="var(--color-ink-300)"
        />
        <text
          x={sourceX}
          y={flowY - 2}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-700)"
        >
          Interest
        </text>
        <text
          x={sourceX}
          y={flowY + 11}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-700)"
        >
          proceeds
        </text>

        {/* arrow → equity (active only on PASS) */}
        <line
          x1={sourceX - sourceR}
          y1={flowY + 8}
          x2={equityX + boxW / 2}
          y2={targetY - boxH / 2 - 4}
          stroke={passes ? 'var(--color-brand-600)' : 'var(--color-ink-300)'}
          strokeWidth={passes ? 3 : 1.5}
          strokeDasharray={passes ? undefined : '4 4'}
          markerEnd={`url(#${id}-arrow-${passes ? 'on' : 'off'})`}
        />
        <rect
          x={equityX - boxW / 2}
          y={targetY - boxH / 2}
          width={boxW}
          height={boxH}
          rx={8}
          fill="var(--color-surface)"
          stroke={passes ? 'var(--color-brand-500)' : 'var(--color-ink-200)'}
          strokeWidth={passes ? 2 : 1}
        />
        <text
          x={equityX}
          y={targetY + 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={passes ? 600 : 400}
          fill={passes ? 'var(--color-brand-700)' : 'var(--color-ink-400)'}
        >
          {equityFlowLabel}
        </text>

        {/* arrow → pay down senior (active only on FAIL) */}
        <line
          x1={sourceX + sourceR}
          y1={flowY + 8}
          x2={divertX - boxW / 2}
          y2={targetY - boxH / 2 - 4}
          stroke={!passes ? 'var(--color-accent-600)' : 'var(--color-ink-300)'}
          strokeWidth={!passes ? 3 : 1.5}
          strokeDasharray={!passes ? undefined : '4 4'}
          markerEnd={`url(#${id}-arrow-${!passes ? 'on' : 'off'})`}
        />
        <rect
          x={divertX - boxW / 2}
          y={targetY - boxH / 2}
          width={boxW}
          height={boxH}
          rx={8}
          fill="var(--color-surface)"
          stroke={!passes ? 'var(--color-accent-500)' : 'var(--color-ink-200)'}
          strokeWidth={!passes ? 2 : 1}
        />
        <text
          x={divertX}
          y={targetY + 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={!passes ? 600 : 400}
          fill={!passes ? 'var(--color-accent-600)' : 'var(--color-ink-400)'}
        >
          {divertFlowLabel}
        </text>

        {/* --- Mini capital stack --- */}
        <text
          x={stackX + 55}
          y={stackTop - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          Capital stack
        </text>
        {STACK.map((tranche, i) => {
          const y = stackTop + i * rowH;
          const isEquity = tranche.label === 'Equity';
          return (
            <g key={tranche.label}>
              <rect
                x={stackX}
                y={y}
                width={110}
                height={rowH - 3}
                rx={3}
                fill={
                  tranche.senior
                    ? 'var(--color-brand-100)'
                    : isEquity
                      ? 'var(--color-accent-300)'
                      : 'var(--color-surface-sunken)'
                }
                stroke="var(--color-ink-200)"
              />
              <text
                x={stackX + 8}
                y={y + rowH / 2 + 1}
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--color-ink-800)"
              >
                {tranche.label}
              </text>
              {isEquity && (
                <text
                  x={stackX + 102}
                  y={y + rowH / 2 + 1}
                  textAnchor="end"
                  fontSize={9}
                  fill={passes ? 'var(--color-brand-700)' : 'var(--color-accent-600)'}
                >
                  {passes ? '✓ paid' : '✕ skipped'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Control */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-defaults`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{defaultsLabel}</span>
          <span className="font-mono text-ink-900">
            {pct(defaultPct, percentSuffix)}
          </span>
        </label>
        <input
          id={`${id}-defaults`}
          type="range"
          min={0}
          max={25}
          step={0.5}
          value={defaultPct}
          onChange={(e) => setDefaultPct(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{collateralParLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, erodedPar)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{seniorParLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, seniorPar)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ocRatioLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              passes ? 'text-brand-700' : 'text-accent-600',
            )}
          >
            {pct(ocRatio, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{triggerLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(triggerPct, percentSuffix)}
          </dd>
        </div>
      </dl>

      {/* Status + flow destination */}
      <p
        className={cx(
          'mt-3 text-sm font-medium',
          passes ? 'text-brand-700' : 'text-accent-600',
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {passes ? statusPassLabel : statusFailLabel} — {passes ? equityFlowLabel : divertFlowLabel}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CloOcIcTest;
