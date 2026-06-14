import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AutocallLadderProps {
  /** Heading above the chart. */
  title?: string;
  /** Scenario button: redeems early on the first observation. */
  earlyLabel?: string;
  /** Scenario button: pays coupons and returns par at maturity. */
  incomeLabel?: string;
  /** Scenario button: protection barrier is breached → capital loss. */
  lossLabel?: string;
  /** Reference-line label for the autocall barrier. */
  autocallLineLabel?: string;
  /** Reference-line label for the coupon barrier. */
  couponLineLabel?: string;
  /** Reference-line label for the protection (knock-in) barrier. */
  protectionLineLabel?: string;
  /** Prefix for each observation column (e.g. "Year"). */
  yearLabel?: string;
  /** Label for the y-axis (underlying as % of its start). */
  levelAxisLabel?: string;
  /** Heading for the per-observation outcome list. */
  outcomesLabel?: string;
  /** Heading for the total-return readout. */
  totalLabel?: string;
  /** Short status word: this period paid a coupon. */
  couponWord?: string;
  /** Short status word: this period was autocalled. */
  autocallWord?: string;
  /** Short status word: nothing happened this period. */
  skipWord?: string;
  /** Short status word: the protection barrier broke at maturity. */
  breachWord?: string;
  /** Note rendered under the early-autocall scenario. */
  earlyNote?: string;
  /** Note rendered under the income scenario. */
  incomeNote?: string;
  /** Note rendered under the capital-loss scenario. */
  lossNote?: string;
  className?: string;
}

type Kind = 'coupon' | 'autocall' | 'skip' | 'breach' | 'par';

interface Obs {
  /** Underlying level as % of its starting value. */
  level: number;
  kind: Kind;
  /** Cash received at this observation (% of notional). */
  cash: number;
  /** Whether the trade has already redeemed before this date (greyed out). */
  ended?: boolean;
  /** Short human note for the outcome list. */
  note: string;
}

interface Scenario {
  obs: Obs[];
  total: number;
}

const AUTOCALL = 100;
const COUPON_BARRIER = 70;
const PROTECTION = 60;

/** Three hand-built autocallable life-cycles on a 4-year, 8%-coupon note. */
const SCENARIOS: Record<'early' | 'income' | 'loss', Scenario> = {
  early: {
    obs: [
      { level: 105, kind: 'autocall', cash: 108, note: '105 ≥ 100 → autocalled: principal + one coupon, 100 + 8 = 108. Trade over.' },
      { level: 0, kind: 'skip', cash: 0, ended: true, note: 'Already redeemed at Year 1 — never observed.' },
      { level: 0, kind: 'skip', cash: 0, ended: true, note: 'Already redeemed at Year 1 — never observed.' },
      { level: 0, kind: 'skip', cash: 0, ended: true, note: 'Already redeemed at Year 1 — never observed.' },
    ],
    total: 108,
  },
  income: {
    obs: [
      { level: 85, kind: 'coupon', cash: 8, note: '85 < 100 (no autocall) but ≥ 70 → coupon of 8 paid.' },
      { level: 72, kind: 'coupon', cash: 8, note: '72 < 100 but ≥ 70 → coupon of 8 paid.' },
      { level: 65, kind: 'skip', cash: 0, note: '65 < 70 → no coupon. With memory it is not lost, just deferred.' },
      { level: 95, kind: 'par', cash: 116, note: 'Maturity: 95 ≥ 70 → coupon plus the deferred Year-3 coupon (16), and 95 ≥ 60 so principal 100 returns in full.' },
    ],
    total: 132,
  },
  loss: {
    obs: [
      { level: 80, kind: 'coupon', cash: 8, note: '80 ≥ 70 → coupon of 8 paid.' },
      { level: 64, kind: 'skip', cash: 0, note: '64 < 70 → no coupon (deferred under memory).' },
      { level: 58, kind: 'skip', cash: 0, note: '58 < 70 → no coupon, and now below the protection barrier.' },
      { level: 52, kind: 'breach', cash: 52, note: 'Maturity: 52 < 60 → protection breaks. Redemption tracks the underlying 1:1: get back 52, a 48-point capital loss.' },
    ],
    total: 60,
  },
};

