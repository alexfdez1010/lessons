import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SandwichAttackProps {
  /** Heading above the visualization. */
  title?: string;
  /** Label for the victim-trade-size slider (how much Y the victim spends). */
  victimSizeLabel?: string;
  /** Label for the attacker front-run-size slider (how much Y the attacker spends first). */
  attackerSizeLabel?: string;
  /** Step heading: attacker front-runs the victim's pending swap. Defaults to `'Front-run'`. */
  frontRunLabel?: string;
  /** Step heading: the victim's swap executes at the worsened price. Defaults to `'Victim swap'`. */
  victimLabel?: string;
  /** Step heading: attacker sells back the X they bought. Defaults to `'Back-run'`. */
  backRunLabel?: string;
  /** Short description under the Front-run step. */
  frontRunDesc?: string;
  /** Short description under the Victim step. */
  victimDesc?: string;
  /** Short description under the Back-run step. */
  backRunDesc?: string;
  /** Readout label: victim output with no attacker present. Defaults to `'Victim gets (no attack)'`. */
  cleanOutputLabel?: string;
  /** Readout label: victim output when sandwiched. Defaults to `'Victim gets (sandwiched)'`. */
  sandwichedOutputLabel?: string;
  /** Readout label: how much the victim lost, in X token terms. Defaults to `'Victim loses'`. */
  victimLossLabel?: string;
  /** Readout label: the attacker's net profit, in Y token terms. Defaults to `'Attacker profit'`. */
  attackerProfitLabel?: string;
  /** Label for the per-step spot-price markers / axis. Defaults to `'Spot price'`. */
  priceLabel?: string;
  /** Caption for the price-track figure, e.g. "Price spikes, then settles". */
  priceTrackLabel?: string;
  /** Tiny labels under each price marker: pool start state. Defaults to `'Start'`. */
  startStateLabel?: string;
  /** Tiny labels under each price marker: after front-run. Defaults to `'After front-run'`. */
  afterFrontRunLabel?: string;
  /** Tiny labels under each price marker: after victim swap. Defaults to `'After victim'`. */
  afterVictimLabel?: string;
  /** Tiny labels under each price marker: after back-run. Defaults to `'After back-run'`. */
  afterBackRunLabel?: string;
  /** Fee charged per swap, as a fraction (e.g. 0.003 = 0.30%). Defaults to `0` (ignored for clarity). */
  feeRate?: number;
  /** Readout label for the fee total the attacker pays, shown only when feeRate > 0. */
  feeLabel?: string;
  /** One-line takeaway shown under everything. */
  caption?: string;
  /** Currency symbol prefixed to Y-token money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Ticker for the X token (the asset being bought). Defaults to `'ETH'`. */
  baseSymbol?: string;
  /** Ticker for the Y token (the currency paid). Defaults to `'USDC'`. */
  quoteSymbol?: string;
  /** Starting reserve of token X. Defaults to `100`. */
  baseX?: number;
  /** Starting reserve of token Y. Defaults to `200000` (price starts at 2000). */
  baseY?: number;
  /** Largest victim spend, as a fraction of the Y reserve. Defaults to `0.25`. */
  maxVictimFraction?: number;
  /** Largest attacker front-run spend, as a fraction of the Y reserve. Defaults to `0.25`. */
  maxAttackerFraction?: number;
  /** Slider step, as a fraction of the Y reserve. Defaults to `0.005`. */
  step?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, digits = 2): string =>
  `${value < 0 ? '-' : ''}${prefix}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

/** Token-amount formatting with adaptive precision. */
const amt = (value: number): string => {
  const abs = Math.abs(value);
  const d = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

/**
 * Interactive sandwich-attack explainer for a constant-product AMM (x·y=k).
 *
 * An attacker who can see a victim's pending swap before it lands "sandwiches"
 * it with two transactions of their own:
 *
 *   1. FRONT-RUN — the attacker buys the same asset first (spending `a` of the
 *      quote token Y), pushing the spot price up.
 *   2. VICTIM    — the victim's swap now executes against the worsened pool, so
 *      they receive fewer base tokens than they would have with no attacker.
 *   3. BACK-RUN  — the attacker sells back exactly the base tokens they bought,
 *      cashing out at the price the victim just propped up. The difference,
 *      minus fees, is the attacker's profit — and it comes straight out of the
 *      value the victim lost.
 *
 * Every number is computed from exact x·y=k math (same formula family as
 * `SlippageCurve`): buying X with Δy of Y returns Δx = x − k/(y+Δy); selling Δx
 * of X returns Δy = y − k/(x+Δx). Two sliders control the victim's spend and the
 * attacker's front-run spend. A small SVG tracks the spot price across all four
 * pool states (start → front-run → victim → back-run), tweening between them and
 * snapping under `prefers-reduced-motion`. An optional per-swap fee can be
 * enabled. Locale-agnostic: every user-facing string is a prop.
 */
export function SandwichAttack({
  title = 'Sandwich attack on an AMM',
  victimSizeLabel = "Victim's trade size",
  attackerSizeLabel = "Attacker's front-run size",
  frontRunLabel = 'Front-run',
  victimLabel = 'Victim swap',
  backRunLabel = 'Back-run',
  frontRunDesc = 'Attacker buys first, pushing the price up.',
  victimDesc = 'Victim now buys at the worse price.',
  backRunDesc = 'Attacker sells back, banking the difference.',
  cleanOutputLabel = 'Victim gets (no attack)',
  sandwichedOutputLabel = 'Victim gets (sandwiched)',
  victimLossLabel = 'Victim loses',
  attackerProfitLabel = 'Attacker profit',
  priceLabel = 'Spot price',
  priceTrackLabel = 'Spot price across the sandwich',
  startStateLabel = 'Start',
  afterFrontRunLabel = 'After front-run',
  afterVictimLabel = 'After victim',
  afterBackRunLabel = 'After back-run',
  feeRate = 0,
  feeLabel = 'Fees paid (attacker)',
  caption =
    "The attacker brackets the victim: buy before, sell after. The victim's price is propped up by the front-run, and the attacker pockets almost exactly what the victim lost. Deeper pools and tight slippage limits shrink the bite.",
  currencyPrefix = '$',
  baseSymbol = 'ETH',
  quoteSymbol = 'USDC',
  baseX = 100,
  baseY = 200000,
  maxVictimFraction = 0.25,
  maxAttackerFraction = 0.25,
  step = 0.005,
  className,
}: SandwichAttackProps) {
  const id = useId();

  const x0 = baseX;
  const y0 = baseY;
  const k = x0 * y0;
  const fee = Math.max(0, feeRate);
  const showFee = fee > 0;

  const maxVictim = y0 * maxVictimFraction;
  const maxAttacker = y0 * maxAttackerFraction;
  const sliderStep = Math.max(y0 * step, 1e-9);

  // Victim spend (Y) and attacker front-run spend (Y).
  const [victimSpend, setVictimSpend] = useState(maxVictim * 0.4);
  const [attackerSpend, setAttackerSpend] = useState(maxAttacker * 0.4);

  // --- Exact constant-product math ------------------------------------------
  // Buy X by paying `dy` of Y into reserves (rx, ry). A swap fee taxes the
  // input: only dy·(1−fee) reaches the invariant.
  const buyX = (rx: number, ry: number, dy: number) => {
    const dyEff = dy * (1 - fee);
    const kk = rx * ry;
    const xOut = rx - kk / (ry + dyEff);
    return { xOut, rx: rx - xOut, ry: ry + dy };
  };
  // Sell `dx` of X back into reserves (rx, ry), receiving Y.
  const sellX = (rx: number, ry: number, dx: number) => {
    const dxEff = dx * (1 - fee);
    const kk = rx * ry;
    const yOut = ry - kk / (rx + dxEff);
    return { yOut, rx: rx + dx, ry: ry - yOut };
  };

  const model = useMemo(() => {
    const priceStart = y0 / x0;

    // Victim's clean fill against the untouched pool.
    const clean = buyX(x0, y0, victimSpend);
    const victimCleanOut = clean.xOut;

    // 1) Front-run: attacker buys X.
    const fr = buyX(x0, y0, attackerSpend);
    const attackerX = fr.xOut;
    const x1 = fr.rx;
    const y1 = fr.ry;
    const priceAfterFrontRun = y1 / x1;

    // 2) Victim swaps into the worsened pool.
    const vic = buyX(x1, y1, victimSpend);
    const victimOut = vic.xOut;
    const x2 = vic.rx;
    const y2 = vic.ry;
    const priceAfterVictim = y2 / x2;

    // 3) Back-run: attacker sells back exactly the X they bought.
    const br = sellX(x2, y2, attackerX);
    const attackerYOut = br.yOut;
    const x3 = br.rx;
    const y3 = br.ry;
    const priceAfterBackRun = y3 / x3;

    const attackerProfit = attackerYOut - attackerSpend;
    const victimLossX = victimCleanOut - victimOut;
    // Value the victim lost, marked at the start spot price.
    const victimLossY = victimLossX * priceStart;
    // Total fee the attacker paid on input across both of their swaps.
    const attackerFees = (attackerSpend + attackerX) * fee;

    return {
      priceStart,
      priceAfterFrontRun,
      priceAfterVictim,
      priceAfterBackRun,
      victimCleanOut,
      victimOut,
      victimLossX,
      victimLossY,
      attackerProfit,
      attackerFees,
    };
  }, [x0, y0, k, victimSpend, attackerSpend, fee]);

  const prices = [
    model.priceStart,
    model.priceAfterFrontRun,
    model.priceAfterVictim,
    model.priceAfterBackRun,
  ];

  // --- Price-track animation -------------------------------------------------
  // We tween a 0..1 progress along the 4 price points so the marker sweeps the
  // sandwich whenever inputs change; reduced motion snaps to the end.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [victimSpend, attackerSpend, fee]);

  // --- Geometry --------------------------------------------------------------
  const W = 520;
  const H = 220;
  const padL = 52;
  const padR = 18;
  const padT = 22;
  const padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const span = pMax - pMin || pMax || 1;
  const yLo = pMin - span * 0.35;
  const yHi = pMax + span * 0.35;

  const colX = (i: number): number => padL + (i / 3) * plotW;
  const colY = (price: number): number =>
    padT + plotH - ((price - yLo) / (yHi - yLo)) * plotH;

  // Interpolated marker position along the 4-point polyline.
  const segPos = progress * 3; // 0..3
  const segIdx = Math.min(2, Math.floor(segPos));
  const segFrac = segPos - segIdx;
  const markerPrice =
    prices[segIdx] + (prices[segIdx + 1] - prices[segIdx]) * segFrac;
  const markerX = colX(segIdx) + (colX(segIdx + 1) - colX(segIdx)) * segFrac;
  const markerY = colY(markerPrice);

  const linePath = prices
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${colX(i).toFixed(1)} ${colY(p).toFixed(1)}`)
    .join(' ');

  const stateLabels = [
    startStateLabel,
    afterFrontRunLabel,
    afterVictimLabel,
    afterBackRunLabel,
  ];

  const ariaLabel =
    `${title}. ${priceTrackLabel}. ` +
    stateLabels
      .map((label, i) => `${label}: ${money(currencyPrefix, prices[i])}`)
      .join('. ') +
    `. ${cleanOutputLabel}: ${amt(model.victimCleanOut)} ${baseSymbol}. ` +
    `${sandwichedOutputLabel}: ${amt(model.victimOut)} ${baseSymbol}. ` +
    `${victimLossLabel}: ${amt(model.victimLossX)} ${baseSymbol}. ` +
    `${attackerProfitLabel}: ${money(currencyPrefix, model.attackerProfit)}.`;

  const steps: Array<{ label: string; desc: string; tone: string }> = [
    { label: frontRunLabel, desc: frontRunDesc, tone: 'text-warning' },
    { label: victimLabel, desc: victimDesc, tone: 'text-danger' },
    { label: backRunLabel, desc: backRunDesc, tone: 'text-success' },
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
        <span className="rounded-pill bg-danger px-3 py-1 text-sm font-medium text-white">
          {money(currencyPrefix, model.attackerProfit)}
        </span>
      </figcaption>

      {/* Three-step sequence */}
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-xs font-semibold text-white',
                  i === 0 ? 'bg-warning' : i === 1 ? 'bg-danger' : 'bg-success',
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className={cx('text-sm font-semibold', s.tone)}>{s.label}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{s.desc}</p>
          </li>
        ))}
      </ol>

      {/* Price track */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot background */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          rx={6}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />

        {/* Baseline (starting price) reference */}
        <line
          x1={padL}
          y1={colY(model.priceStart)}
          x2={W - padR}
          y2={colY(model.priceStart)}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={padL - 6}
          y={colY(model.priceStart) + 3}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-ink-400)"
        >
          {money(currencyPrefix, model.priceStart, 0)}
        </text>

        {/* Price polyline across the four pool states */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
        />

        {/* State markers + labels */}
        {prices.map((p, i) => {
          const cxp = colX(i);
          const cyp = colY(p);
          const fillByIndex = [
            'var(--color-ink-400)',
            'var(--color-warning)',
            'var(--color-danger)',
            'var(--color-success)',
          ][i];
          return (
            <g key={`state-${i}`}>
              <line
                x1={cxp}
                y1={cyp}
                x2={cxp}
                y2={padT + plotH}
                stroke={fillByIndex}
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.45}
              />
              <circle cx={cxp} cy={cyp} r={5} fill={fillByIndex} />
              <text
                x={cxp}
                y={padT + plotH + 14}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-ink-500)"
              >
                {stateLabels[i]}
              </text>
              <text
                x={cxp}
                y={cyp - 9}
                textAnchor="middle"
                fontSize="9"
                fontWeight={600}
                fill={fillByIndex}
              >
                {money(currencyPrefix, p, 0)}
              </text>
            </g>
          );
        })}

        {/* Animated sweeping marker */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-brand-600)" />
        <circle
          cx={markerX}
          cy={markerY}
          r={9}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={1.5}
          opacity={0.5}
        />

        {/* Y-axis title */}
        <text
          x={14}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padT + plotH / 2})`}
        >
          {priceLabel}
        </text>
      </svg>
      <p className="mt-1 text-center text-xs text-ink-500">{priceTrackLabel}</p>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-victim`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{victimSizeLabel}</span>
            <span className="font-mono text-ink-900">
              {money(currencyPrefix, victimSpend, 0)}
            </span>
          </label>
          <input
            id={`${id}-victim`}
            type="range"
            min={0}
            max={maxVictim}
            step={sliderStep}
            value={victimSpend}
            onChange={(e) => setVictimSpend(Number(e.target.value))}
            aria-label={victimSizeLabel}
            className="mt-2 w-full accent-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-attacker`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{attackerSizeLabel}</span>
            <span className="font-mono text-ink-900">
              {money(currencyPrefix, attackerSpend, 0)}
            </span>
          </label>
          <input
            id={`${id}-attacker`}
            type="range"
            min={0}
            max={maxAttacker}
            step={sliderStep}
            value={attackerSpend}
            onChange={(e) => setAttackerSpend(Number(e.target.value))}
            aria-label={attackerSizeLabel}
            className="mt-2 w-full accent-warning focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl
        className={cx(
          'mt-4 grid grid-cols-2 gap-3 text-sm',
          showFee ? 'sm:grid-cols-5' : 'sm:grid-cols-4',
        )}
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{cleanOutputLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {amt(model.victimCleanOut)} {baseSymbol}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{sandwichedOutputLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-danger">
            {amt(model.victimOut)} {baseSymbol}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{victimLossLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-danger">
            {amt(model.victimLossX)} {baseSymbol}
            <span className="block text-xs font-normal text-ink-500">
              ≈ {money(currencyPrefix, model.victimLossY)}
            </span>
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{attackerProfitLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-success">
            {money(currencyPrefix, model.attackerProfit)}
          </dd>
        </div>
        {showFee && (
          <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
            <dt className="text-ink-500">{feeLabel}</dt>
            <dd className="font-mono text-lg font-semibold text-ink-900">
              {money(currencyPrefix, model.attackerFees)}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SandwichAttack;
