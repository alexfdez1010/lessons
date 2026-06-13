import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SupplyDemandCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend + axis label for the downward-sloping demand line. */
  demandLabel?: string;
  /** Legend + axis label for the upward-sloping supply line. */
  supplyLabel?: string;
  /** Label for the price (Y) axis and the price readout. */
  priceLabel?: string;
  /** Label for the quantity (X) axis and the quantity readout. */
  quantityLabel?: string;
  /** Label for the equilibrium readout group. */
  equilibriumLabel?: string;
  /** Readout shown when the held price sits below equilibrium (demand &gt; supply). */
  shortageLabel?: string;
  /** Readout shown when the held price sits above equilibrium (supply &gt; demand). */
  surplusLabel?: string;
  /** Label for the demand-shift slider (drags the demand line left/right). */
  shiftLabel?: string;
  /** Label for the supply-shift slider (drags the supply line left/right). */
  supplyShiftLabel?: string;
  /** Label for the held-price slider (price set off-equilibrium). */
  heldPriceLabel?: string;
  /** Label shown when the held price equals the equilibrium price. */
  balancedLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial demand shift, generic units (negative = left, positive = right). Defaults to `0`. */
  demandShift?: number;
  /** Initial supply shift, generic units (negative = left, positive = right). Defaults to `0`. */
  supplyShift?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const round1 = (v: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Interactive supply & demand chart for a beginner economics lesson.
 *
 * Two straight lines on a price (Y) vs quantity (X) grid: an upward-sloping
 * SUPPLY line (sellers offer more as the price rises) and a downward-sloping
 * DEMAND line (buyers want more as the price falls). Where they cross is the
 * market EQUILIBRIUM — the single price/quantity where the amount offered
 * exactly equals the amount wanted, so the market "clears".
 *
 * The learner can drag the demand line (and the supply line) left or right;
 * the crossing point slides along, and readouts show the new equilibrium
 * price and quantity. A third slider holds the price OFF equilibrium: set it
 * too low and buyers want more than sellers supply (a SHORTAGE); set it too
 * high and sellers supply more than buyers want (a SURPLUS). The gap between
 * the two lines at the held price is shaded to make the imbalance visible.
 *
 * All units are generic/unitless and all strings are props, so a Spanish twin
 * can pass Castilian labels. Lines tween to their new positions on change and
 * respect `prefers-reduced-motion`.
 */
export function SupplyDemandCurve({
  title = 'Supply, demand & market equilibrium',
  demandLabel = 'Demand',
  supplyLabel = 'Supply',
  priceLabel = 'Price',
  quantityLabel = 'Quantity',
  equilibriumLabel = 'Equilibrium',
  shortageLabel = 'Shortage',
  surplusLabel = 'Surplus',
  shiftLabel = 'Shift demand',
  supplyShiftLabel = 'Shift supply',
  heldPriceLabel = 'Hold price at',
  balancedLabel = 'Market clears',
  caption =
    'Supply slopes up, demand slopes down — they cross at the equilibrium, the one price where what sellers offer equals what buyers want. Shift either line and the crossing slides. Hold the price too low and a shortage opens; hold it too high and a surplus piles up.',
  demandShift = 0,
  supplyShift = 0,
  className,
}: SupplyDemandCurveProps) {
  const id = useId();
  const [dShift, setDShift] = useState(demandShift);
  const [sShift, setSShift] = useState(supplyShift);

  // Animated (tweened) shift values the lines render against.
  const [shownD, setShownD] = useState(demandShift);
  const [shownS, setShownS] = useState(supplyShift);
  const rafRef = useRef<number | null>(null);

  // Domain: price 0..100 on Y, quantity 0..100 on X (unitless).
  const SHIFT_RANGE = 30;

  // Demand line:  P = (100 + dShift) - Q      → Q_d(P) = (100 + dShift) - P
  // Supply line:  P =  20 + sShift  + 0.6·Q   → Q_s(P) = (P - 20 - sShift) / 0.6
  const demandIntercept = (shift: number) => 100 + shift;
  const supplyIntercept = (shift: number) => 20 + shift;
  const SUPPLY_SLOPE = 0.6;

  const qDemand = (p: number, shift: number) => demandIntercept(shift) - p;
  const qSupply = (p: number, shift: number) => (p - supplyIntercept(shift)) / SUPPLY_SLOPE;

  // Equilibrium: demandIntercept - P = (P - supplyIntercept) / slope
  const equilibrium = (dS: number, sS: number) => {
    const di = demandIntercept(dS);
    const si = supplyIntercept(sS);
    const price = (di * SUPPLY_SLOPE + si) / (SUPPLY_SLOPE + 1);
    const qty = di - price;
    return { price, qty };
  };

  const { price: eqPrice, qty: eqQty } = equilibrium(dShift, sShift);

  // Held price defaults to equilibrium; clamps within the visible band.
  const [heldPrice, setHeldPrice] = useState<number>(() => Math.round(eqPrice));
  const [touchedHeld, setTouchedHeld] = useState(false);
  useEffect(() => {
    if (!touchedHeld) setHeldPrice(Math.round(eqPrice));
  }, [eqPrice, touchedHeld]);

  const qd = Math.max(0, qDemand(heldPrice, dShift));
  const qs = Math.max(0, qSupply(heldPrice, sShift));
  const gap = qd - qs; // >0 shortage, <0 surplus
  const EPS = 0.5;
  const state: 'shortage' | 'surplus' | 'balanced' =
    gap > EPS ? 'shortage' : gap < -EPS ? 'surplus' : 'balanced';

  // Chart geometry.
  const W = 520;
  const H = 300;
  const padL = 44;
  const padR = 60;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const sx = (q: number) => padL + (Math.max(0, Math.min(100, q)) / 100) * plotW;
  const sy = (p: number) => padT + plotH - (Math.max(0, Math.min(100, p)) / 100) * plotH;

  // Tween the rendered shift values toward the set values.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShownD(dShift);
      setShownS(sShift);
      return;
    }
    const startD = shownD;
    const startS = shownS;
    const dD = dShift - startD;
    const dS = sShift - startS;
    if (Math.abs(dD) < 0.01 && Math.abs(dS) < 0.01) {
      setShownD(dShift);
      setShownS(sShift);
      return;
    }
    const duration = 360;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShownD(startD + dD * eased);
      setShownS(startS + dS * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownD/shownS intentionally omitted so the tween isn't restarted each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dShift, sShift]);

  // Project raw (un-clamped) data coords so each line can be clipped exactly
  // to the plot box instead of having one endpoint coordinate yanked into a
  // corner (which detaches the line from the true equilibrium once shifted).
  const sxRaw = (q: number) => padL + (q / 100) * plotW;
  const syRaw = (p: number) => padT + plotH - (p / 100) * plotH;

  // Price along each line as a function of quantity.
  const dPrice = (q: number, shift: number) => demandIntercept(shift) - q;
  const sPrice = (q: number, shift: number) => supplyIntercept(shift) + SUPPLY_SLOPE * q;

  // Clip a line (data coords, q = x, p = y) to the visible [0,100]² box via
  // Liang–Barsky. Returns the two endpoints of the visible segment, or null.
  const clipToBox = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): { a: { q: number; p: number }; b: { q: number; p: number } } | null => {
    let t0 = 0;
    let t1 = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1, 100 - x1, y1, 100 - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;
      } else {
        const r = q[i] / p[i];
        if (p[i] < 0) {
          if (r > t1) return null;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return null;
          if (r < t1) t1 = r;
        }
      }
    }
    return {
      a: { q: x1 + t0 * dx, p: y1 + t0 * dy },
      b: { q: x1 + t1 * dx, p: y1 + t1 * dy },
    };
  };

  // Extend each line well past the box, then clip — guarantees the drawn
  // segment passes through the true equilibrium and hits the correct axis
  // intercepts (supply meets the price axis at 20, not the corner).
  const demandSeg = clipToBox(-60, dPrice(-60, shownD), 160, dPrice(160, shownD));
  const supplySeg = clipToBox(-60, sPrice(-60, shownS), 160, sPrice(160, shownS));

  const eqShown = equilibrium(shownD, shownS);

  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = [0, 25, 50, 75, 100];

  const stateLabel =
    state === 'shortage' ? shortageLabel : state === 'surplus' ? surplusLabel : balancedLabel;
  const stateColor =
    state === 'balanced' ? 'var(--color-brand-600)' : 'var(--color-warning)';

  const ariaLabel = `${title}. ${equilibriumLabel}: ${priceLabel} ${round1(eqPrice)}, ${quantityLabel} ${round1(
    eqQty,
  )}. ${heldPriceLabel} ${round1(heldPrice)}: ${stateLabel}${
    state !== 'balanced' ? `, ${quantityLabel} gap ${round1(Math.abs(gap))}` : ''
  }.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className="rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: stateColor }}
        >
          {stateLabel}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {demandLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {supplyLabel}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
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

        {/* Gridlines + Y tick labels */}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={padL}
              y1={sy(t)}
              x2={padL + plotW}
              y2={sy(t)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text x={padL - 6} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={`x-${t}`}
            x={sx(t)}
            y={padT + plotH + 14}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-ink-400)"
          >
            {t}
          </text>
        ))}

        {/* Shortage / surplus shading: the horizontal gap between the two
            lines at the held price. */}
        {state !== 'balanced' && (
          <line
            x1={sx(qs)}
            y1={sy(heldPrice)}
            x2={sx(qd)}
            y2={sy(heldPrice)}
            stroke="var(--color-warning)"
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.35}
          />
        )}

        {/* Held-price horizontal reference */}
        <line
          x1={padL}
          y1={sy(heldPrice)}
          x2={padL + plotW}
          y2={sy(heldPrice)}
          stroke="var(--color-ink-300)"
          strokeWidth={1.25}
          strokeDasharray="4 4"
        />

        {/* Supply line */}
        {supplySeg && (
          <line
            x1={sxRaw(supplySeg.a.q)}
            y1={syRaw(supplySeg.a.p)}
            x2={sxRaw(supplySeg.b.q)}
            y2={syRaw(supplySeg.b.p)}
            stroke="var(--color-brand-500)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
        {/* Demand line */}
        {demandSeg && (
          <line
            x1={sxRaw(demandSeg.a.q)}
            y1={syRaw(demandSeg.a.p)}
            x2={sxRaw(demandSeg.b.q)}
            y2={syRaw(demandSeg.b.p)}
            stroke="var(--color-accent-500)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}

        {/* Quantity demanded / supplied markers at the held price */}
        {state !== 'balanced' && (
          <>
            <circle cx={sx(qd)} cy={sy(heldPrice)} r={4} fill="var(--color-accent-500)" />
            <circle cx={sx(qs)} cy={sy(heldPrice)} r={4} fill="var(--color-brand-500)" />
          </>
        )}

        {/* Equilibrium guides + point */}
        <line
          x1={sx(eqShown.qty)}
          y1={sy(eqShown.price)}
          x2={sx(eqShown.qty)}
          y2={padT + plotH}
          stroke="var(--color-ink-300)"
          strokeDasharray="3 4"
          opacity={0.7}
        />
        <line
          x1={padL}
          y1={sy(eqShown.price)}
          x2={sx(eqShown.qty)}
          y2={sy(eqShown.price)}
          stroke="var(--color-ink-300)"
          strokeDasharray="3 4"
          opacity={0.7}
        />
        <circle cx={sx(eqShown.qty)} cy={sy(eqShown.price)} r={6} fill="var(--color-brand-700)" />
        <circle
          cx={sx(eqShown.qty)}
          cy={sy(eqShown.price)}
          r={9}
          fill="none"
          stroke="var(--color-brand-700)"
          strokeWidth={1.5}
          opacity={0.5}
        />

        {/* Line end labels — placed at the visible top end of each segment */}
        {supplySeg && (
          <text
            x={sxRaw(supplySeg.b.q) + 4}
            y={syRaw(supplySeg.b.p) + 10}
            fontSize="11"
            fontWeight={600}
            fill="var(--color-brand-600)"
          >
            {supplyLabel}
          </text>
        )}
        {demandSeg && (
          <text
            x={sxRaw(demandSeg.a.q) + 4}
            y={syRaw(demandSeg.a.p) + 4}
            fontSize="11"
            fontWeight={600}
            fill="var(--color-accent-600)"
          >
            {demandLabel}
          </text>
        )}

        {/* Axis titles */}
        <text
          x={padL + plotW / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {quantityLabel}
        </text>
        <text
          x={12}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padT + plotH / 2})`}
        >
          {priceLabel}
        </text>
      </svg>

      {/* Shift controls */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-demand`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{shiftLabel}</span>
            <span className="font-mono text-ink-900">{dShift > 0 ? `+${dShift}` : dShift}</span>
          </label>
          <input
            id={`${id}-demand`}
            type="range"
            min={-SHIFT_RANGE}
            max={SHIFT_RANGE}
            step={1}
            value={dShift}
            onChange={(e) => setDShift(Number(e.target.value))}
            aria-label={shiftLabel}
            className="mt-2 w-full accent-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-supply`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{supplyShiftLabel}</span>
            <span className="font-mono text-ink-900">{sShift > 0 ? `+${sShift}` : sShift}</span>
          </label>
          <input
            id={`${id}-supply`}
            type="range"
            min={-SHIFT_RANGE}
            max={SHIFT_RANGE}
            step={1}
            value={sShift}
            onChange={(e) => setSShift(Number(e.target.value))}
            aria-label={supplyShiftLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Held-price slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-held`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{heldPriceLabel}</span>
          <span className="font-mono text-ink-900">{round1(heldPrice)}</span>
        </label>
        <input
          id={`${id}-held`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={heldPrice}
          onChange={(e) => {
            setTouchedHeld(true);
            setHeldPrice(Number(e.target.value));
          }}
          aria-label={heldPriceLabel}
          className="mt-2 w-full accent-ink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {equilibriumLabel} · {priceLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{round1(eqPrice)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {equilibriumLabel} · {quantityLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{round1(eqQty)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{stateLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              state === 'balanced' ? 'text-brand-700' : 'text-warning',
            )}
          >
            {state === 'balanced' ? '0' : round1(Math.abs(gap))}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SupplyDemandCurve;
