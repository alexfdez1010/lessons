import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface FragilityTriadProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the volatility / disorder slider. */
  volatilityLabel?: string;
  /** Label for the Fragile trajectory (Sword of Damocles). */
  fragileLabel?: string;
  /** Label for the Robust trajectory (Phoenix). */
  robustLabel?: string;
  /** Label for the Antifragile trajectory (Hydra). */
  antifragileLabel?: string;
  /** Note under the Fragile panel. */
  fragileNote?: string;
  /** Note under the Robust panel. */
  robustNote?: string;
  /** Note under the Antifragile panel. */
  antifragileNote?: string;
  /** Axis / readout label for each outcome value. */
  outcomeLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial volatility as a fraction (0–1). Defaults to `0.45`. */
  volatility?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Signed integer with an explicit + / − sign (and a real minus glyph). */
const signed = (value: number): string => {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return `−${Math.abs(rounded)}`;
  return '0';
};

type Kind = 'fragile' | 'robust' | 'antifragile';

interface Triad {
  kind: Kind;
  label: string;
  note: string;
  /** Outcome at volatility v∈[0,1], on a −100…+100 scale. */
  outcome: (v: number) => number;
  /** Response sign description for the badge. */
  sign: '−' | '0' | '+';
  /** SVG glyph for the avatar. */
  avatar: 'damocles' | 'phoenix' | 'hydra';
}

// Three responses to disorder on a shared −100…+100 outcome scale.
//   Fragile  — concave: loses, and loses faster, as volatility rises.
//   Robust   — flat: indifferent to volatility.
//   Antifragile — convex: gains, and gains faster, as volatility rises.
const FRAGILE = (v: number): number => -100 * v * v;
const ROBUST = (): number => 0;
const ANTIFRAGILE = (v: number): number => 100 * v * v;

