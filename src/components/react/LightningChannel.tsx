import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LightningChannelProps {
  /** Heading above the channel. */
  title?: string;
  /** Name of the left-hand party. */
  aliceLabel?: string;
  /** Name of the right-hand party. */
  bobLabel?: string;
  /** Text on the open-channel button. */
  openLabel?: string;
  /** Text on the close-and-settle button. */
  closeLabel?: string;
  /** Text on the "Alice pays Bob" button. */
  payAliceToBobLabel?: string;
  /** Text on the "Bob pays Alice" button. */
  payBobToAliceLabel?: string;
  /** Text on the reset button. */
  resetLabel?: string;
  /** Label for the off-chain payment counter. */
  offChainCountLabel?: string;
  /** Label for the on-chain transaction counter. */
  onChainCountLabel?: string;
  /** Status text when the channel is closed. */
  channelClosedLabel?: string;
  /** Status text when the channel is open. */
  channelOpenLabel?: string;
  /** One-line takeaway shown under the channel. */
  caption?: string;
  /** Currency unit suffixed to balances. Defaults to `'BTC'`. */
  unitLabel?: string;
  /** Alice's starting balance / locked funds. Defaults to `0.05`. */
  aliceStart?: number;
  /** Bob's starting balance / locked funds. Defaults to `0.05`. */
  bobStart?: number;
  /** Amount moved per off-chain payment. Defaults to `0.01`. */
  step?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Format a balance with the unit, trimming float noise. */
const fmt = (value: number, unit: string): string =>
  `${Number(value.toFixed(3)).toString()} ${unit}`;

type ChannelState = 'closed' | 'open';

/**
 * Interactive Lightning Network payment-channel teaching island. Alice and Bob
 * lock funds on-chain to open a channel (1 on-chain tx), then send many instant
 * off-chain payments by sliding the balance back and forth inside the channel
 * (no on-chain tx per payment), and finally settle the net result on-chain when
 * they close (1 more on-chain tx). The two counters make the contrast vivid:
 * thousands of cheap off-chain payments ride on just two on-chain transactions.
 * The split point of the channel bar slides smoothly and a coin pulses across in
 * the payment direction. Respects `prefers-reduced-motion` (balances jump
 * instantly to their new values with no slide or pulse).
 */
export function LightningChannel({
  title = 'One channel, thousands of instant payments',
  aliceLabel = 'Alice',
  bobLabel = 'Bob',
  openLabel = 'Open channel (on-chain)',
  closeLabel = 'Close & settle (on-chain)',
  payAliceToBobLabel = 'Alice pays Bob',
  payBobToAliceLabel = 'Bob pays Alice',
  resetLabel = 'Reset',
  offChainCountLabel = 'Off-chain payments',
  onChainCountLabel = 'On-chain transactions',
  channelClosedLabel = 'Channel closed — open it on-chain to start paying.',
  channelOpenLabel = 'Channel open — pay back and forth, instantly and off-chain.',
  caption = 'Opening and closing a channel are the only two on-chain transactions. Between them, Alice and Bob can shift the balance back and forth thousands of times — each payment is instant, off-chain, and nearly free.',
  unitLabel = 'BTC',
  aliceStart = 0.05,
  bobStart = 0.05,
  step = 0.01,
  className,
}: LightningChannelProps) {
  const id = useId();

  const [channel, setChannel] = useState<ChannelState>('closed');
  const [alice, setAlice] = useState(aliceStart);
  const [bob, setBob] = useState(bobStart);
  const [offChain, setOffChain] = useState(0);
  const [onChain, setOnChain] = useState(0);
  // Direction of the pulse currently animating: +1 = Alice→Bob, -1 = Bob→Alice.
  const [pulse, setPulse] = useState<0 | 1 | -1>(0);
  const pulseTimer = useRef<number | null>(null);

  const capacity = aliceStart + bobStart;
  const isOpen = channel === 'open';
  const alicePct = capacity > 0 ? (alice / capacity) * 100 : 50;

  const statusText = isOpen ? channelOpenLabel : channelClosedLabel;

  const clearPulse = () => {
    if (pulseTimer.current !== null) {
      window.clearTimeout(pulseTimer.current);
      pulseTimer.current = null;
    }
  };

  const firePulse = (direction: 1 | -1) => {
    if (prefersReducedMotion()) return;
    clearPulse();
    setPulse(direction);
    pulseTimer.current = window.setTimeout(() => {
      setPulse(0);
      pulseTimer.current = null;
    }, 700);
  };

  const handleOpen = () => {
    setChannel('open');
    setOnChain((n) => n + 1);
  };

  const handleClose = () => {
    clearPulse();
    setPulse(0);
    setChannel('closed');
    setOnChain((n) => n + 1);
  };

  const pay = (direction: 1 | -1) => {
    if (!isOpen) return;
    if (direction === 1) {
      if (alice < step) return;
      setAlice((a) => a - step);
      setBob((b) => b + step);
    } else {
      if (bob < step) return;
      setBob((b) => b - step);
      setAlice((a) => a + step);
    }
    setOffChain((n) => n + 1);
    firePulse(direction);
  };

  const handleReset = () => {
    clearPulse();
    setPulse(0);
    setChannel('closed');
    setAlice(aliceStart);
    setBob(bobStart);
    setOffChain(0);
    setOnChain(0);
  };

  useEffect(
    () => () => {
      clearPulse();
    },
    [],
  );

  const reduced = prefersReducedMotion();
  const canPayAtoB = isOpen && alice >= step;
  const canPayBtoA = isOpen && bob >= step;

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            isOpen ? 'bg-brand-600' : 'bg-ink-400',
          )}
        >
          {isOpen ? channelOpenLabel.split('—')[0].trim() : channelClosedLabel.split('—')[0].trim()}
        </span>
      </figcaption>

      {/* Parties */}
      <div className="mt-4 flex items-end justify-between text-sm">
        <div className="flex flex-col">
          <span className="font-semibold text-brand-700">{aliceLabel}</span>
          <span className="font-mono text-lg font-semibold text-ink-900" aria-live="polite">
            {fmt(alice, unitLabel)}
          </span>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="font-semibold text-accent-600">{bobLabel}</span>
          <span className="font-mono text-lg font-semibold text-ink-900" aria-live="polite">
            {fmt(bob, unitLabel)}
          </span>
        </div>
      </div>

      {/* Channel bar */}
      <div
        className="relative mt-3 h-8 overflow-hidden rounded-pill bg-surface-sunken"
        role="img"
        aria-label={`${aliceLabel} ${fmt(alice, unitLabel)}, ${bobLabel} ${fmt(
          bob,
          unitLabel,
        )}. ${statusText}`}
      >
        {/* Alice's share (left) */}
        <div
          className={cx(
            'absolute inset-y-0 left-0 bg-brand-500',
            !reduced && 'transition-[width] duration-500 ease-out',
          )}
          style={{ width: `${alicePct}%` }}
          aria-hidden="true"
        />
        {/* Bob's share (right) */}
        <div
          className={cx(
            'absolute inset-y-0 right-0 bg-accent-500',
            !reduced && 'transition-[width] duration-500 ease-out',
          )}
          style={{ width: `${100 - alicePct}%` }}
          aria-hidden="true"
        />
        {/* Split marker */}
        <div
          className={cx(
            'absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-surface',
            !reduced && 'transition-[left] duration-500 ease-out',
          )}
          style={{ left: `${alicePct}%` }}
          aria-hidden="true"
        />
        {/* Coin pulse travelling in the payment direction */}
        {pulse !== 0 && (
          <span
            key={`${id}-pulse-${offChain}`}
            className={cx(
              'absolute top-1/2 z-20 h-4 w-4 -translate-y-1/2 rounded-pill bg-white shadow-soft',
              pulse === 1
                ? 'animate-[lc-pulse-right_0.7s_ease-in-out]'
                : 'animate-[lc-pulse-left_0.7s_ease-in-out]',
            )}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Inline keyframes for the coin pulse (token-driven colors, no raw hex). */}
      <style>{`
        @keyframes lc-pulse-right {
          0% { left: 6%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 90%; opacity: 0; }
        }
        @keyframes lc-pulse-left {
          0% { left: 90%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 6%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*='animate-[lc-pulse'] { animation: none !important; }
        }
      `}</style>

      <p
        className={cx(
          'mt-3 text-sm font-medium',
          isOpen ? 'text-brand-700' : 'text-ink-600',
        )}
        aria-live="polite"
      >
        {statusText}
      </p>

      {/* Channel lifecycle + payment controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={isOpen}
          className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {openLabel}
        </button>
        <button
          type="button"
          onClick={() => pay(1)}
          disabled={!canPayAtoB}
          className="rounded-pill border border-brand-200 px-3 py-1 text-sm font-medium text-brand-700 transition hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {payAliceToBobLabel}
        </button>
        <button
          type="button"
          onClick={() => pay(-1)}
          disabled={!canPayBtoA}
          className="rounded-pill border border-accent-200 px-3 py-1 text-sm font-medium text-accent-600 transition hover:border-accent-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {payBobToAliceLabel}
        </button>
        <button
          type="button"
          onClick={handleClose}
          disabled={!isOpen}
          className="rounded-pill bg-ink-700 px-3 py-1 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {closeLabel}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-pill border border-ink-100 px-3 py-1 text-sm font-medium text-ink-700 transition hover:border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      {/* Counters — the vivid contrast */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{offChainCountLabel}</dt>
          <dd className="font-mono text-2xl font-semibold text-brand-700">{offChain}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{onChainCountLabel}</dt>
          <dd className="font-mono text-2xl font-semibold text-accent-600">{onChain}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LightningChannel;
