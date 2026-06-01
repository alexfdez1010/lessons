import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PaymentFlowProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label under the paying party node. */
  payerLabel?: string;
  /** Label under the receiving party node. */
  payeeLabel?: string;
  /** Prefix shown before the transferred amount (e.g. "Pays"). */
  amountLabel?: string;
  /** Label on the goods/service token that flows back to the payer. */
  goodsLabel?: string;
  /** Toggle label for the direct, cash payment path. */
  cashLabel?: string;
  /** Toggle label for the bank-mediated, digital payment path. */
  digitalLabel?: string;
  /** Label under the intermediary node in digital mode. */
  bankLabel?: string;
  /** One-line takeaway shown for the cash path. */
  cashCaption?: string;
  /** One-line takeaway shown for the digital path. */
  digitalCaption?: string;
  /** Accessible label for the cash/digital toggle group. */
  groupLabel?: string;
  /** Currency symbol prefixed to the amount. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Amount transferred in the payment. Defaults to `40`. */
  amount?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;

type Mode = 'cash' | 'digital';

/**
 * Animated anatomy of a single payment. Money flows from the payer to the payee
 * while the goods/service flows the other way, so the learner *sees* a payment
 * as a two-way swap rather than a one-way handover. A toggle switches between a
 * direct **cash** path (payer → payee) and a **digital** path that routes the
 * money through a bank/processor (payer → bank → payee) — making the role of the
 * intermediary visible. The money token rides the path on a loop; respects
 * `prefers-reduced-motion` (parks the token mid-path as a static diagram).
 */
