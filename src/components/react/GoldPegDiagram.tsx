import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface GoldPegDiagramProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label inside the central gold node. */
  goldLabel?: string;
  /** Label inside the dollar (anchor currency) node. */
  dollarLabel?: string;
  /** Labels for the satellite currencies pegged to the dollar. */
  currencyLabels?: string[];
  /** Text on the gold↔dollar peg link (e.g. "$35 / oz"). */
  pegRateLabel?: string;
  /** Caption shown while the system is intact (Bretton Woods). */
  beforeNote?: string;
  /** Caption shown after the gold link is cut (Nixon shock / floating). */
  afterNote?: string;
  /** Button label that breaks the gold link. */
  breakLabel?: string;
  /** Button label that restores the intact system. */
  resetLabel?: string;
  /** Small badge text for the intact state. */
  intactBadge?: string;
  /** Small badge text for the broken state. */
  brokenBadge?: string;
  className?: string;
}

/**
 * Bretton Woods peg diagram. A central GOLD node, a DOLLAR node pegged to it at a
 * fixed rate, and satellite currencies each pegged to the dollar — the
 * "dollar pegged to gold, the world pegged to the dollar" hub-and-spoke. Press
 * the break button (the Nixon shock) and the gold↔dollar link snaps: gold drifts
 * away, the spokes go dashed/loose to signal floating exchange rates, and the
 * caption flips. Pure CSS/SVG state toggle — no animation loop — so it is
 * trivially `prefers-reduced-motion` safe. Locale-agnostic via props.
 */
export function GoldPegDiagram({
  title = 'Bretton Woods: the dollar pegged to gold, the world pegged to the dollar',
  goldLabel = 'Gold',
  dollarLabel = 'US Dollar',
  currencyLabels = ['£', '¥', 'DM', 'FF'],
  pegRateLabel = '$35 / oz',
  beforeNote = 'Each currency is fixed to the dollar, and the dollar is redeemable for gold at a fixed price. Stable exchange rates, with gold as the ultimate anchor.',
  afterNote = 'The gold window is closed: the dollar is no longer redeemable for gold, and currencies float — their exchange rates now set by markets, not a fixed peg.',
  breakLabel = 'Close the gold window (1971)',
  resetLabel = 'Restore the peg',
  intactBadge = 'Pegged',
  brokenBadge = 'Floating',
  className,
}: GoldPegDiagramProps) {
  const id = useId();
  const [broken, setBroken] = useState(false);

  const W = 460;
  const H = 300;
  const goldC = { x: W / 2, y: 56 };
  const dollarC = { x: W / 2, y: 150 };
  const goldShift = broken ? -34 : 0; // gold drifts up/away when cut
  const goldPos = { x: goldC.x, y: goldC.y + goldShift };

  const sat = currencyLabels.slice(0, 5);
  const satY = 250;
  const satPos = sat.map((_, k) => ({
    x: sat.length === 1 ? W / 2 : 50 + (k / (sat.length - 1)) * (W - 100),
    y: satY,
  }));

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
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors',
            broken ? 'bg-accent-600' : 'bg-brand-600',
          )}
        >
          {broken ? brokenBadge : intactBadge}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={broken ? afterNote : beforeNote}
      >
        {/* Gold ↔ Dollar peg link */}
        <line
          x1={dollarC.x}
          y1={dollarC.y - 26}
          x2={goldPos.x}
          y2={goldPos.y + 26}
          stroke={broken ? 'var(--color-ink-300)' : 'var(--color-brand-500)'}
          strokeWidth={broken ? 2 : 4}
          strokeDasharray={broken ? '5 6' : undefined}
          style={{ transition: 'all 600ms ease' }}
        />
        {!broken && (
          <g>
            <rect
              x={goldC.x + 10}
              y={(goldC.y + dollarC.y) / 2 - 9}
              width={86}
              height={18}
              rx={9}
              fill="var(--color-brand-50)"
              stroke="var(--color-brand-200)"
            />
            <text
              x={goldC.x + 53}
              y={(goldC.y + dollarC.y) / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              className="font-mono"
              fill="var(--color-brand-700)"
            >
              {pegRateLabel}
            </text>
          </g>
        )}
        {broken && (
          <text
            x={(goldPos.x + dollarC.x) / 2 + 64}
            y={(goldPos.y + dollarC.y) / 2}
            textAnchor="middle"
            fontSize={20}
          >
            ✂️
          </text>
        )}

        {/* Dollar → satellite currency spokes */}
        {satPos.map((p, k) => (
          <line
            key={k}
            x1={dollarC.x}
            y1={dollarC.y + 26}
            x2={p.x}
            y2={p.y - 20}
            stroke={broken ? 'var(--color-ink-300)' : 'var(--color-accent-500)'}
            strokeWidth={broken ? 1.5 : 3}
            strokeDasharray={broken ? '4 6' : undefined}
            style={{ transition: 'all 600ms ease' }}
          />
        ))}

        {/* Gold node */}
        <g style={{ transition: 'all 600ms ease' }}>
          <circle
            cx={goldPos.x}
            cy={goldPos.y}
            r={26}
            fill="#f6c453"
            stroke="#d4a017"
            strokeWidth={2}
            opacity={broken ? 0.5 : 1}
          />
          <text x={goldPos.x} y={goldPos.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#7a5c00">
            {goldLabel}
          </text>
        </g>

        {/* Dollar node */}
        <circle cx={dollarC.x} cy={dollarC.y} r={30} fill="var(--color-brand-600)" />
        <text x={dollarC.x} y={dollarC.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
          {dollarLabel}
        </text>

        {/* Satellite currency nodes */}
        {satPos.map((p, k) => (
          <g key={k}>
            <circle
              cx={p.x}
              cy={p.y}
              r={18}
              fill="var(--color-surface)"
              stroke="var(--color-accent-500)"
              strokeWidth={2}
            />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-accent-700)">
              {sat[k]}
            </text>
          </g>
        ))}
      </svg>

      <p className="mt-1 text-sm leading-relaxed text-ink-700" aria-live="polite">
        {broken ? afterNote : beforeNote}
      </p>

      <div className="mt-4">
        <button
          type="button"
          aria-pressed={broken}
          onClick={() => setBroken((b) => !b)}
          aria-describedby={`${id}-note`}
          className={cx(
            'rounded-pill px-4 py-2 text-sm font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            broken ? 'bg-brand-600 hover:bg-brand-700' : 'bg-accent-600 hover:bg-accent-700',
          )}
        >
          {broken ? resetLabel : breakLabel}
        </button>
      </div>
    </figure>
  );
}

export default GoldPegDiagram;
