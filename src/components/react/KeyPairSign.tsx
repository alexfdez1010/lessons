import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface KeyPairSignProps {
  /** Heading above the demo. */
  title?: string;
  /** Label for the message tile. */
  messageLabel?: string;
  /** Label for the private-key glyph (kept secret, used to sign). */
  privateKeyLabel?: string;
  /** Label for the public-key glyph (shared, used to verify). */
  publicKeyLabel?: string;
  /** Label for the "sign" button. */
  signLabel?: string;
  /** Label for the "verify" button. */
  verifyLabel?: string;
  /** Label for the "tamper" button. */
  tamperLabel?: string;
  /** Label for the "reset" button. */
  resetLabel?: string;
  /** Readout shown when verification succeeds. */
  validLabel?: string;
  /** Readout shown when verification fails after tampering. */
  invalidLabel?: string;
  /** Label for the signature tile. */
  signatureLabel?: string;
  /** One-line takeaway shown under the demo. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A small palette of design-token colours used to paint abstract "fingerprint"
// cells. No numbers ever surface to the learner — the seed only picks colours.
const PALETTE = [
  'var(--color-brand-500)',
  'var(--color-accent-500)',
  'var(--color-brand-600)',
  'var(--color-ink-300)',
  'var(--color-brand-400)',
  'var(--color-accent-600)',
];

const CELLS = 12;

// Deterministic colour pattern from a seed — a stand-in for a hash/digest,
// shown purely as coloured cells so the learner never sees raw bytes.
const fingerprint = (seed: number): string[] => {
  const out: string[] = [];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = 0; i < CELLS; i++) {
    s = (s * 16807) % 2147483647;
    out.push(PALETTE[s % PALETTE.length]);
  }
  return out;
};

type Phase = 'clean' | 'signed' | 'tampered';

/**
 * Asymmetric key pair + digital signature demo for a "Keys & wallets" lesson.
 * A message (shown as a fingerprint of coloured cells) is signed with the
 * PRIVATE key 🔒 to produce a distinct signature fingerprint; anyone can VERIFY
 * it with the matching PUBLIC key 🔓. If the message is tampered with after
 * signing, re-verification fails — because the signature no longer matches the
 * changed message. This is how a blockchain knows a transaction came from the
 * owner without the owner ever revealing the private key. Respects
 * `prefers-reduced-motion` (jumps straight to the signed state).
 */
export function KeyPairSign({
  title = 'Sign, then verify',
  messageLabel = 'Message',
  privateKeyLabel = 'Private key (kept secret)',
  publicKeyLabel = 'Public key (shared)',
  signLabel = 'Sign with private key 🔒',
  verifyLabel = 'Verify with public key 🔓',
  tamperLabel = 'Tamper with the message',
  resetLabel = 'Reset',
  validLabel = 'Valid signature',
  invalidLabel = 'Signature invalid — message was changed',
  signatureLabel = 'Signature',
  caption = 'Only the private key can produce the signature, but anyone can verify it with the public key. Change the message after signing and verification fails — that mismatch is how a blockchain spots a forged transaction.',
  className,
}: KeyPairSignProps) {
  const id = useId();
  const [phase, setPhase] = useState<Phase>('clean');
  const [messageSeed, setMessageSeed] = useState(101);
  const [signedSeed, setSignedSeed] = useState<number | null>(null);
  const [signing, setSigning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messageCells = fingerprint(messageSeed);
  // The signature is derived from BOTH the message and the (fixed) private key,
  // so any change to the message changes the signature fingerprint too.
  const signatureCells =
    signedSeed === null ? null : fingerprint(signedSeed * 31 + 7);

  // Verification recomputes the expected signature from the *current* message
  // and compares it to the stored signature — they only match while untampered.
  const verifies = signedSeed !== null && signedSeed === messageSeed;

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleSign = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (prefersReducedMotion()) {
      setSignedSeed(messageSeed);
      setPhase('signed');
      setSigning(false);
      return;
    }
    setSigning(true);
    setSignedSeed(null);
    timerRef.current = setTimeout(() => {
      setSignedSeed(messageSeed);
      setPhase('signed');
      setSigning(false);
    }, 650);
  };

  const handleTamper = () => {
    // Alter the message fingerprint without re-signing.
    setMessageSeed((s) => s + 1);
    setPhase('tampered');
  };

  const handleReset = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setPhase('clean');
    setMessageSeed(101);
    setSignedSeed(null);
    setSigning(false);
  };

  const showResult = phase === 'signed' || phase === 'tampered';

  const buttonBase =
    'inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50';

  const renderFingerprint = (cells: string[], label: string) => (
    <div
      className="flex gap-1"
      role="img"
      aria-label={label}
    >
      {cells.map((color, i) => (
        <span
          key={`${id}-${label}-${i}`}
          className="h-5 w-2.5 rounded-sm"
          style={{ background: color }}
          aria-hidden="true"
        />
      ))}
    </div>
  );

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="inline-flex gap-2 text-sm">
          <span className="rounded-pill bg-brand-600 px-3 py-1 font-medium text-white">
            🔒 {privateKeyLabel}
          </span>
          <span className="rounded-pill border border-accent-500 px-3 py-1 font-medium text-accent-600">
            🔓 {publicKeyLabel}
          </span>
        </span>
      </figcaption>

      {/* Left → right flow: message → signature → verdict */}
      <div className="mt-5 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {/* Message tile */}
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-3">
          <p className="text-sm text-ink-500">{messageLabel}</p>
          <div className="mt-2">
            {renderFingerprint(messageCells, messageLabel)}
          </div>
        </div>

        {/* Sign arrow */}
        <div
          className="flex flex-col items-center justify-center text-ink-500"
          aria-hidden="true"
        >
          <span className="text-lg">🔒</span>
          <span
            className={cx(
              'select-none text-xl text-brand-500 transition-opacity',
              signing ? 'animate-pulse opacity-100' : 'opacity-60',
            )}
          >
            →
          </span>
        </div>

        {/* Signature tile */}
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-3">
          <p className="text-sm text-ink-500">{signatureLabel}</p>
          <div className="mt-2 min-h-[1.25rem]">
            {signing ? (
              <span
                className="text-sm text-ink-500"
                aria-hidden="true"
              >
                ···
              </span>
            ) : signatureCells ? (
              renderFingerprint(signatureCells, signatureLabel)
            ) : (
              <span className="text-sm text-ink-300" aria-hidden="true">
                ░░░
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSign}
          disabled={signing}
          className={cx(buttonBase, 'bg-brand-600 text-white hover:bg-brand-700')}
        >
          {signLabel}
        </button>
        <button
          type="button"
          onClick={handleTamper}
          disabled={signedSeed === null || signing}
          className={cx(
            buttonBase,
            'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
          )}
        >
          {tamperLabel}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className={cx(
            buttonBase,
            'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
          )}
        >
          {resetLabel}
        </button>
      </div>

      {/* Verify step + verdict */}
      <div className="mt-4 flex items-center gap-2 text-sm text-ink-600">
        <span aria-hidden="true">🔓</span>
        <span>{verifyLabel}</span>
      </div>

      <div className="mt-3 min-h-[2.75rem]" aria-live="polite">
        {showResult && (
          <div
            className={cx(
              'flex items-center gap-2 rounded-card border px-3 py-2 text-sm font-medium',
              verifies
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-accent-600 bg-surface-sunken/40 text-accent-600',
            )}
          >
            <span aria-hidden="true">{verifies ? '✓' : '✗'}</span>
            <span>{verifies ? validLabel : invalidLabel}</span>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default KeyPairSign;