export function PaymentFlow({
  title = 'Anatomy of a payment',
  payerLabel = 'Payer',
  payeeLabel = 'Payee',
  amountLabel = 'Pays',
  goodsLabel = 'Goods / service',
  cashLabel = 'Cash',
  digitalLabel = 'Digital',
  bankLabel = 'Bank',
  cashCaption = 'Cash moves directly: the payer hands money straight to the payee, and the goods come straight back. No middleman, settled on the spot.',
  digitalCaption = 'Going digital adds a bank between the parties: your money hops payer → bank → payee. The bank moves the value for you, so settlement takes a moment longer.',
  groupLabel = 'Payment method',
  currencyPrefix = '$',
  amount = 40,
  className,
}: PaymentFlowProps) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('cash');
  const [t, setT] = useState(0); // 0 → 1 loop position of the money token
  const [reduced, setReduced] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Geometry. Payer left, payee right, bank centered above the path.
  const W = 520;
  const H = 220;
  const payerX = 80;
  const payeeX = W - 80;
  const lineY = 132;
  const bankX = W / 2;
  const bankY = 56;

  // Loop the money token along the active path.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setReduced(true);
      setT(mode === 'digital' ? 0.25 : 0.5);
      return;
    }
    setReduced(false);
    setT(0);
    const duration = 2600;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = ((ts - startTs) % duration) / duration;
      setT(p);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [mode]);

  // Position of the money token at loop fraction `t`.
  const moneyPos = (frac: number): { x: number; y: number } => {
    if (mode === 'cash') {
      // Straight line payer → payee.
      return { x: payerX + (payeeX - payerX) * frac, y: lineY };
    }
    // Digital: payer → bank for the first half, bank → payee for the second.
    if (frac < 0.5) {
      const f = frac / 0.5;
      return { x: payerX + (bankX - payerX) * f, y: lineY + (bankY - lineY) * f };
    }
    const f = (frac - 0.5) / 0.5;
    return { x: bankX + (payeeX - bankX) * f, y: bankY + (lineY - bankY) * f };
  };

  // Goods token always travels payee → payer along the straight base line,
  // offset slightly below so it never overlaps the money token.
  const goodsPos = (frac: number): { x: number; y: number } => ({
    x: payeeX + (payerX - payeeX) * frac,
    y: lineY + 34,
  });

  const m = moneyPos(t);
  const g = goodsPos(reduced ? 0.5 : t);

  const amountText = money(currencyPrefix, amount);
  const caption = mode === 'cash' ? cashCaption : digitalCaption;

  const describe =
    mode === 'cash'
      ? `${payerLabel} pays ${amountText} directly to ${payeeLabel}; the ${goodsLabel.toLowerCase()} goes the other way.`
      : `${payerLabel} pays ${amountText} to ${payeeLabel} through the ${bankLabel.toLowerCase()}; the ${goodsLabel.toLowerCase()} goes the other way.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {amountLabel} {amountText}
        </span>
      </figcaption>

      {/* Cash / Digital toggle */}
      <div
        className="mt-4 inline-flex rounded-pill border border-ink-100 bg-surface-sunken/50 p-1"
        role="radiogroup"
        aria-label={groupLabel}
      >
        {([
          ['cash', cashLabel],
          ['digital', digitalLabel],
        ] as const).map(([value, label]) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(value)}
              className={cx(
                'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-brand-600 text-white shadow-soft'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. ${describe}`}
      >
        {/* Base path: money rail (payer ↔ payee or via bank) */}
        {mode === 'cash' ? (
          <line
            x1={payerX}
            y1={lineY}
            x2={payeeX}
            y2={lineY}
            stroke="var(--color-brand-300)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : (
          <path
            d={`M ${payerX} ${lineY} L ${bankX} ${bankY} L ${payeeX} ${lineY}`}
            fill="none"
            stroke="var(--color-brand-300)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Goods rail (payee → payer), drawn faint below the money rail */}
        <line
          x1={payerX}
          y1={lineY + 34}
          x2={payeeX}
          y2={lineY + 34}
          stroke="var(--color-accent-300)"
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeLinecap="round"
        />

        {/* Bank / processor node (digital only) */}
        {mode === 'digital' && (
          <g>
            <rect
              x={bankX - 34}
              y={bankY - 22}
              width={68}
              height={44}
              rx={10}
              fill="var(--color-surface)"
              stroke="var(--color-brand-500)"
              strokeWidth={2}
            />
            <text
              x={bankX}
              y={bankY + 5}
              textAnchor="middle"
              fontSize={20}
              aria-hidden="true"
            >
              🏦
            </text>
            <text
              x={bankX}
              y={bankY + 38}
              textAnchor="middle"
              fontSize={13}
              fill="var(--color-ink-600)"
              fontWeight={600}
            >
              {bankLabel}
            </text>
          </g>
        )}

        {/* Payer node */}
        <g>
          <circle
            cx={payerX}
            cy={lineY}
            r={26}
            fill="var(--color-surface)"
            stroke="var(--color-brand-500)"
            strokeWidth={2}
          />
          <text x={payerX} y={lineY + 7} textAnchor="middle" fontSize={22} aria-hidden="true">
            🧑
          </text>
          <text
            x={payerX}
            y={lineY - 36}
            textAnchor="middle"
            fontSize={13}
            fill="var(--color-ink-700)"
            fontWeight={600}
          >
            {payerLabel}
          </text>
        </g>

        {/* Payee node */}
        <g>
          <circle
            cx={payeeX}
            cy={lineY}
            r={26}
            fill="var(--color-surface)"
            stroke="var(--color-accent-500)"
            strokeWidth={2}
          />
          <text x={payeeX} y={lineY + 7} textAnchor="middle" fontSize={22} aria-hidden="true">
            🏪
          </text>
          <text
            x={payeeX}
            y={lineY - 36}
            textAnchor="middle"
            fontSize={13}
            fill="var(--color-ink-700)"
            fontWeight={600}
          >
            {payeeLabel}
          </text>
        </g>

        {/* Goods token (payee → payer) */}
        <g transform={`translate(${g.x}, ${g.y})`}>
          <rect
            x={-15}
            y={-13}
            width={30}
            height={26}
            rx={7}
            fill="var(--color-accent-500)"
          />
          <text x={0} y={6} textAnchor="middle" fontSize={15} aria-hidden="true">
            📦
          </text>
        </g>

        {/* Money token (payer → payee, via bank when digital) */}
        <g transform={`translate(${m.x}, ${m.y})`}>
          <circle r={16} fill="var(--color-brand-600)" />
          <text
            x={0}
            y={5}
            textAnchor="middle"
            fontSize={13}
            fill="#ffffff"
            fontWeight={700}
            aria-hidden="true"
          >
            {currencyPrefix}
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="inline-block h-3 w-3 rounded-pill bg-brand-600"
            aria-hidden="true"
          />
          {amountLabel} {amountText}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="inline-block h-3 w-3 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {goodsLabel}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {caption}
      </p>
    </figure>
  );
}

export default PaymentFlow;
