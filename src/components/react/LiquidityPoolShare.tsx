import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LiquidityPoolShareProps {
  /** Heading above the pool visual. */
  title?: string;
  /** Label for the deposit slider and its deposit-value readout. */
  depositLabel?: string;
  /** Label for the pool-share readout. Defaults to `'Your pool share'`. */
  shareLabel?: string;
  /** Label for the LP-token readout. Defaults to `'LP tokens'`. */
  lpTokenLabel?: string;
  /** Label for the estimated-fees readouts. */
  feeLabel?: string;
  /** Label for the redeemable-amounts readout. */
  redeemLabel?: string;
  /** Ticker of the first pooled token. Defaults to `'ETH'`. */
  token0Symbol?: string;
  /** Ticker of the second pooled token (the $1 stablecoin). Defaults to `'USDC'`. */
  token1Symbol?: string;
  /** Reserve of token0 already in the pool. Defaults to `100`. */
  reserve0?: number;
  /** Reserve of token1 already in the pool. Defaults to `200000`. */
  reserve1?: number;
  /** Price of token0 in dollars (token1 is assumed to be $1). Defaults to `2000`. */
  price0?: number;
  /** Swap fee rate, in percent. Defaults to `0.3`. */
  feeRatePct?: number;
  /** Assumed daily trading volume through the pool, in dollars. Defaults to `5000000`. */
  dailyVolume?: number;
  /** Largest deposit the slider allows, in dollars. Defaults to `100000`. */
  maxDeposit?: number;
  /** Slider step, in dollars. Defaults to `1000`. */
  step?: number;
  /** One-line takeaway shown under the readouts. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Label for the slice of the donut held by existing LPs. */
  existingLpLabel?: string;
  /** Label for the slice of the donut held by the learner. */
  youLabel?: string;
  /** Suffix label for an estimated-daily-fees readout (combined with {@link feeLabel}). */
  dailyLabel?: string;
  /** Suffix label for an estimated-annual-fees readout (combined with {@link feeLabel}). */
  annualLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, digits = 2): string => {
  const abs = Math.abs(value);
  // Keep big dollar figures readable with thousands separators.
  const body =
    abs >= 1000
      ? abs.toLocaleString('en-US', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })
      : abs.toFixed(digits);
  return `${value < 0 ? '-' : ''}${prefix}${body}`;
};

const num = (value: number, digits = 2): string =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/**
 * Interactive liquidity-provider (LP) explainer. A learner deposits BOTH tokens
 * of a pair into a pool at its current ratio and receives LP tokens — a receipt
 * for their share of the pool. The slider sets how much dollar value the learner
 * adds; a donut splits the pool into existing LPs vs. the learner, growing the
 * learner's slice as they deposit more. Readouts spell out the exact math: pool
 * share = yourDeposit / (poolValue + yourDeposit), LP tokens minted pro-rata,
 * fee earnings = poolShare × dailyVolume × feeRate (daily and annualised), and
 * the share of each reserve the learner could redeem. The donut tweens between
 * states; `prefers-reduced-motion` snaps instead. Locale-agnostic via props.
 */
