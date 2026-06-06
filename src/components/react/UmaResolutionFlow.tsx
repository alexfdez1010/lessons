import { useEffect, useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One stage in UMA's optimistic-oracle resolution flow for a Polymarket market. */
export interface UmaStage {
  /** Short key used internally and for screen-reader announcements. */
  key: string;
  /** Display label of the stage (e.g. "Liveness window"). */
  label: string;
  /** Explanation of what happens at this stage. */
  detail: string;
}

export interface UmaResolutionFlowProps {
  /** Heading above the diagram. */
  title?: string;
  /**
   * The ordered resolution stages. Defaults to the six-stage UMA flow:
   * Close → Propose+Bond → Liveness window → Settle / Dispute branch →
   * DVM vote → Redeem. The fourth stage is a branch point: from there the
   * learner either lets it settle (undisputed) or disputes it (→ DVM vote).
   */
  stages?: UmaStage[];
  /** Label for the "next step" control. */
  nextLabel?: string;
  /** Label for the "previous step" control. */
  backLabel?: string;
  /** Label for the branch button that escalates to a dispute. */
  disputeLabel?: string;
  /** Label for the branch button that lets the market settle undisputed. */
  noDisputeLabel?: string;
  /** Label for the restart/reset control. */
  restartLabel?: string;
  /** Label for the bond readout row. */
  bondLabel?: string;
  /** Label for the proposer readout row. */
  proposerLabel?: string;
  /** Label for the disputer readout row. */
  disputerLabel?: string;
  /** Label for the proposed/settled outcome readout row. */
  outcomeLabel?: string;
  /** Badge shown once the disputed branch is taken. */
  disputedBadge?: string;
  /** Badge shown once the undisputed branch is taken. */
  undisputedBadge?: string;
  /** One-line takeaway shown under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_STAGES: UmaStage[] = [
  {
    key: 'close',
    label: 'Market closes',
    detail:
      'Trading stops and the market’s question is sent to UMA’s Optimistic Oracle: “What was the real-world outcome?” No price is known yet — someone has to assert one.',
  },
  {
    key: 'propose',
    label: 'Propose + bond',
    detail:
      'A proposer reads the rules, decides the answer (YES, NO, or 50-50 for an unresolvable market) and posts it together with a bond. The bond is collateral: it’s forfeited if the proposal turns out to be wrong, so honest answers are the cheap default.',
  },
  {
    key: 'liveness',
    label: 'Liveness window',
    detail:
      'A challenge timer (commonly about 2 hours) ticks down. Anyone watching can dispute the proposed outcome by matching the bond. This is the branch point — let it run out, or challenge it.',
  },
  {
    key: 'branch',
    label: 'Settle / Dispute',
    detail:
      'Choose a path. If the window closes untouched, the proposal is accepted as truth. If someone disputes — posting an equal bond — the question escalates to UMA’s Data Verification Mechanism for a full vote.',
  },
  {
    key: 'vote',
    label: 'DVM vote',
    detail:
      'UMA token holders commit and reveal votes on the correct outcome. The side that voted with the majority is right; the side that lost — proposer or disputer — forfeits their bond, part of which rewards the winner. The market settles on the voted outcome.',
  },
  {
    key: 'redeem',
    label: 'Redeem',
    detail:
      'The market now has a final outcome. Every winning share is worth exactly $1 and can be redeemed for that; losing shares are worth $0. The full $1 per matched pair of YES+NO shares is paid out to holders of the correct side.',
  },
];

type Branch = 'undisputed' | 'disputed' | null;

/**
 * Animated walkthrough of how a Polymarket market resolves through UMA's
 * Optimistic Oracle. A market closes, a *proposer* posts an outcome plus a
 * *bond*, and a *liveness window* ticks down. From there the flow forks: if no
 * one disputes, it settles at the proposed outcome and winners redeem each
 * correct share for $1; if a *disputer* posts an equal bond, the question
 * escalates to UMA's DVM where token holders vote, the losing side forfeits its
 * bond, and the market settles on the vote before redemption.
 *
 * The learner walks the linear stages with Back/Next, then picks a branch at
 * the liveness step with "Let it settle" or "Dispute it". A horizontal step
 * timeline highlights the active stage; a panel explains it and a readout shows
 * the bond / proposer / disputer / outcome state. `prefers-reduced-motion`
 * snaps the highlight (no tween). Every user-facing string is a prop.
 */
export function UmaResolutionFlow({
  title = 'How a Polymarket market resolves (UMA Optimistic Oracle)',
  stages = DEFAULT_STAGES,
  nextLabel = 'Next',
  backLabel = 'Back',
  disputeLabel = 'Dispute it',
  noDisputeLabel = 'Let it settle',
  restartLabel = 'Restart',
  bondLabel = 'Bond',
  proposerLabel = 'Proposer',
  disputerLabel = 'Disputer',
  outcomeLabel = 'Outcome',
  disputedBadge = 'Disputed → DVM vote',
  undisputedBadge = 'Undisputed → settles',
  caption = 'UMA’s oracle is “optimistic”: it assumes the first bonded answer is correct and settles automatically unless someone pays to challenge it. Disputes are rare because the loser forfeits a real bond — so most markets settle quietly at the proposed outcome, and only the contested ones go all the way to a token-holder vote.',
  className,
}: UmaResolutionFlowProps) {
  const id = useId();
  const n = stages.length;
  const BRANCH_INDEX = 3; // the "Settle / Dispute" branch point
  const VOTE_INDEX = 4; // the DVM-vote stage (only on the disputed branch)
  const REDEEM_INDEX = n - 1;

  const [active, setActive] = useState(0);
  const [branch, setBranch] = useState<Branch>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // On the undisputed branch the DVM-vote stage is skipped entirely.
  const isVoteStage = (i: number): boolean => i === VOTE_INDEX;
  const stageSkipped = (i: number): boolean =>
    branch === 'undisputed' && isVoteStage(i);

  const atBranch = active === BRANCH_INDEX;
  const branchChosen = branch !== null;

  const goBack = (): void => {
    setActive((a) => {
      // Stepping back from redeem on the undisputed branch jumps over the vote.
      const prev =
        a === REDEEM_INDEX && branch === 'undisputed'
          ? BRANCH_INDEX
          : Math.max(0, a - 1);
      // Returning to or before the branch point clears the chosen path.
      if (prev <= BRANCH_INDEX) setBranch(null);
      return prev;
    });
  };

  const goNext = (): void => {
    setActive((a) => Math.min(REDEEM_INDEX, a + 1));
  };

  const chooseSettle = (): void => {
    setBranch('undisputed');
    setActive(REDEEM_INDEX); // skip the DVM vote straight to redeem
  };

  const chooseDispute = (): void => {
    setBranch('disputed');
    setActive(VOTE_INDEX);
  };

  const restart = (): void => {
    setActive(0);
    setBranch(null);
  };

  // Whether a Next button can advance from the current stage. At the branch
  // point the user must pick a branch instead of a plain Next.
  const canNext = active < REDEEM_INDEX && !atBranch;

  const activeStage = stages[active];

  // Derived readout state across the flow.
  const proposed = '50-50 → NO'; // illustrative proposed outcome
  const bondPosted = active >= 1;
  const disputerActive = branch === 'disputed' && active >= VOTE_INDEX;
  const settledOutcome =
    active < BRANCH_INDEX
      ? '—'
      : branch === 'disputed'
        ? active >= VOTE_INDEX
          ? 'NO (by DVM vote)'
          : 'pending vote'
        : branch === 'undisputed'
          ? 'NO (proposed)'
          : 'NO (proposed)';

  const bondState =
    !bondPosted
      ? '—'
      : branch === 'disputed' && active >= VOTE_INDEX
        ? 'loser forfeits bond'
        : branch === 'undisputed' && active >= REDEEM_INDEX
          ? 'returned + reward'
          : 'locked';

  const announce = `${title}. Step ${active + 1} of ${n}: ${activeStage?.label ?? ''}. ${
    activeStage?.detail ?? ''
  }${
    branch === 'disputed'
      ? ` ${disputedBadge}.`
      : branch === 'undisputed'
        ? ` ${undisputedBadge}.`
        : ''
  }`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        {branchChosen ? (
          <span
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium text-white',
              branch === 'disputed' ? 'bg-accent-600' : 'bg-brand-600',
            )}
          >
            {branch === 'disputed' ? disputedBadge : undisputedBadge}
          </span>
        ) : (
          <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
            Step {active + 1}/{n}
          </span>
        )}
      </figcaption>

      {/* Horizontal step timeline */}
      <ol
        className="mt-4 flex flex-wrap items-stretch gap-2"
        aria-label={title}
        role="group"
      >
        {stages.map((stage, i) => {
          const isActive = i === active;
          const isDone = i < active && !stageSkipped(i);
          const skipped = stageSkipped(i);
          return (
            <li
              key={`${id}-chip-${i}`}
              className="flex min-w-[7.5rem] flex-1 items-center gap-1"
            >
              <div
                aria-current={isActive ? 'step' : undefined}
                className={cx(
                  'flex h-full w-full flex-col rounded-card border px-3 py-2',
                  !reduced && 'transition-colors',
                  isActive
                    ? 'border-brand-600 bg-brand-600 text-white shadow-soft'
                    : skipped
                      ? 'border-ink-100 bg-surface-sunken/30 text-ink-400 line-through'
                      : isDone
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-ink-100 bg-surface-sunken/40 text-ink-500',
                )}
              >
                <span
                  className={cx(
                    'font-mono text-xs',
                    isActive ? 'text-white/80' : 'text-ink-400',
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-semibold leading-snug">
                  {stage.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Explanation panel for the active stage */}
      <div
        className={cx(
          'mt-4 rounded-card border px-4 py-3',
          atBranch
            ? 'border-accent-200 bg-accent-50'
            : 'border-brand-100 bg-brand-50/60',
        )}
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-brand-700">
          {active + 1}. {activeStage?.label}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">
          {activeStage?.detail}
        </p>
      </div>

      {/* Bond / outcome readout */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{proposerLabel}</dt>
          <dd className="font-mono font-semibold text-ink-900">
            {bondPosted ? proposed : '—'}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{disputerLabel}</dt>
          <dd
            className={cx(
              'font-mono font-semibold',
              disputerActive ? 'text-accent-600' : 'text-ink-400',
            )}
          >
            {disputerActive ? 'challenged' : branch === 'undisputed' ? 'none' : '—'}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bondLabel}</dt>
          <dd
            className={cx(
              'font-mono font-semibold',
              bondState === 'loser forfeits bond'
                ? 'text-accent-600'
                : bondState === 'returned + reward'
                  ? 'text-brand-700'
                  : 'text-ink-900',
            )}
          >
            {bondState}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{outcomeLabel}</dt>
          <dd
            className={cx(
              'font-mono font-semibold',
              active >= REDEEM_INDEX ? 'text-brand-700' : 'text-ink-900',
            )}
          >
            {settledOutcome}
          </dd>
        </div>
      </dl>

      {/* Live region announcing the current stage to assistive tech */}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={goBack}
          disabled={active === 0}
          aria-label={backLabel}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {backLabel}
        </button>

        {atBranch ? (
          <>
            <button
              type="button"
              onClick={chooseSettle}
              aria-label={noDisputeLabel}
              className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {noDisputeLabel}
            </button>
            <button
              type="button"
              onClick={chooseDispute}
              aria-label={disputeLabel}
              className="rounded-pill bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-600/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              {disputeLabel}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label={nextLabel}
            className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {nextLabel}
          </button>
        )}

        <button
          type="button"
          onClick={restart}
          disabled={active === 0 && branch === null}
          aria-label={restartLabel}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {restartLabel}
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default UmaResolutionFlow;