const KIND_TINT: Record<Kind, string> = {
  coupon: 'var(--color-brand-500)',
  autocall: 'var(--color-brand-600)',
  par: 'var(--color-brand-600)',
  skip: 'var(--color-ink-300)',
  breach: 'var(--color-accent-600)',
};

/**
 * Autocallable note life-cycle ladder. An autocallable is a structured note that
 * checks the underlying on scheduled observation dates against three levels: an
 * **autocall barrier** (clear it and the note redeems early with its coupons), a
 * **coupon barrier** (clear it and a — often *memory* — coupon is paid), and a
 * **protection barrier** (a deep down-level that, if breached at maturity, turns
 * the note into a 1:1 long position in a falling underlying). The three scenarios
 * walk the same note through an early redemption, a coupon-then-par path, and a
 * protection breach that hands the investor a capital loss — making vivid that
 * the high headline coupon is really the premium on a sold down-and-in put.
 */
export function AutocallLadder({
  title = 'Autocallable note: three ways it can end',
  earlyLabel = 'Autocalled early',
  incomeLabel = 'Coupons, par at maturity',
  lossLabel = 'Barrier breached → loss',
  autocallLineLabel = 'Autocall 100%',
  couponLineLabel = 'Coupon 70%',
  protectionLineLabel = 'Protection 60%',
  yearLabel = 'Year',
  levelAxisLabel = 'Underlying (% of start)',
  outcomesLabel = 'What happens each observation',
  totalLabel = 'Total cash returned (per 100 invested)',
  couponWord = 'Coupon',
  autocallWord = 'Autocalled',
  skipWord = 'No coupon',
  breachWord = 'Capital loss',
  earlyNote = 'The friendliest outcome — and the most common. The underlying is at or above its start on the first observation, so the note redeems early: you get your principal back plus one coupon and the trade is done. High coupon, short life. The catch is reinvestment risk: your money comes back precisely when markets are calm and yields are low.',
  incomeNote = 'The underlying sags but stays above the coupon barrier often enough to keep paying. The MEMORY feature rescues the missed Year-3 coupon at maturity, and because the final level holds above the protection barrier, principal returns in full. This is the outcome the glossy brochure quietly assumes.',
  lossNote = 'The trap. A couple of coupons land early and feel like free money — then the underlying slides through the protection barrier and stays there. At maturity the note converts into the falling underlying one-for-one: you eat a 48% capital loss, barely offset by that single early coupon. You were short a deep down-and-in put the entire time; this is the day it is exercised against you.',
  className,
}: AutocallLadderProps) {
  const [key, setKey] = useState<'early' | 'income' | 'loss'>('income');
  const sc = SCENARIOS[key];

  const W = 520;
  const H = 260;
  const padX = 48;
  const padY = 24;
  const minL = 40;
  const maxL = 120;

  const cols = sc.obs.length;
  const x = (i: number) => padX + ((i + 0.5) / cols) * (W - padX * 2);
  const yL = (l: number) => padY + (1 - (l - minL) / (maxL - minL)) * (H - padY * 2);

  const livePts = sc.obs
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => !o.ended);

  const linePath = livePts
    .map(({ o, i }, k) => `${k === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yL(o.level).toFixed(1)}`)
    .join(' ');

  const refLines: Array<{ level: number; label: string; tint: string }> = [
    { level: AUTOCALL, label: autocallLineLabel, tint: 'var(--color-brand-400)' },
    { level: COUPON_BARRIER, label: couponLineLabel, tint: 'var(--color-ink-300)' },
    { level: PROTECTION, label: protectionLineLabel, tint: 'var(--color-accent-500)' },
  ];

  const buttons: Array<{ k: 'early' | 'income' | 'loss'; label: string }> = [
    { k: 'early', label: earlyLabel },
    { k: 'income', label: incomeLabel },
    { k: 'loss', label: lossLabel },
  ];

  const note = key === 'early' ? earlyNote : key === 'income' ? incomeNote : lossNote;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div className="inline-flex flex-wrap rounded-pill border border-ink-200 p-0.5" role="group">
          {buttons.map((b) => (
            <button
              key={b.k}
              type="button"
              onClick={() => setKey(b.k)}
              aria-pressed={key === b.k}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
                key === b.k ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: ${
          key === 'early' ? earlyLabel : key === 'income' ? incomeLabel : lossLabel
        }. Total cash returned is ${sc.total} per 100 invested.`}
      >
        {/* Reference barriers */}
        {refLines.map((r) => (
          <g key={r.label}>
            <line
              x1={padX}
              y1={yL(r.level)}
              x2={W - padX}
              y2={yL(r.level)}
              stroke={r.tint}
              strokeWidth={1.25}
              strokeDasharray="6 4"
            />
            <text x={W - padX} y={yL(r.level) - 4} textAnchor="end" fontSize={9.5} fontWeight={600} fill={r.tint}>
              {r.label}
            </text>
          </g>
        ))}

        {/* Underlying path through live observations */}
        {livePts.length > 1 && (
          <path
            key={key}
            d={linePath}
            fill="none"
            stroke="var(--color-ink-400)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="transition-all duration-500 motion-reduce:transition-none"
          />
        )}

        {/* Observation dots + year ticks */}
        {sc.obs.map((o, i) => (
          <g key={i} opacity={o.ended ? 0.28 : 1}>
            {!o.ended && (
              <circle cx={x(i)} cy={yL(o.level)} r={6} fill={KIND_TINT[o.kind]} stroke="white" strokeWidth={1.5} />
            )}
            <text x={x(i)} y={H - padY + 14} textAnchor="middle" fontSize={10} fill="var(--color-ink-500)">
              {yearLabel} {i + 1}
            </text>
            {!o.ended && (
              <text
                x={x(i)}
                y={yL(o.level) - 11}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--color-ink-700)"
              >
                {o.level}
              </text>
            )}
          </g>
        ))}

        <text x={padX - 10} y={padY - 10} fontSize={11} fill="var(--color-ink-500)">
          {levelAxisLabel}
        </text>
      </svg>

      <div className="mt-3">
        <p className="text-sm font-medium text-ink-800">{outcomesLabel}</p>
        <ol className="mt-2 space-y-1.5 text-sm">
          {sc.obs.map((o, i) => (
            <li key={i} className="flex gap-2 leading-relaxed text-ink-600">
              <span
                className={cx(
                  'mt-0.5 inline-flex h-5 shrink-0 items-center rounded-pill px-2 text-xs font-semibold',
                  o.kind === 'breach'
                    ? 'bg-accent-100 text-accent-700'
                    : o.kind === 'skip'
                      ? 'bg-ink-100 text-ink-600'
                      : 'bg-brand-100 text-brand-700',
                )}
              >
                {o.kind === 'autocall'
                  ? autocallWord
                  : o.kind === 'breach'
                    ? breachWord
                    : o.kind === 'skip'
                      ? skipWord
                      : couponWord}
              </span>
              <span>
                <strong className="font-medium text-ink-800">
                  {yearLabel} {i + 1}:
                </strong>{' '}
                {o.note}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div
        className={cx(
          'mt-3 rounded-card border px-4 py-3 text-sm font-medium',
          key === 'loss'
            ? 'border-accent-200 bg-accent-50 text-accent-800'
            : 'border-brand-200 bg-brand-50 text-brand-800',
        )}
        aria-live="polite"
      >
        {totalLabel}: <span className="font-mono font-semibold">{sc.total}</span>{' '}
        {key === 'loss' ? '(a net loss)' : key === 'early' ? '(in just one year)' : '(over four years)'}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600">{note}</p>
    </figure>
  );
}

export default AutocallLadder;
