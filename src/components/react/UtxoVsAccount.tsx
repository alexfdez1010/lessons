import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface UtxoVsAccountProps {
  /** Heading above the two panels. */
  title?: string;
  /** Label for the UTXO (Bitcoin-style) panel. */
  utxoLabel?: string;
  /** Label for the account (Ethereum-style) panel. */
  accountLabel?: string;
  /** Label for the wallet holding the coins. */
  walletLabel?: string;
  /** Label for the recipient the coins move toward. */
  recipientLabel?: string;
  /** Word shown on the change chip returned to the wallet. */
  changeLabel?: string;
  /** Label for the running balance bar. */
  balanceLabel?: string;
  /** Text on the action button that drives both panels. */
  sendLabel?: string;
  /** Text on the reset button. */
  resetLabel?: string;
  /** Words explaining what the UTXO side just did. */
  utxoExplain?: string;
  /** Words explaining what the account side just did. */
  accountExplain?: string;
  /** One-line takeaway shown under the panels. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Abstract coin chip: only a relative size, never a printed amount. */
interface Coin {
  /** Visual radius as a fraction (0–1) — purely cosmetic, no number is shown. */
  size: number;
  /** Whether this coin is consumed by the payment. */
  spent: boolean;
  /** Whether this is the change coin returned to the wallet. */
  change: boolean;
}

const COINS: Coin[] = [
  { size: 1, spent: true, change: false },
  { size: 0.7, spent: false, change: false },
  { size: 0.85, spent: false, change: false },
];

/**
 * Side-by-side visual of the two ways a blockchain tracks money, both reacting
 * to one "Send a payment" action. LEFT (UTXO / Bitcoin): the wallet holds a few
 * discrete coin chips; sending lifts a whole coin out toward the recipient and
 * floats a smaller "change" chip back in — like paying cash and getting change.
 * RIGHT (account / Ethereum): a single balance bar whose fill simply drops by
 * the payment segment — just a number going down, shown as bar height. No
 * digits, amounts, or equations are ever rendered. Respects
 * `prefers-reduced-motion` (jumps straight to the settled state).
 */
export function UtxoVsAccount({
  title = 'Two ways to track money',
  utxoLabel = 'UTXO model — Bitcoin',
  accountLabel = 'Account model — Ethereum',
  walletLabel = 'Your wallet',
  recipientLabel = 'Recipient',
  changeLabel = 'change',
  balanceLabel = 'Balance',
  sendLabel = 'Send a payment',
  resetLabel = 'Reset',
  utxoExplain = 'You spent a whole coin — it was bigger than the payment, so the leftover came back as a new "change" coin. Like paying cash with a large bill and pocketing the change.',
  accountExplain = 'No coins, no change — your single balance just ticked down by the amount you sent, exactly like a bank ledger.',
  caption = 'Same payment, two bookkeeping styles: UTXO consumes whole coins and hands back change, while the account model just lowers one running balance.',
  className,
}: UtxoVsAccountProps) {
  const id = useId();
  // 'idle' → before sending; 'sent' → after sending (final state).
  const [sent, setSent] = useState(false);
  // Animation progress 0 → 1, drives both panels.
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Drive the shared animation whenever we transition to "sent".
  useEffect(() => {
    if (!sent) {
      setProgress(0);
      return;
    }
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [sent]);

  // --- UTXO panel geometry (SVG) ---
  const UW = 240;
  const UH = 200;
  const walletCx = 70;
  const recipientCx = 200;
  const trayY = 150; // wallet floor where coins rest
  const recipientY = 60;

  // Payment fraction of the balance that leaves on the account side.
  const PAY_FRACTION = 0.45;
  const balanceFull = 0.85; // starting fill (cosmetic, 0–1)
  const balanceAfter = balanceFull - PAY_FRACTION * balanceFull;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSent(true)}
            disabled={sent}
            className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {sendLabel}
          </button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="rounded-pill border border-ink-200 bg-surface px-3 py-1 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {resetLabel}
          </button>
        </div>
      </figcaption>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* LEFT — UTXO panel */}
        <div className="rounded-card border border-ink-100 bg-surface-sunken/30 p-3">
          <p className="text-sm font-medium text-brand-700">{utxoLabel}</p>
          <svg
            viewBox={`0 0 ${UW} ${UH}`}
            className="mt-2 w-full"
            role="img"
            aria-label={
              sent
                ? `${utxoLabel}: a whole coin moved from ${walletLabel} to ${recipientLabel}, and a smaller ${changeLabel} coin returned to ${walletLabel}.`
                : `${utxoLabel}: ${walletLabel} holds several discrete coins of different sizes.`
            }
          >
            {/* Wallet zone */}
            <rect
              x={20}
              y={100}
              width={100}
              height={80}
              rx={10}
              fill="var(--color-surface)"
              stroke="var(--color-ink-200)"
            />
            <text
              x={70}
              y={194}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-500)"
            >
              {walletLabel}
            </text>
            {/* Recipient zone */}
            <circle
              cx={recipientCx}
              cy={recipientY}
              r={26}
              fill="var(--color-surface)"
              stroke="var(--color-ink-200)"
            />
            <text
              x={recipientCx}
              y={recipientY + 44}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-500)"
            >
              {recipientLabel}
            </text>

            {/* Coins */}
            {COINS.map((coin, i) => {
              const r = 14 + coin.size * 10;
              const restX = walletCx - 26 + i * 26;
              if (coin.spent) {
                // Spent coin travels from wallet to recipient.
                const cxPos = restX + (recipientCx - restX) * progress;
                const cyPos = trayY + (recipientY - trayY) * progress;
                return (
                  <circle
                    key={`u-${i}`}
                    cx={cxPos}
                    cy={cyPos}
                    r={r}
                    fill="var(--color-brand-500)"
                    stroke="var(--color-brand-700)"
                    opacity={0.9}
                  />
                );
              }
              return (
                <circle
                  key={`u-${i}`}
                  cx={restX}
                  cy={trayY}
                  r={r}
                  fill="var(--color-brand-300)"
                  stroke="var(--color-brand-500)"
                />
              );
            })}

            {/* Change coin: floats from recipient back into the wallet */}
            {sent && (
              <g opacity={progress}>
                <circle
                  cx={recipientCx + (walletCx - recipientCx) * progress}
                  cy={recipientY + (trayY - recipientY) * progress}
                  r={12}
                  fill="var(--color-accent-400)"
                  stroke="var(--color-accent-600)"
                />
                <text
                  x={recipientCx + (walletCx - recipientCx) * progress}
                  y={recipientY + (trayY - recipientY) * progress - 18}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-accent-600)"
                >
                  {changeLabel}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* RIGHT — Account panel */}
        <div className="rounded-card border border-ink-100 bg-surface-sunken/30 p-3">
          <p className="text-sm font-medium text-accent-600">{accountLabel}</p>
          <svg
            viewBox={`0 0 ${UW} ${UH}`}
            className="mt-2 w-full"
            role="img"
            aria-label={
              sent
                ? `${accountLabel}: the single ${balanceLabel} bar dropped by the payment segment.`
                : `${accountLabel}: a single ${balanceLabel} shown as the height of one fill bar.`
            }
          >
            {/* Bar track */}
            <rect
              x={95}
              y={20}
              width={50}
              height={140}
              rx={8}
              fill="var(--color-surface)"
              stroke="var(--color-ink-200)"
            />
            {(() => {
              const trackTop = 20;
              const trackH = 140;
              // Interpolate fill height from full → after.
              const fillFrac = sent
                ? balanceFull - (balanceFull - balanceAfter) * progress
                : balanceFull;
              const h = fillFrac * trackH;
              const yTop = trackTop + (trackH - h);
              return (
                <>
                  {/* The segment that leaves (faded), only while sending */}
                  {sent && (
                    <rect
                      x={95}
                      y={trackTop + (trackH - balanceFull * trackH)}
                      width={50}
                      height={(balanceFull - balanceAfter) * trackH}
                      rx={8}
                      fill="var(--color-accent-400)"
                      opacity={0.25 * (1 - progress)}
                    />
                  )}
                  {/* Current balance fill */}
                  <rect
                    x={95}
                    y={yTop}
                    width={50}
                    height={h}
                    rx={8}
                    fill="var(--color-accent-500)"
                  />
                </>
              );
            })()}
            <text
              x={120}
              y={178}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-500)"
            >
              {balanceLabel}
            </text>
          </svg>
        </div>
      </div>

      {/* Explanation status line */}
      <div
        id={`${id}-status`}
        aria-live="polite"
        className="mt-4 grid gap-2 text-sm sm:grid-cols-2"
      >
        {sent ? (
          <>
            <p className="rounded-card border border-brand-200 bg-brand-50/60 px-3 py-2 leading-relaxed text-ink-700">
              {utxoExplain}
            </p>
            <p className="rounded-card border border-accent-300 bg-accent-300/15 px-3 py-2 leading-relaxed text-ink-700">
              {accountExplain}
            </p>
          </>
        ) : (
          <p className="text-ink-500 sm:col-span-2">{caption}</p>
        )}
      </div>

      {sent && <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>}
    </figure>
  );
}

export default UtxoVsAccount;
