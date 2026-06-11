import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface InterestParityProps {
  /** Heading above the visualizer. */
  title?: string;
  /** Label for the domestic interest-rate slider. */
  domesticRateLabel?: string;
  /** Label for the foreign interest-rate slider. */
  foreignRateLabel?: string;
  /** Label for the spot exchange-rate slider. */
  spotLabel?: string;
  /** Label for the computed forward rate. */
  forwardLabel?: string;
  /** Label for the forward points (F − S) readout. */
  forwardPointsLabel?: string;
  /** Sentence shown when the foreign currency is at a forward premium. */
  premiumNote?: string;
  /** Sentence shown when the foreign currency is at a forward discount. */
  discountNote?: string;
  /** Sentence shown when the rates are equal (F = S). */
  flatNote?: string;
  /** Label over Path A (invest the domestic unit at home). */
  stayHomeLabel?: string;
  /** Label over Path B (convert, invest abroad, sell forward). */
  goAbroadLabel?: string;
  /** Caption tying both paths to the same end wealth. */
  matchLabel?: string;
  /** ISO-ish code for the domestic currency. Defaults to `'USD'`. */
  domesticCurrency?: string;
  /** ISO-ish code for the foreign currency. Defaults to `'EUR'`. */
  foreignCurrency?: string;
  className?: string;
}

const pct = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value * 100);

const rate = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);

/**
 * Covered Interest Parity visualizer. The exchange rate is quoted as units of
 * DOMESTIC currency per 1 unit of FOREIGN currency. Two ways to turn 1 domestic
 * unit into domestic currency a year from now must land on the same amount:
 * Path A invests at home for `(1 + r_d)`; Path B buys `1/S` foreign at spot,
 * invests abroad and sells the proceeds forward for `(F/S)(1 + r_f)`. Setting
 * the ends equal pins the no-arbitrage forward `F = S (1 + r_d)/(1 + r_f)`. The
 * low-rate currency trades at a forward premium. No animation loop; the bar
 * transition is a CSS tween that honours `motion-reduce`.
 */
