import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface InventorySkewProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the inventory slider / x-axis. */
  inventoryLabel?: string;
  /** Label for the ask-quote curve. */
  askLabel?: string;
  /** Label for the bid-quote curve. */
  bidLabel?: string;
  /** Label for the reservation-price curve. */
  reservationLabel?: string;
  /** Label for the mid-price reference. */
  midLabel?: string;
  /** Label for the "short" end of the inventory axis. */
  shortLabel?: string;
  /** Label for the "long" end of the inventory axis. */
  longLabel?: string;
  /** Label for the skew readout at the current inventory. */
  skewReadoutLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to prices. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

/**
 * Inventory-skew relationship chart.
 *
 * Where {@link AsQuotingSim} shows the four price levels at one inventory state,
 * this island shows the *whole linear relationship*: as the maker's inventory
 * sweeps from very short to very long, BOTH its bid and ask slide down together
 * (the reservation price r = s − q·γ·σ²·(T−t) is linear in inventory). The plot
 * draws three parallel lines — ask, reservation, bid — against inventory on the
 * x-axis, with a draggable marker on the current inventory and a readout of how
 * far the quotes have skewed from the mid. The key lesson: skew is a *steering*
 * input that moves the whole two-sided quote, distinct from the spread (the
 * constant vertical gap between the bid and ask lines).
 *
 * Slider-driven (reduced-motion friendly by construction); locale-agnostic props.
 */
export function InventorySkew({
  title = 'How both quotes skew with inventory',
  inventoryLabel = 'Inventory q',
  askLabel = 'Ask',
  bidLabel = 'Bid',
  reservationLabel = 'Reservation r',
  midLabel = 'Mid',
  shortLabel = 'Short',
  longLabel = 'Long',
  skewReadoutLabel = 'Skew vs mid',
  caption = 'Inventory slides the entire two-sided quote up or down: get long and both bid and ask drop (you become an eager seller, a reluctant buyer); get short and both rise. The vertical gap between the lines — the spread — barely moves; what changes is where that gap sits.',
  currencyPrefix = '$',
  className,
}: InventorySkewProps) {
  const id = useId();

  const MID = 100;
  const SIGMA = 2;
  const K = 1.5;
  const GAMMA = 0.1;
  const TAU = 1;
  const Q_MAX = 10;

  const sigma2 = SIGMA * SIGMA;
  const spread = GAMMA * sigma2 * TAU + (2 / GAMMA) * Math.log(1 + GAMMA / K);
  const reservationAt = (q: number) => MID - q * GAMMA * sigma2 * TAU;
  const askAt = (q: number) => reservationAt(q) + spread / 2;
  const bidAt = (q: number) => reservationAt(q) - spread / 2;

  const [q, setQ] = useState(5);

  const money = (v: number, digits = 2): string =>
    `${currencyPrefix}${v.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  const signed = (v: number, digits = 2): string =>
    `${v > 0 ? '+' : v < 0 ? '−' : ''}${currencyPrefix}${Math.abs(v).toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;

  // Geometry.
  const W = 540;
  const H = 260;
  const padL = 48;
  const padR = 78;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const yLo = bidAt(Q_MAX) - 1;
  const yHi = askAt(-Q_MAX) + 1;
  const toX = (qq: number) => padL + ((qq + Q_MAX) / (2 * Q_MAX)) * plotW;
  const toY = (v: number) => padT + ((yHi - v) / (yHi - yLo)) * plotH;

  const lineFor = (fn: (q: number) => number) =>
    `M ${toX(-Q_MAX).toFixed(1)} ${toY(fn(-Q_MAX)).toFixed(1)} L ${toX(Q_MAX).toFixed(1)} ${toY(fn(Q_MAX)).toFixed(1)}`;

  const skew = reservationAt(q) - MID;
  const mx = toX(q);

  const ariaLabel = `${title}. At ${inventoryLabel} ${q}, ${bidLabel} ${money(bidAt(q))}, ${askLabel} ${money(
    askAt(q),
  )}, ${skewReadoutLabel} ${signed(skew)}.`;

  return (
    <figure className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}>
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            q > 0 ? 'bg-brand-600' : q < 0 ? 'bg-accent-600' : 'bg-ink-400',
          )}
          aria-live="polite"
        >
          {skewReadoutLabel}: {signed(skew)}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={ariaLabel}>
        {/* mid reference */}
        <line
          x1={padL}
          y1={toY(MID)}
          x2={W - padR}
          y2={toY(MID)}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text x={W - padR + 6} y={toY(MID) + 4} fontSize="10" fill="var(--color-ink-400)">
          {midLabel}
        </text>

        {/* flat (q=0) vertical guide */}
        <line x1={toX(0)} y1={padT} x2={toX(0)} y2={padT + plotH} stroke="var(--color-ink-100)" strokeWidth={1} />

        {/* the three skew lines */}
        <path d={lineFor(askAt)} fill="none" stroke="var(--color-accent-600)" strokeWidth={2.5} />
        <path d={lineFor(reservationAt)} fill="none" stroke="var(--color-warning)" strokeWidth={2.5} strokeDasharray="6 3" />
        <path d={lineFor(bidAt)} fill="none" stroke="var(--color-brand-600)" strokeWidth={2.5} />

        {/* end labels */}
        <text x={W - padR + 6} y={toY(askAt(Q_MAX)) + 4} fontSize="11" fontWeight={600} fill="var(--color-accent-600)">
          {askLabel}
        </text>
        <text x={W - padR + 6} y={toY(bidAt(Q_MAX)) + 4} fontSize="11" fontWeight={600} fill="var(--color-brand-600)">
          {bidLabel}
        </text>
        <text x={padL + 4} y={toY(reservationAt(-Q_MAX)) - 4} fontSize="10" fontWeight={600} fill="var(--color-warning)">
          {reservationLabel}
        </text>

        {/* current-inventory marker */}
        <line x1={mx} y1={padT} x2={mx} y2={padT + plotH} stroke="var(--color-ink-400)" strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx={mx} cy={toY(askAt(q))} r={4.5} fill="var(--color-accent-600)" />
        <circle cx={mx} cy={toY(reservationAt(q))} r={4.5} fill="var(--color-warning)" />
        <circle cx={mx} cy={toY(bidAt(q))} r={4.5} fill="var(--color-brand-600)" />

        {/* x-axis ends */}
        <text x={padL} y={H - 8} fontSize="10" fill="var(--color-accent-600)">
          ← {shortLabel}
        </text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-brand-600)">
          {longLabel} →
        </text>
        <text x={toX(0)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-400)">
          {inventoryLabel} = 0
        </text>
      </svg>

      {/* slider */}
      <div className="mt-3">
        <label htmlFor={`${id}-q`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{inventoryLabel}</span>
          <span className="font-mono text-ink-900">
            {q > 0 ? '+' : ''}
            {q}
          </span>
        </label>
        <input
          id={`${id}-q`}
          type="range"
          min={-Q_MAX}
          max={Q_MAX}
          step={1}
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
          aria-label={inventoryLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bidLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{money(bidAt(q))}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{reservationLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-warning">{money(reservationAt(q))}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{askLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">{money(askAt(q))}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default InventorySkew;
