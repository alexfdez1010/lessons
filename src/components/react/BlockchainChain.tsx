import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BlockchainChainProps {
  /** Heading above the chain. */
  title?: string;
  /** Short label for each block; the array length sets how many blocks render. */
  blocks?: string[];
  /** Label for the data area inside a block. */
  dataLabel?: string;
  /** Label for a block's own fingerprint stripe. */
  hashLabel?: string;
  /** Label for the embedded previous-block fingerprint. */
  prevHashLabel?: string;
  /** Text on the per-block tamper button. */
  tamperLabel?: string;
  /** Text on the repair button. */
  repairLabel?: string;
  /** Status text when the whole chain is intact. */
  validLabel?: string;
  /** Status text when a block (and everything after it) is broken. */
  brokenLabel?: string;
  /** One-line takeaway shown under the chain. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Number of colored cells in each abstract fingerprint stripe. */
const STRIPE_CELLS = 6;

/** A small palette of design-token hues the fingerprint cells cycle through. */
const FINGERPRINT_HUES = [
  'var(--color-brand-500)',
  'var(--color-brand-600)',
  'var(--color-accent-500)',
  'var(--color-brand-400)',
  'var(--color-accent-600)',
];

/**
 * Derive an abstract fingerprint: a list of palette indices seeded from a
 * block index plus a "salt" that changes when the block is tampered. This is a
 * purely visual stand-in for a hash — no hex, no digits are ever shown.
 */
const fingerprint = (seed: number): number[] => {
  const cells: number[] = [];
  let state = (seed * 2654435761) >>> 0;
  for (let i = 0; i < STRIPE_CELLS; i++) {
    state = (state ^ (state << 13)) >>> 0;
    state = (state ^ (state >> 17)) >>> 0;
    state = (state ^ (state << 5)) >>> 0;
    cells.push(state % FINGERPRINT_HUES.length);
  }
  return cells;
};

const DEFAULT_BLOCKS = ['Genesis', 'Block A', 'Block B', 'Block C'];

/**
 * Interactive blockchain teaching island. A row of linked blocks; each block
 * carries some data, its own abstract fingerprint (a colored stripe — never
 * hex or numbers), and an embedded copy of the *previous* block's fingerprint.
 * Tampering with a block reshuffles its fingerprint, which no longer matches
 * the copy stored in the next block — so that block and every block after it
 * flip to a broken/red state, cascading down the chain. "Repair" re-mines the
 * chain left→right back to fully valid. Respects `prefers-reduced-motion`
 * (jumps straight to the resolved state with no propagation animation).
 */
export function BlockchainChain({
  title = 'Each block locks in the one before it',
  blocks = DEFAULT_BLOCKS,
  dataLabel = 'Data',
  hashLabel = 'Fingerprint',
  prevHashLabel = 'Previous fingerprint',
  tamperLabel = 'Tamper',
  repairLabel = 'Re-mine the chain',
  validLabel = 'Chain valid — every block matches the one before it.',
  brokenLabel = 'Tampering broke this block and everything after it.',
  caption = 'A block stores a fingerprint of its own contents and a copy of the previous block’s fingerprint. Change one block and its fingerprint shifts, so the next block’s stored copy no longer matches — and the break cascades down the whole chain.',
  className,
}: BlockchainChainProps) {
  const id = useId();
  const count = blocks.length;

  // Index of the first tampered block, or null when the chain is pristine.
  const [tamperedFrom, setTamperedFrom] = useState<number | null>(null);
  // How far a heal/break animation has propagated (cells revealed left→right).
  const [healedUpTo, setHealedUpTo] = useState(count);
  const rafRef = useRef<number | null>(null);

  // A block is "broken" if it is the tampered block or sits after one, AND the
  // heal animation hasn't yet reached it.
  const isBroken = (index: number): boolean =>
    tamperedFrom !== null && index >= tamperedFrom && index >= healedUpTo;

  const animateHeal = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (prefersReducedMotion()) {
      setHealedUpTo(count);
      setTamperedFrom(null);
      return;
    }
    setHealedUpTo(0);
    const perBlock = 260;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const reached = Math.min(count, Math.floor((ts - startTs) / perBlock) + 1);
      setHealedUpTo(reached);
      if (reached < count) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setTamperedFrom(null);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const handleTamper = (index: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setHealedUpTo(count); // cancel any heal in flight
    setTamperedFrom(index);
  };

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const anyBroken = blocks.some((_, i) => isBroken(i));
  const statusText = anyBroken ? brokenLabel : validLabel;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button
          type="button"
          onClick={animateHeal}
          disabled={!anyBroken}
          className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {repairLabel}
        </button>
      </figcaption>

      <div
        className="mt-4 flex items-stretch gap-1 overflow-x-auto pb-2"
        role="img"
        aria-label={`${title}. ${statusText}`}
      >
        {blocks.map((label, index) => {
          const broken = isBroken(index);
          // Each block's own fingerprint shifts when it is the tampered block.
          const ownSeed = index + (index === tamperedFrom ? STRIPE_CELLS * 7 : 0);
          const ownStripe = fingerprint(ownSeed);
          // The copy this block carries of the *previous* block's fingerprint
          // is the pristine version (it was recorded before any tampering).
          const prevStripe = index > 0 ? fingerprint(index - 1) : null;

          return (
            <div key={`${id}-block-${index}`} className="flex items-stretch gap-1">
              <div
                className={cx(
                  'flex w-36 shrink-0 flex-col gap-2 rounded-card border p-3 transition-colors',
                  broken
                    ? 'border-accent-500 bg-accent-500/5'
                    : 'border-ink-100 bg-surface-sunken/40',
                )}
              >
                <span
                  className={cx(
                    'text-sm font-semibold',
                    broken ? 'text-accent-600' : 'text-ink-900',
                  )}
                >
                  {label}
                </span>

                <div>
                  <span className="text-xs text-ink-500">{dataLabel}</span>
                  <div className="mt-1 flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-full rounded-pill bg-ink-200" />
                    <span className="h-1.5 w-2/3 rounded-pill bg-ink-200" />
                  </div>
                </div>

                {prevStripe && (
                  <div>
                    <span className="text-xs text-ink-500">{prevHashLabel}</span>
                    <Stripe cells={prevStripe} muted broken={false} />
                  </div>
                )}

                <div>
                  <span
                    className={cx(
                      'text-xs',
                      broken ? 'text-accent-600' : 'text-ink-500',
                    )}
                  >
                    {hashLabel}
                  </span>
                  <Stripe cells={ownStripe} muted={false} broken={broken} />
                </div>

                <button
                  type="button"
                  onClick={() => handleTamper(index)}
                  className="mt-1 rounded-pill border border-ink-100 px-2 py-1 text-xs font-medium text-ink-700 transition hover:border-accent-500 hover:text-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {tamperLabel}
                </button>
              </div>

              {index < count - 1 && (
                <Connector broken={isBroken(index + 1)} />
              )}
            </div>
          );
        })}
      </div>

      <p
        className={cx(
          'mt-2 text-sm font-medium',
          anyBroken ? 'text-accent-600' : 'text-brand-700',
        )}
        aria-live="polite"
      >
        {statusText}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

/** Abstract fingerprint stripe — a row of small colored cells, never text. */
function Stripe({
  cells,
  muted,
  broken,
}: {
  cells: number[];
  muted: boolean;
  broken: boolean;
}) {
  return (
    <div className="mt-1 flex gap-0.5 overflow-hidden rounded-pill" aria-hidden="true">
      {cells.map((hue, i) => (
        <span
          key={i}
          className="h-2.5 flex-1 transition-colors"
          style={{
            backgroundColor: broken
              ? 'var(--color-accent-500)'
              : FINGERPRINT_HUES[hue],
            opacity: muted ? 0.45 : 1,
          }}
        />
      ))}
    </div>
  );
}

/** The arrow carrying the previous fingerprint into the next block. */
function Connector({ broken }: { broken: boolean }) {
  const stroke = broken ? 'var(--color-accent-500)' : 'var(--color-brand-500)';
  return (
    <svg
      viewBox="0 0 32 96"
      className="h-auto w-6 shrink-0 self-center"
      role="img"
      aria-hidden="true"
    >
      {broken ? (
        // Broken link: a gap with a small jagged break.
        <>
          <line x1={2} y1={48} x2={12} y2={48} stroke={stroke} strokeWidth={3} strokeLinecap="round" />
          <path
            d="M12 40 L18 48 L12 56"
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <line x1={20} y1={48} x2={30} y2={48} stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeDasharray="3 4" />
        </>
      ) : (
        // Intact link: a solid arrow pointing into the next block.
        <>
          <line x1={2} y1={48} x2={24} y2={48} stroke={stroke} strokeWidth={3} strokeLinecap="round" />
          <path
            d="M22 42 L30 48 L22 54"
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export default BlockchainChain;
