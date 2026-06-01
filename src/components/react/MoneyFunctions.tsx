import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One of money's three jobs, with a card blurb and a tiny worked example. */
export interface MoneyFunction {
  /** Short name shown on the selectable card (e.g. "Medium of exchange"). */
  name: string;
  /** One-line description of what the job means. */
  blurb: string;
  /** Concrete illustrative example, surfaced when the card is selected. */
  example: string;
}

export interface MoneyFunctionsProps {
  /** Heading above the cards. */
  title?: string;
  /** One-line takeaway shown under the illustration. */
  caption?: string;
  /**
   * The three jobs of money. Defaults to the canonical trio:
   * medium of exchange, store of value, unit of account.
   */
  functions?: [MoneyFunction, MoneyFunction, MoneyFunction];
  /** Hint shown above the cards telling the learner to pick one. */
  selectHint?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_FUNCTIONS: [MoneyFunction, MoneyFunction, MoneyFunction] = [
  {
    name: 'Medium of exchange',
    blurb: 'Everyone accepts it, so you trade through money instead of swapping goods directly.',
    example: 'Hand over money, walk away with the coffee — no haggling over what to barter.',
  },
  {
    name: 'Store of value',
    blurb: 'It holds its worth over time, so you can earn now and spend later.',
    example: 'Tuck money away today; it still buys roughly the same loaf next month.',
  },
  {
    name: 'Unit of account',
    blurb: 'It is the shared yardstick that prices everything, so values are comparable.',
    example: 'A coffee, a coat and a car all carry one number — their price.',
  },
];

/** Distinct illustration per job. Each is a small, animated SVG scene. */
type SceneKind = 'exchange' | 'store' | 'unit';
const SCENES: SceneKind[] = ['exchange', 'store', 'unit'];

/**
 * Teaches money's three jobs — medium of exchange, store of value, unit of
 * account — as three selectable cards. Picking a card swaps in a tiny animated
 * scene that *shows* that job: a coin sliding from buyer to seller (exchange),
 * a coin holding steady while time ticks past (store), and three goods snapping
 * onto one shared price scale (unit). The active card's example is announced via
 * an `aria-live` region. Fully keyboard operable (the cards are a radio group,
 * arrow keys move between them). Respects `prefers-reduced-motion` by rendering
 * each scene in its final, static state.
 */
export function MoneyFunctions({
  title = "Money's three jobs",
  caption = 'One thing, three jobs: money lets you trade (medium of exchange), carry value into the future (store of value) and price everything on one scale (unit of account).',
  functions = DEFAULT_FUNCTIONS,
  selectHint = 'Pick a job to see it in action',
  className,
}: MoneyFunctionsProps) {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0); // bump to re-key the scene → replays animation
  const reduced = prefersReducedMotion();
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Replay the scene animation each time the selection changes.
  useEffect(() => {
    if (reduced) return;
    setTick((t) => t + 1);
  }, [active, reduced]);

  const select = (next: number) => {
    setActive(((next % functions.length) + functions.length) % functions.length);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = functions.length - 1;
    if (next === null) return;
    event.preventDefault();
    const wrapped = ((next % functions.length) + functions.length) % functions.length;
    setActive(wrapped);
    cardRefs.current[wrapped]?.focus();
  };

  const activeFn = functions[active];
  const scene = SCENES[active] ?? 'exchange';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
      </figcaption>

      <p className="mt-1 text-sm text-ink-500">{selectHint}</p>

