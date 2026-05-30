import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PrivacyDialProps {
  /** Heading above the dial. */
  title?: string;
  /** Labels for the three dial stops (public → shielded). */
  stopLabels?: [string, string, string];
  /** Row labels for the three transaction fields. */
  fieldLabels?: [string, string, string];
  /** Field values shown when visible. */
  fieldValues?: [string, string, string];
  /** Word shown over a hidden field. */
  hiddenLabel?: string;
  /** One-line caption under each stop, indexed by stop. */
  captions?: [string, string, string];
  className?: string;
}

/**
 * Interactive "privacy dial": drag from transparent → shielded and watch the
 * sender / receiver / amount get redacted. Teaches that Zcash privacy is a
 * continuum you choose per transaction, not an on/off switch.
 */
export function PrivacyDial({
  title = 'Slide the privacy dial',
  stopLabels = ['Transparent', 'Mixed', 'Shielded'],
  fieldLabels = ['Sender', 'Receiver', 'Amount'],
  fieldValues = ['t1abc…9f', 't1xyz…2k', '4.20 ZEC'],
  hiddenLabel = 'hidden',
  captions = [
    'Everything public — just like Bitcoin.',
    'Moving in/out of the shielded pool can leak metadata.',
    'Sender, receiver, and amount are all proven valid yet hidden.',
  ],
  className,
}: PrivacyDialProps) {
  const reactId = useId();
  const [stop, setStop] = useState(0);

  // How many fields are hidden at each stop.
  const hiddenCount = stop === 0 ? 0 : stop === 1 ? 1 : 3;
  const isHidden = (i: number) => i >= fieldLabels.length - hiddenCount;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-5 space-y-2">
        {fieldLabels.map((label, i) => {
          const hidden = isHidden(i);
          return (
            <div
              key={`${reactId}-f-${i}`}
              className="flex items-center gap-3 rounded-card border border-ink-100 bg-surface px-4 py-2.5"
            >
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {label}
              </span>
              <span className="relative flex-1 font-mono text-sm">
                <span
                  className={cx(
                    'transition-[filter,opacity] duration-500',
                    hidden ? 'select-none opacity-0 blur-sm' : 'text-ink-800 opacity-100',
                  )}
                  aria-hidden={hidden}
                >
                  {fieldValues[i]}
                </span>
                {hidden ? (
                  <span className="absolute inset-0 flex items-center">
                    <span className="rounded-pill bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      🔒 {hiddenLabel}
                    </span>
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <label
          htmlFor={`${reactId}-range`}
          className="mb-2 block text-xs font-medium text-ink-500"
        >
          {stopLabels[stop]}
        </label>
        <input
          id={`${reactId}-range`}
          type="range"
          min={0}
          max={2}
          step={1}
          value={stop}
          onChange={(e) => setStop(Number(e.target.value))}
          className="w-full accent-brand-600"
          aria-valuetext={stopLabels[stop]}
        />
        <div className="mt-1 flex justify-between text-[11px] text-ink-400">
          {stopLabels.map((label, i) => (
            <span
              key={`${reactId}-s-${i}`}
              className={cx(i === stop && 'font-semibold text-brand-700')}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-600" aria-live="polite">
        {captions[stop]}
      </p>
    </figure>
  );
}

export default PrivacyDial;