export function InterestParity({
  title = 'Covered interest parity: two paths, one forward rate',
  domesticRateLabel = 'Domestic rate (r_d)',
  foreignRateLabel = 'Foreign rate (r_f)',
  spotLabel = 'Spot rate (S)',
  forwardLabel = 'No-arbitrage forward (F)',
  forwardPointsLabel = 'Forward points (F − S)',
  premiumNote = 'The foreign currency trades at a forward premium (F > S): the domestic rate is the higher one, so the forward rewards you for holding the foreign currency to offset its lower yield.',
  discountNote = 'The foreign currency trades at a forward discount (F < S): the foreign rate is the higher one, so the forward marks it down to cancel the extra yield. The low-rate currency is the one at a premium.',
  flatNote = 'The rates are equal, so there is nothing to arbitrage away: the forward equals the spot and the currency trades flat.',
  stayHomeLabel = 'Path A · stay home',
  goAbroadLabel = 'Path B · go abroad',
  matchLabel = 'Both paths end with the same domestic wealth — that is what fixes F.',
  domesticCurrency = 'USD',
  foreignCurrency = 'EUR',
  className,
}: InterestParityProps) {
  const id = useId();
  const [rd, setRd] = useState(0.05);
  const [rf, setRf] = useState(0.02);
  const [spot, setSpot] = useState(1.1);

  const forward = (spot * (1 + rd)) / (1 + rf);
  const points = forward - spot;

  // Path A: 1 domestic invested at home. Path B: (F/S)(1 + r_f) domestic.
  const endA = 1 + rd;
  const endB = (forward / spot) * (1 + rf);

  const note = points > 1e-9 ? premiumNote : points < -1e-9 ? discountNote : flatNote;

  // Two-bar chart geometry. Both ends are equal by construction; we scale to a
  // shared max so the two columns visibly land on the same height.
  const W = 360;
  const H = 200;
  const baseY = H - 28;
  const top = 18;
  const maxWealth = Math.max(endA, endB, 1.01);
  const barH = (v: number) => ((v - 1) / (maxWealth - 1 + 1e-9)) * 0.6 * (baseY - top) + 0.4 * (baseY - top);
  const colW = 84;
  const xA = W / 2 - 110;
  const xB = W / 2 + 26;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-ink-600">
            {domesticRateLabel}: <span className="font-medium text-ink-900">{pct(rd)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={0.12}
            step={0.0025}
            value={rd}
            onChange={(e) => setRd(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--color-brand-600)]"
            aria-label={`${domesticRateLabel}, ${pct(rd)} percent`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-600">
            {foreignRateLabel}: <span className="font-medium text-ink-900">{pct(rf)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={0.12}
            step={0.0025}
            value={rf}
            onChange={(e) => setRf(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--color-accent-500)]"
            aria-label={`${foreignRateLabel}, ${pct(rf)} percent`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-600">
            {spotLabel}: <span className="font-medium text-ink-900">{rate(spot)}</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.01}
            value={spot}
            onChange={(e) => setSpot(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--color-ink-500)]"
            aria-label={`${spotLabel}, ${rate(spot)} ${domesticCurrency} per ${foreignCurrency}`}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <p className="rounded-card bg-brand-50 px-3 py-2 text-ink-900">
          {forwardLabel}:{' '}
          <span className="font-mono font-medium">
            {rate(forward)} {domesticCurrency}/{foreignCurrency}
          </span>
        </p>
        <p className="rounded-card bg-accent-50 px-3 py-2 text-ink-900">
          {forwardPointsLabel}:{' '}
          <span className="font-mono font-medium">
            {points >= 0 ? '+' : '−'}
            {rate(Math.abs(points))}
          </span>
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Two columns of equal height: ${stayHomeLabel} ends with ${money(endA)} ${domesticCurrency}, and ${goAbroadLabel} ends with ${money(endB)} ${domesticCurrency}. They match at the no-arbitrage forward of ${rate(forward)} ${domesticCurrency} per ${foreignCurrency}.`}
      >
        <line
          x1={20}
          y1={baseY}
          x2={W - 20}
          y2={baseY}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
        />
        {/* Equal-end reference line */}
        <line
          x1={20}
          y1={baseY - barH(endA)}
          x2={W - 20}
          y2={baseY - barH(endA)}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {/* Path A bar */}
        <rect
          x={xA}
          y={baseY - barH(endA)}
          width={colW}
          height={barH(endA)}
          rx={6}
          fill="var(--color-brand-500)"
          className="transition-all duration-300 motion-reduce:transition-none"
        />
        <text x={xA + colW / 2} y={baseY - barH(endA) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink-900)">
          {money(endA)}
        </text>
        <text x={xA + colW / 2} y={baseY + 16} textAnchor="middle" fontSize={11} fill="var(--color-ink-500)">
          {stayHomeLabel}
        </text>
        {/* Path B bar */}
        <rect
          x={xB}
          y={baseY - barH(endB)}
          width={colW}
          height={barH(endB)}
          rx={6}
          fill="var(--color-accent-500)"
          className="transition-all duration-300 motion-reduce:transition-none"
        />
        <text x={xB + colW / 2} y={baseY - barH(endB) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink-900)">
          {money(endB)}
        </text>
        <text x={xB + colW / 2} y={baseY + 16} textAnchor="middle" fontSize={11} fill="var(--color-ink-500)">
          {goAbroadLabel}
        </text>
      </svg>

      <p className="mt-1 text-center text-xs text-ink-500">{matchLabel}</p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {note}
      </p>

      <p id={`${id}-formula`} className="mt-3 text-center font-mono text-sm text-ink-900">
        F = S × (1 + r_d) / (1 + r_f)
      </p>
    </figure>
  );
}

export default InterestParity;
