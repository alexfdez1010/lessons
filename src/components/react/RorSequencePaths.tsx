import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RorSequencePathsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the reshuffle button. */
  shuffleLabel?: string;
  /** Label for the toggle enabling/disabling the yearly withdrawal. */
  withdrawLabel?: string;
  /** Legend label for the "good years first" ordering. */
  goodFirstLabel?: string;
  /** Legend label for the "bad years first" ordering. */
  badFirstLabel?: string;
  /** Readout label for the ending balance of the good-first path. */
  goodEndLabel?: string;
  /** Readout label for the ending balance of the bad-first path. */
  badEndLabel?: string;
  /** Currency/units suffix appended to balance readouts. Defaults to "k". */
  unitSuffix?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const START = 100; // starting balance in units (e.g. $100k)
const WITHDRAW = 7; // fixed yearly withdrawal in the same units
const YEARS = 20;

// A fixed multiset of yearly returns; ordering is the only thing that changes.
const baseReturns = [0.22, 0.18, 0.14, 0.11, 0.08, 0.05, 0.02, -0.04, -0.12, -0.22, 0.16, 0.1, 0.06, 0.0, -0.08, 0.2, 0.12, 0.04, -0.15, 0.13];

const walk = (returns: number[], withdraw: boolean): number[] => {
  const path = [START];
  let bal = START;
  for (const r of returns) {
    bal = bal * (1 + r);
    if (withdraw) bal -= WITHDRAW;
    if (bal < 0) bal = 0;
    path.push(bal);
  }
  return path;
};

/**
 * Demonstrates sequence-of-returns risk. Two portfolios experience the EXACT
 * same multiset of yearly returns but in opposite order: one front-loads the
 * good years, the other front-loads the bad years. With no cashflows the ending
 * balances are identical (multiplication commutes). Switch on a fixed yearly
 * WITHDRAWAL and the two paths diverge dramatically — selling into an early
 * crash locks in losses that later gains can never undo. Two curves animate in;
 * a withdrawal toggle and a reshuffle button drive the comparison. Deterministic
 * via a seeded shuffle; respects prefers-reduced-motion.
 */
export function RorSequencePaths({
  title = 'Same returns, opposite order',
  shuffleLabel = 'Reshuffle order',
  withdrawLabel = 'Withdraw each year',
  goodFirstLabel = 'Good years first',
  badFirstLabel = 'Bad years first',
  goodEndLabel = 'Good-first ends at',
  badEndLabel = 'Bad-first ends at',
  unitSuffix = 'k',
  caption = 'With no withdrawals, order is irrelevant — both paths end identically, because multiplication commutes. Turn on withdrawals and order becomes destiny: the portfolio that meets its worst years early, while still selling shares to fund spending, can run dry while the other thrives. That is sequence-of-returns risk.',
  className,
}: RorSequencePathsProps) {
  const id = useId();
  const [withdraw, setWithdraw] = useState(true);
  const [seedBump, setSeedBump] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Deterministic shuffle of the base returns, then sort two ways.
  const rand = mulberry32(2027 + seedBump * 131);
  const shuffled = [...baseReturns];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const goodFirst = [...shuffled].sort((a, b) => b - a);
  const badFirst = [...shuffled].sort((a, b) => a - b);

  const goodPath = walk(goodFirst, withdraw);
  const badPath = walk(badFirst, withdraw);

  const W = 560;
  const H = 250;
  const padLeft = 44;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 30;
  const n = goodPath.length;
  const maxV = Math.max(...goodPath, ...badPath, START);
  const minV = 0;

  const xToPx = (i: number) => padLeft + (i / (n - 1)) * (W - padLeft - padRight);
  const yToPx = (v: number) => padTop + (1 - (v - minV) / (maxV - minV)) * (H - padTop - padBottom);
  const baseY = H - padBottom;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1100;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(1 - (1 - t) * (1 - t));
      if (t < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [withdraw, seedBump]);

  const drawn = Math.max(1, Math.round((n - 1) * progress));
  const pathD = (path: number[]) => {
    let d = '';
    const last = Math.min(drawn, path.length - 1);
    for (let i = 0; i <= last; i++) d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(path[i]).toFixed(2)} `;
    return d.trim();
  };

  const fmt = (v: number) => `${Math.round(v)}${unitSuffix}`;
  const goodEnd = goodPath[goodPath.length - 1];
  const badEnd = badPath[badPath.length - 1];

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {withdraw ? withdrawLabel : `${withdrawLabel}: off`}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill" style={{ backgroundColor: 'var(--color-brand-500)' }} aria-hidden="true" />
          {goodFirstLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill" style={{ backgroundColor: 'var(--color-danger)' }} aria-hidden="true" />
          {badFirstLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Two portfolios with identical returns in opposite order${withdraw ? ' and a fixed yearly withdrawal' : ''}. Good-years-first ends at ${fmt(goodEnd)}, bad-years-first ends at ${fmt(badEnd)}.`}
      >
        <line x1={padLeft} y1={yToPx(START)} x2={W - padRight} y2={yToPx(START)} stroke="var(--color-ink-200)" strokeDasharray="4 4" />
        <text x={padLeft - 6} y={yToPx(START) + 3} fontSize={10} fill="var(--color-ink-500)" textAnchor="end">
          {fmt(START)}
        </text>
        <line x1={padLeft} y1={baseY} x2={W - padRight} y2={baseY} stroke="var(--color-ink-200)" />

        <path d={pathD(goodPath)} fill="none" stroke="var(--color-brand-500)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        <path d={pathD(badPath)} fill="none" stroke="var(--color-danger)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />

        <text x={padLeft} y={H - 6} fontSize={11} fill="var(--color-ink-900)" textAnchor="start">
          0
        </text>
        <text x={W - padRight} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="end">
          {`${YEARS} yr`}
        </text>
      </svg>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{goodEndLabel}</dt>
          <dd className="font-mono text-lg font-semibold" style={{ color: 'var(--color-brand-600)' }}>
            {fmt(goodEnd)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{badEndLabel}</dt>
          <dd className="font-mono text-lg font-semibold" style={{ color: 'var(--color-danger)' }}>
            {fmt(badEnd)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setWithdraw((w) => !w)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
          aria-pressed={withdraw}
        >
          {withdrawLabel}: {withdraw ? 'on' : 'off'}
        </button>
        <button
          type="button"
          onClick={() => setSeedBump((s) => s + 1)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {shuffleLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RorSequencePaths;