export function LiquidityPoolShare({
  title = 'Becoming a liquidity provider',
  depositLabel = 'Your deposit',
  shareLabel = 'Your pool share',
  lpTokenLabel = 'LP tokens',
  feeLabel = 'Est. fees',
  redeemLabel = 'You could redeem',
  token0Symbol = 'ETH',
  token1Symbol = 'USDC',
  reserve0 = 100,
  reserve1 = 200000,
  price0 = 2000,
  feeRatePct = 0.3,
  dailyVolume = 5000000,
  maxDeposit = 100000,
  step = 1000,
  caption =
    'LP tokens are your receipt: they record your share of the pool, and that share decides your cut of every swap fee. Deposit more and your slice grows — but every new provider who joins dilutes everyone’s share.',
  currencyPrefix = '$',
  existingLpLabel = 'Existing LPs',
  youLabel = 'You',
  dailyLabel = 'daily',
  annualLabel = 'yearly',
  className,
}: LiquidityPoolShareProps) {
  const id = useId();

  // Pool value: token1 is the $1 stablecoin, token0 is priced in dollars.
  const poolValue = reserve0 * price0 + reserve1;
  const feeRate = feeRatePct / 100;

  const [deposit, setDeposit] = useState(Math.round(maxDeposit / 4));
  // Animated deposit the donut renders against.
  const [shownDeposit, setShownDeposit] = useState(Math.round(maxDeposit / 4));
  const rafRef = useRef<number | null>(null);

  // --- Live (slider) math --------------------------------------------------
  // Existing LPs collectively hold `poolValue` worth and (by convention) the
  // same number of LP tokens; the learner mints new tokens pro-rata to the
  // value they add at the current ratio.
  const totalAfter = poolValue + deposit;
  const poolShare = deposit / totalAfter; // 0..1
  // LP tokens are minted pro-rata: with 1 token per $ of pool to start,
  // newTokens = existingTokens × deposit / poolValue = deposit.
  const lpTokensClean = poolValue * (deposit / poolValue);

  const dailyFees = poolShare * dailyVolume * feeRate;
  const annualFees = dailyFees * 365;

  // What the learner could redeem: their share of each reserve, after adding
  // their proportional contribution to both sides.
  const reserve0After = reserve0 + deposit / 2 / price0;
  const reserve1After = reserve1 + deposit / 2;
  const redeem0 = poolShare * reserve0After;
  const redeem1 = poolShare * reserve1After;

  // --- Donut geometry ------------------------------------------------------
  const shownShare = (poolValue + shownDeposit) === 0 ? 0 : shownDeposit / (poolValue + shownDeposit);
  const R = 54;
  const cxc = 70;
  const cyc = 70;
  const C = 2 * Math.PI * R;
  // Stroke dash for the learner's arc (drawn on top of the full existing ring).
  const youDash = `${C * shownShare} ${C * (1 - shownShare)}`;

  // Animate the donut toward the new deposit whenever the slider changes.
  useEffect(() => {
    const target = deposit;
    if (prefersReducedMotion()) {
      setShownDeposit(target);
      return;
    }
    const start = shownDeposit;
    const delta = target - start;
    if (Math.abs(delta) < 1) {
      setShownDeposit(target);
      return;
    }
    const duration = 360;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownDeposit(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownDeposit intentionally omitted: re-running each frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposit]);

  const sharePct = poolShare * 100;

  const ariaLabel =
    `${title}. ${depositLabel}: ${money(currencyPrefix, deposit, 0)}. ` +
    `${shareLabel}: ${num(sharePct, 2)}%. ${youLabel}: ${num(sharePct, 1)}%, ` +
    `${existingLpLabel}: ${num(100 - sharePct, 1)}%.`;

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
          {num(sharePct, sharePct >= 10 ? 1 : 2)}%
        </span>
      </figcaption>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Donut: existing LPs vs you */}
        <svg
          viewBox="0 0 140 140"
          className="mx-auto w-36 shrink-0 sm:mx-0"
          role="img"
          aria-label={ariaLabel}
        >
          {/* Existing-LP ring (full circle, sits underneath) */}
          <circle
            cx={cxc}
            cy={cyc}
            r={R}
            fill="none"
            stroke="var(--color-ink-100)"
            strokeWidth={18}
          />
          {/* Your slice, drawn from the top (12 o'clock) clockwise */}
          <circle
            cx={cxc}
            cy={cyc}
            r={R}
            fill="none"
            stroke="var(--color-brand-600)"
            strokeWidth={18}
            strokeDasharray={youDash}
            strokeDashoffset={C / 4}
            transform={`rotate(-90 ${cxc} ${cyc})`}
            strokeLinecap="butt"
          />
          <text
            x={cxc}
            y={cyc - 4}
            textAnchor="middle"
            fontSize="18"
            fontWeight={700}
            className="font-mono"
            fill="var(--color-ink-900)"
          >
            {num(sharePct, sharePct >= 10 ? 1 : 2)}%
          </text>
          <text
            x={cxc}
            y={cyc + 14}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-ink-500)"
          >
            {youLabel}
          </text>
        </svg>

        {/* Legend + pool composition */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="flex items-center gap-2 text-ink-700">
              <span
                className="inline-block h-3 w-3 rounded-pill"
                style={{ backgroundColor: 'var(--color-brand-600)' }}
                aria-hidden="true"
              />
              {youLabel}
            </span>
            <span className="flex items-center gap-2 text-ink-700">
              <span
                className="inline-block h-3 w-3 rounded-pill"
                style={{ backgroundColor: 'var(--color-ink-100)' }}
                aria-hidden="true"
              />
              {existingLpLabel}
            </span>
          </div>
          <dl className="mt-3 space-y-1 text-sm text-ink-600">
            <div className="flex justify-between gap-3">
              <dt>{token0Symbol} reserve</dt>
              <dd className="font-mono text-ink-900">
                {num(reserve0, 0)} {token0Symbol}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{token1Symbol} reserve</dt>
              <dd className="font-mono text-ink-900">
                {num(reserve1, 0)} {token1Symbol}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-ink-100 pt-1">
              <dt>Pool value</dt>
              <dd className="font-mono font-semibold text-ink-900">
                {money(currencyPrefix, poolValue, 0)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Deposit slider */}
      <div className="mt-5">
        <label
          htmlFor={`${id}-deposit`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{depositLabel}</span>
          <span className="font-mono text-ink-900">{money(currencyPrefix, deposit, 0)}</span>
        </label>
        <input
          id={`${id}-deposit`}
          type="range"
          min={0}
          max={maxDeposit}
          step={step}
          value={deposit}
          onChange={(e) => setDeposit(Number(e.target.value))}
          aria-label={depositLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{depositLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, deposit, 0)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{shareLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {num(sharePct, 2)}%
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{lpTokenLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {num(lpTokensClean, 0)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {feeLabel} · {dailyLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-success">
            {money(currencyPrefix, dailyFees, 2)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {feeLabel} · {annualLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-success">
            {money(currencyPrefix, annualFees, 0)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{redeemLabel}</dt>
          <dd className="font-mono text-base font-semibold text-ink-900">
            {num(redeem0, 3)} {token0Symbol}
            <span className="text-ink-400"> + </span>
            {num(redeem1, 0)} {token1Symbol}
          </dd>
        </div>
      </dl>

      {/* Fee math, spelled out */}
      <p className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3 text-sm leading-relaxed text-ink-700">
        <span className="font-mono text-ink-900">
          {num(sharePct, 2)}%
        </span>{' '}
        × {money(currencyPrefix, dailyVolume, 0)} {dailyLabel} volume ×{' '}
        {num(feeRatePct, 1)}% fee ={' '}
        <span className="font-mono font-semibold text-success">
          {money(currencyPrefix, dailyFees, 2)}
        </span>{' '}
        / {dailyLabel}.
      </p>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LiquidityPoolShare;