export function FragilityTriad({
  title = 'Fragile, Robust, Antifragile',
  volatilityLabel = 'Volatility / disorder',
  fragileLabel = 'Fragile (Sword of Damocles)',
  robustLabel = 'Robust (Phoenix)',
  antifragileLabel = 'Antifragile (Hydra)',
  fragileNote = 'Harmed by disorder — concave',
  robustNote = 'Unaffected — indifferent',
  antifragileNote = 'Gains from disorder — convex',
  outcomeLabel = 'Outcome',
  caption = "Volatility doesn't have one fate. The fragile thing loses more from a big shock than it gains (concave); the robust thing shrugs (flat); the antifragile thing gains more than it loses (convex). The opposite of fragile is not robust — robust is the middle. The opposite of fragile is antifragile.",
  volatility = 0.45,
  className,
}: FragilityTriadProps) {
  const id = useId();
  const [vol, setVol] = useState(volatility);

  const triads: Triad[] = [
    {
      kind: 'fragile',
      label: fragileLabel,
      note: fragileNote,
      outcome: FRAGILE,
      sign: '−',
      avatar: 'damocles',
    },
    {
      kind: 'robust',
      label: robustLabel,
      note: robustNote,
      outcome: ROBUST,
      sign: '0',
      avatar: 'phoenix',
    },
    {
      kind: 'antifragile',
      label: antifragileLabel,
      note: antifragileNote,
      outcome: ANTIFRAGILE,
      sign: '+',
      avatar: 'hydra',
    },
  ];

  // Per-kind token colors (kept as CSS-var strings so SVG fills stay on-token).
  const stroke: Record<Kind, string> = {
    fragile: 'var(--color-danger)',
    robust: 'var(--color-ink-500)',
    antifragile: 'var(--color-success)',
  };

  // ---- Shared mini-chart geometry (outcome vs volatility) -----------------
  const W = 160;
  const H = 120;
  const padX = 10;
  const padY = 12;
  const SAMPLES = 40;

  const x = (v: number) => padX + v * (W - padX * 2);
  // Outcome −100…+100 maps to bottom…top.
  const y = (o: number) => padY + (1 - (o + 100) / 200) * (H - padY * 2);

  const curvePath = (fn: (v: number) => number): string => {
    let d = `M ${x(0)} ${y(fn(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const v = i / SAMPLES;
      d += ` L ${x(v)} ${y(fn(v))}`;
    }
    return d;
  };

  const reduced = prefersReducedMotion();
  const volPct = Math.round(vol * 100);
  const zeroY = y(0);

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
          {volatilityLabel}: {volPct}%
        </span>
      </figcaption>

      {/* Three payoff panels: outcome vs volatility, with a live marker. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {triads.map((t) => {
          const current = t.outcome(vol);
          const markerX = x(vol);
          const markerY = y(current);
          return (
            <div
              key={t.kind}
              className="rounded-card border border-ink-100 bg-surface-sunken/40 p-3"
            >
              <div className="flex items-center gap-2">
                <Avatar avatar={t.avatar} color={stroke[t.kind]} />
                <span className="text-sm font-semibold text-ink-900">
                  {t.label}
                </span>
              </div>

              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="mt-2 w-full"
                role="img"
                aria-label={`${t.label}: at ${volPct}% volatility the ${outcomeLabel.toLowerCase()} is ${signed(
                  current,
                )}.`}
              >
                {/* Zero baseline */}
                <line
                  x1={padX}
                  y1={zeroY}
                  x2={W - padX}
                  y2={zeroY}
                  stroke="var(--color-ink-200)"
                  strokeDasharray="4 4"
                />
                {/* Response curve */}
                <path
                  d={curvePath(t.outcome)}
                  fill="none"
                  stroke={stroke[t.kind]}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={
                    reduced
                      ? undefined
                      : { transition: 'd 0.3s ease' }
                  }
                />
                {/* Vertical drop line at the chosen volatility */}
                <line
                  x1={markerX}
                  y1={zeroY}
                  x2={markerX}
                  y2={markerY}
                  stroke="var(--color-ink-400)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                {/* Live marker on the curve */}
                <circle
                  cx={markerX}
                  cy={markerY}
                  r={5}
                  fill={stroke[t.kind]}
                  stroke="var(--color-surface, #fff)"
                  strokeWidth={2}
                />
              </svg>

              {/* Per-kind readout */}
              <div
                className="mt-2 flex items-baseline justify-between"
                aria-live="polite"
              >
                <span className="text-xs text-ink-500">{outcomeLabel}</span>
                <span
                  className="font-mono text-xl font-semibold"
                  style={{ color: stroke[t.kind] }}
                >
                  {signed(current)}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-600">
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-pill font-mono text-[0.7rem] font-bold text-white"
                  style={{ backgroundColor: stroke[t.kind] }}
                  aria-hidden="true"
                >
                  {t.sign}
                </span>
                {t.note}
              </p>
            </div>
          );
        })}
      </div>

      {/* Volatility slider */}
      <div className="mt-5">
        <label
          htmlFor={`${id}-vol`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{volatilityLabel}</span>
          <span className="font-mono text-ink-900">{volPct}%</span>
        </label>
        <input
          id={`${id}-vol`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={volPct}
          onChange={(e) => setVol(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

/** Tiny on-token avatar glyphs for each member of the triad. */
function Avatar({
  avatar,
  color,
}: {
  avatar: 'damocles' | 'phoenix' | 'hydra';
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {avatar === 'damocles' && (
        <>
          {/* Sword of Damocles: a thread holding a blade that points down. */}
          <line x1="12" y1="2" x2="12" y2="6" strokeDasharray="2 2" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <path d="M12 7 L12 19 L10 17 M12 19 L14 17" />
        </>
      )}
      {avatar === 'phoenix' && (
        <>
          {/* Phoenix: a bird rising — body with two swept wings. */}
          <path d="M12 20 C9 16 6 16 4 13 C8 14 10 12 12 8 C14 12 16 14 20 13 C18 16 15 16 12 20 Z" />
          <line x1="12" y1="8" x2="12" y2="4" />
        </>
      )}
      {avatar === 'hydra' && (
        <>
          {/* Hydra: three necks rising from one body (cut one, more grow). */}
          <path d="M12 21 C9 18 8 16 8 13" />
          <path d="M12 21 C12 17 12 15 12 11" />
          <path d="M12 21 C15 18 16 16 16 13" />
          <circle cx="8" cy="11" r="1.6" />
          <circle cx="12" cy="9" r="1.6" />
          <circle cx="16" cy="11" r="1.6" />
        </>
      )}
    </svg>
  );
}

export default FragilityTriad;
