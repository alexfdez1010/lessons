import { useEffect, useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single field of a transaction shown in the {@link LedgerReveal} ledger row. */
export interface LedgerField {
  /** Field name, e.g. "Sender". */
  label: string;
  /** The clear-text value shown on a transparent (Bitcoin) ledger. */
  value: string;
}

/** Props for the {@link LedgerReveal} component. */
export interface LedgerRevealProps {
  /** The four (or so) fields of the transaction. */
  fields: LedgerField[];
  /** Label for the transparent / public mode toggle. Defaults to `'Bitcoin (transparent)'`. */
  transparentLabel?: string;
  /** Label for the shielded / private mode toggle. Defaults to `'Zcash (shielded)'`. */
  shieldedLabel?: string;
  /** Caption under the row in transparent mode. */
  transparentCaption?: string;
  /** Caption under the row in shielded mode. */
  shieldedCaption?: string;
  /** Badge text shown in place of hidden values. Defaults to `'verified by zk-proof'`. */
  proofLabel?: string;
  /** Accessible name for the toggle group. Defaults to `'Ledger view'`. */
  groupLabel?: string;
  /** Extra classes merged onto the root element. */
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Side-by-side teaching toggle: the SAME payment shown two ways.
 *
 * In "transparent" (Bitcoin) mode every field — sender, receiver, amount, memo —
 * is printed in the clear, the way a public UTXO ledger records it. Flip to
 * "shielded" (Zcash) mode and each value is redacted behind a single
 * zero-knowledge proof badge: the network still verifies the payment is valid,
 * but learns none of the details. The redaction animates in (respecting
 * `prefers-reduced-motion`) so learners *see* the privacy being applied.
 */
export function LedgerReveal({
  fields,
  transparentLabel = 'Bitcoin (transparent)',
  shieldedLabel = 'Zcash (shielded)',
  transparentCaption = 'Anyone can read who paid whom, how much, and the note attached. Forever.',
  shieldedCaption = 'The network confirms the payment is valid — without seeing any of it.',
  proofLabel = 'verified by zk-proof',
  groupLabel = 'Ledger view',
  className,
}: LedgerRevealProps) {
  const [shielded, setShielded] = useState(false);
  const [reduced, setReduced] = useState(false);
  const id = useId();

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  return (
    <div
      className={cx(
        'rounded-card border border-ink-200 bg-surface p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      {/* Toggle */}
      <div
        role="tablist"
        aria-label={groupLabel}
        className="mb-5 inline-flex rounded-pill border border-ink-200 bg-surface-sunken/60 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!shielded}
          aria-controls={`${id}-panel`}
          onClick={() => setShielded(false)}
          className={cx(
            'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            !shielded ? 'bg-ink-900 text-white shadow-soft' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {transparentLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={shielded}
          aria-controls={`${id}-panel`}
          onClick={() => setShielded(true)}
          className={cx(
            'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            shielded ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {shieldedLabel}
        </button>
      </div>

      {/* Ledger row */}
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-live="polite"
        className={cx(
          'overflow-hidden rounded-card border transition-colors duration-300',
          shielded ? 'border-brand-200 bg-brand-50/50' : 'border-ink-200 bg-surface-sunken/40',
        )}
      >
        <dl className="divide-y divide-ink-100">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <dt className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-500">
                {field.label}
              </dt>
              <dd className="min-w-0 flex-1 text-right">
                {shielded ? (
                  <span
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-pill bg-brand-100 px-3 py-1 font-mono text-xs font-semibold text-brand-700',
                      !reduced && 'animate-fade-up',
                    )}
                  >
                    <span aria-hidden>🛡️</span>
                    <span className="tracking-widest">•••••••</span>
                  </span>
                ) : (
                  <span className="break-all font-mono text-sm text-ink-800">
                    {field.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* Proof badge — only in shielded mode */}
        {shielded && (
          <div
            className={cx(
              'flex items-center gap-2 border-t border-brand-200 bg-brand-100/60 px-4 py-2.5',
              !reduced && 'animate-fade-up',
            )}
          >
            <span
              aria-hidden
              className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
            >
              ✓
            </span>
            <span className="font-mono text-xs font-semibold text-brand-700">
              {proofLabel}
            </span>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">
        {shielded ? shieldedCaption : transparentCaption}
      </p>
    </div>
  );
}

export default LedgerReveal;
