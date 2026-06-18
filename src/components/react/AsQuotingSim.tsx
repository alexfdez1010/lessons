import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AsQuotingSimProps {
  /** Heading above the visualization. */
  title?: string;
  /** Label for the inventory slider (current net position q). */
  inventoryLabel?: string;
  /** Label for the risk-aversion slider (γ). */
  riskAversionLabel?: string;
  /** Label for the time-remaining slider (T − t). */
  timeLabel?: string;
  /** Label for the mid-price reference line. */
  midLabel?: string;
  /** Label for the reservation-price line. */
  reservationLabel?: string;
  /** Label for the bid quote. */
  bidLabel?: string;
  /** Label for the ask quote. */
  askLabel?: string;
  /** Label for the inventory-skew readout (reservation − mid). */
  skewLabel?: string;
  /** Label for the optimal-spread readout. */
  spreadLabel?: string;
  /** Verdict shown when the maker is leaning to sell (long inventory). */
  leanSellLabel?: string;
  /** Verdict shown when the maker is leaning to buy (short inventory). */
  leanBuyLabel?: string;
  /** Verdict shown when inventory is flat (symmetric quotes). */
  symmetricLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to prices. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

/**
 * Avellaneda–Stoikov optimal-quoting simulator.
 *
 * The market maker does NOT quote symmetrically around the mid. It first shifts
 * its personal fair value — the *reservation price* — away from the mid in
 * proportion to its inventory, then wraps a risk-and-liquidity-driven *optimal
 * spread* around that reservation price:
 *
 *   reservation r = s − q·γ·σ²·(T−t)
 *   optimal spread δ = γ·σ²·(T−t) + (2/γ)·ln(1 + γ/k)
 *   ask = r + δ/2,  bid = r − δ/2
 *
 * The learner drags inventory `q`, risk aversion `γ`, and time-to-close `(T−t)`
 * and watches the mid, reservation price, bid and ask redraw on a vertical price
 * axis, with live readouts of the inventory skew (r − s) and the optimal spread.
 * Getting long pulls BOTH quotes below the mid (lean to sell); more risk
 * aversion or more time widens the skew and the spread. Slider-driven, so it is
 * inherently reduced-motion friendly; all strings are locale-agnostic props.
 */
export function AsQuotingSim({
  title = 'Avellaneda–Stoikov: where the quotes actually go',
  inventoryLabel = 'Inventory q (shares held)',
  riskAversionLabel = 'Risk aversion γ',
  timeLabel = 'Time to close (T − t)',
  midLabel = 'Mid',
  reservationLabel = 'Reservation price r',
  bidLabel = 'Bid',
  askLabel = 'Ask',
  skewLabel = 'Inventory skew (r − mid)',
  spreadLabel = 'Optimal spread δ',
  leanSellLabel = 'Long inventory → both quotes shaded DOWN to attract buyers',
  leanBuyLabel = 'Short inventory → both quotes shaded UP to attract sellers',
  symmetricLabel = 'Flat inventory → quotes sit symmetrically around the mid',
  caption = 'The reservation price is the maker’s risk-adjusted fair value: it slides away from the mid as inventory grows, and the optimal spread (set by risk aversion, volatility, time, and order-flow intensity) is wrapped around it. Inventory steers the quotes; the spread sizes them.',
  currencyPrefix = '$',
  className,
}: AsQuotingSimProps) {
  const id = useId();

  // Fixed model constants (shown to the learner as a note, not sliders, to keep
  // the control surface focused on the three pedagogically interesting knobs).
  const MID = 100;
  const SIGMA = 2; // volatility of the mid (price units per √time)
  const K = 1.5; // order-arrival intensity decay

  const [q, setQ] = useState(6);
  const [gamma, setGamma] = useState(0.1);
  const [tau, setTau] = useState(1); // (T − t), normalised to [0, 1]

  const sigma2 = SIGMA * SIGMA;
  // Avellaneda–Stoikov closed form.
  const skew = -q * gamma * sigma2 * tau; // r − s
  const reservation = MID + skew;
  const spread = gamma * sigma2 * tau + (2 / gamma) * Math.log(1 + gamma / K);
  const ask = reservation + spread / 2;
  const bid = reservation - spread / 2;

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

  // Chart geometry — a vertical price axis with the four levels drawn as lines.
  const W = 540;
  const H = 260;
  const padL = 60;
  const padR = 110;
  const padT = 18;
  const padB = 18;
  const plotH = H - padT - padB;

  // Adaptive y-range so the lines never clip, with a little headroom.
  const values = [MID, reservation, ask, bid];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 2);
  const yLo = lo - span * 0.35;
  const yHi = hi + span * 0.35;
  const toY = (v: number) => padT + ((yHi - v) / (yHi - yLo)) * plotH;
  const xL = padL;
  const xR = W - padR;

  const leaning = q > 0 ? leanSellLabel : q < 0 ? leanBuyLabel : symmetricLabel;
  const leanTone = q === 0 ? 'text-ink-600' : q > 0 ? 'text-brand-700' : 'text-accent-700';

  const ariaLabel = `${title}. ${midLabel} ${money(MID)}, ${reservationLabel} ${money(
    reservation,
  )}, ${bidLabel} ${money(bid)}, ${askLabel} ${money(ask)}. ${spreadLabel} ${money(spread)}.`;

  const Row = ({
    value,
    label,
    color,
    dashed = false,
    bold = false,
  }: {
    value: number;
    label: string;
    color: string;
    dashed?: boolean;
    bold?: boolean;
  }) => {
    const y = toY(value);
    return (
      <g>
        <line
          x1={xL}
          y1={y}
          x2={xR}
          y2={y}
          stroke={color}
          strokeWidth={bold ? 2.5 : 1.8}
          strokeDasharray={dashed ? '5 4' : undefined}
        />
        <text x={xL - 6} y={y + 3} textAnchor="end" fontSize="11" className="font-mono" fill="var(--color-ink-700)">
          {money(value)}
        </text>
        <text x={xR + 8} y={y + 4} fontSize="11" fontWeight={bold ? 700 : 500} fill={color}>
          {label}
        </text>
      </g>
    );
  };

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
          q = {q > 0 ? '+' : ''}
          {q}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={ariaLabel}>
        {/* the spread band between bid and ask */}
        <rect
          x={xL}
          y={toY(ask)}
          width={xR - xL}
          height={Math.max(0, toY(bid) - toY(ask))}
          fill="var(--color-brand-500)"
          opacity={0.07}
        />
        {/* mid (neutral reference) */}
        <Row value={MID} label={midLabel} color="var(--color-ink-400)" dashed />
        {/* reservation price (the skewed fair value) */}
        <Row value={reservation} label={reservationLabel} color="var(--color-warning)" bold />
        {/* ask + bid quotes */}
        <Row value={ask} label={askLabel} color="var(--color-accent-600)" />
        <Row value={bid} label={bidLabel} color="var(--color-brand-600)" />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
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
            min={-10}
            max={10}
            step={1}
            value={q}
            onChange={(e) => setQ(Number(e.target.value))}
            aria-label={inventoryLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-g`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{riskAversionLabel}</span>
            <span className="font-mono text-ink-900">{gamma.toFixed(2)}</span>
          </label>
          <input
            id={`${id}-g`}
            type="range"
            min={0.02}
            max={0.4}
            step={0.02}
            value={gamma}
            onChange={(e) => setGamma(Number(e.target.value))}
            aria-label={riskAversionLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-t`} className="flex items-center justify-between text-sm text-ink-700">
            <span>{timeLabel}</span>
            <span className="font-mono text-ink-900">{tau.toFixed(2)}</span>
          </label>
          <input
            id={`${id}-t`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={tau}
            onChange={(e) => setTau(Number(e.target.value))}
            aria-label={timeLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{skewLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              skew < 0 ? 'text-brand-700' : skew > 0 ? 'text-accent-700' : 'text-ink-700',
            )}
          >
            {signed(skew)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spreadLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{money(spread)}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3" aria-live="polite">
        <p className={cx('text-sm font-semibold', leanTone)}>{leaning}</p>
      </div>

      <p className="mt-3 text-xs text-ink-500">
        σ = {SIGMA}, k = {K} (fixed). q·γ·σ²·(T−t) sets the skew; γσ²(T−t) + (2/γ)·ln(1 + γ/k) sets the spread.
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AsQuotingSim;