      {/* Selectable cards — a radio group for keyboard a11y. */}
      <div
        role="radiogroup"
        aria-label={title}
        className="mt-4 grid gap-3 sm:grid-cols-3"
      >
        {functions.map((fn, index) => {
          const isActive = index === active;
          return (
            <button
              key={fn.name}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cx(
                'rounded-card border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                isActive
                  ? 'border-brand-500 bg-brand-50 shadow-soft'
                  : 'border-ink-100 bg-surface hover:border-brand-300 hover:bg-surface-sunken/40',
              )}
            >
              <span
                className={cx(
                  'block font-medium',
                  isActive ? 'text-brand-700' : 'text-ink-900',
                )}
              >
                {fn.name}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-600">
                {fn.blurb}
              </span>
            </button>
          );
        })}
      </div>

      {/* Illustration of the selected job. */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 p-4">
        <svg
          key={tick}
          viewBox="0 0 360 120"
          className="w-full"
          role="img"
          aria-label={`${activeFn.name}: ${activeFn.example}`}
        >
          <Scene kind={scene} reduced={reduced} />
        </svg>
      </div>

      {/* Live example readout for the active job. */}
      <p
        className="mt-3 text-sm leading-relaxed text-ink-700"
        aria-live="polite"
      >
        <span className="font-medium text-ink-900">{activeFn.name}: </span>
        {activeFn.example}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

interface SceneProps {
  kind: SceneKind;
  reduced: boolean;
}

/** Renders the right animated mini-scene for the selected job. */
function Scene({ kind, reduced }: SceneProps) {
  if (kind === 'exchange') return <ExchangeScene reduced={reduced} />;
  if (kind === 'store') return <StoreScene reduced={reduced} />;
  return <UnitScene reduced={reduced} />;
}

/** A coin slides from the buyer to the seller — money lets the trade happen. */
function ExchangeScene({ reduced }: { reduced: boolean }) {
  const buyerX = 60;
  const sellerX = 300;
  return (
    <>
      <Figure x={buyerX} label="" emoji="🧑" />
      <Figure x={sellerX} label="" emoji="🧑‍🍳" />
      {/* path the coin travels */}
      <line
        x1={buyerX}
        y1={64}
        x2={sellerX}
        y2={64}
        stroke="var(--color-ink-200)"
        strokeDasharray="4 5"
      />
      <g transform={reduced ? `translate(${sellerX} 64)` : undefined}>
        {!reduced && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`${buyerX} 64; ${sellerX} 64`}
            keyTimes="0; 1"
            dur="1.4s"
            begin="0.2s"
            fill="freeze"
            calcMode="spline"
            keySplines="0.4 0 0.2 1"
          />
        )}
        <circle r={13} fill="var(--color-brand-500)" />
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontSize="13"
          fill="var(--color-surface)"
          fontWeight="700"
        >
          $
        </text>
      </g>
    </>
  );
}

/** A coin holds steady while a clock hand sweeps — value carried forward in time. */
function StoreScene({ reduced }: { reduced: boolean }) {
  return (
    <>
      {/* clock */}
      <g transform="translate(70 60)">
        <circle r={32} fill="none" stroke="var(--color-ink-200)" strokeWidth={3} />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-22}
          stroke="var(--color-ink-400)"
          strokeWidth={3}
          strokeLinecap="round"
        >
          {!reduced && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur="3s"
              repeatCount="indefinite"
            />
          )}
        </line>
        <circle r={3} fill="var(--color-ink-400)" />
      </g>
      {/* arrow: time passes */}
      <line
        x1={120}
        y1={60}
        x2={250}
        y2={60}
        stroke="var(--color-ink-200)"
        strokeDasharray="4 5"
      />
      <polygon points="250,55 260,60 250,65" fill="var(--color-ink-300)" />
      {/* the coin keeps its value */}
      <g transform="translate(300 60)">
        {!reduced && (
          <animate
            attributeName="opacity"
            values="0.5; 1; 0.5"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
        <circle r={20} fill="var(--color-brand-500)" />
        <text
          x={0}
          y={6}
          textAnchor="middle"
          fontSize="18"
          fill="var(--color-surface)"
          fontWeight="700"
        >
          $
        </text>
      </g>
    </>
  );
}

/** Three goods snap onto one shared price scale — the common yardstick. */
function UnitScene({ reduced }: { reduced: boolean }) {
  const goods = [
    { emoji: '☕', target: 40 },
    { emoji: '🧥', target: 170 },
    { emoji: '🚗', target: 300 },
  ];
  return (
    <>
      {/* the shared scale */}
      <line x1={20} y1={92} x2={340} y2={92} stroke="var(--color-ink-300)" strokeWidth={2} />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const x = 20 + t * 320;
        return (
          <line
            key={t}
            x1={x}
            y1={88}
            x2={x}
            y2={96}
            stroke="var(--color-ink-300)"
            strokeWidth={2}
          />
        );
      })}
      {goods.map((good, i) => (
        <g key={good.emoji} transform={`translate(${good.target} 50)`}>
          {!reduced && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`180 50; ${good.target} 50`}
              keyTimes="0; 1"
              dur="0.9s"
              begin={`${0.15 * i}s`}
              fill="freeze"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            />
          )}
          <text x={0} y={0} textAnchor="middle" fontSize="26">
            {good.emoji}
          </text>
          <line
            x1={0}
            y1={10}
            x2={0}
            y2={40}
            stroke="var(--color-brand-400)"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
          <circle cx={0} cy={42} r={4} fill="var(--color-brand-500)" />
        </g>
      ))}
    </>
  );
}

/** A simple standing figure (emoji) at a fixed x, used in the exchange scene. */
function Figure({ x, emoji }: { x: number; emoji: string; label: string }) {
  return (
    <text x={x} y={50} textAnchor="middle" fontSize="34">
      {emoji}
    </text>
  );
}

export default MoneyFunctions;
