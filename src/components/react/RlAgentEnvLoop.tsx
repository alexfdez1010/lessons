import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RlAgentEnvLoopProps {
  /** Heading above the diagram. */
  title?: string;
  /** Label for the agent node. */
  agentLabel?: string;
  /** Label for the environment node. */
  envLabel?: string;
  /** Label on the agent → environment arrow (the action). */
  actionLabel?: string;
  /** Label on the environment → agent arrow (reward + next state). */
  rewardLabel?: string;
  /** Readout label for the step counter. */
  stepLabel?: string;
  /** Readout label for the current observed state. */
  stateLabel?: string;
  /** Readout label for the last reward. */
  lastRewardLabel?: string;
  /** Readout label for the cumulative (episode) return. */
  returnLabel?: string;
  /** Label for the single-step button. */
  stepButtonLabel?: string;
  /** Label for the auto-run toggle. */
  autoLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** Label for the market-impact toggle. */
  impactLabel?: string;
  /** Human-readable action words [buy, hold, sell]. */
  actionWords?: [string, string, string];
  /** One-line takeaway shown under the diagram. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A tiny trading MDP. State = (price, inventory). The agent runs a fixed
// mean-reversion policy against a reference price; the environment moves the
// price by a small random shock PLUS — when impact is on — a push in the
// direction the agent just traded (its own action moves the market).
const REF_PRICE = 100;
const SHOCKS = [-0.9, 0.6, -0.4, 1.1, -1.3, 0.8, -0.2, 0.5, -1.0, 0.7]; // deterministic, seed-free

interface MdpState {
  step: number;
  price: number;
  inventory: number;
  lastAction: 0 | 1 | 2; // 0 buy, 1 hold, 2 sell
  lastReward: number;
  totalReturn: number;
}

const INITIAL: MdpState = {
  step: 0,
  price: REF_PRICE,
  inventory: 0,
  lastAction: 1,
  lastReward: 0,
  totalReturn: 0,
};

// Mean-reversion policy: cheap → buy, rich → sell, near fair → hold.
const choosePolicyAction = (price: number): 0 | 1 | 2 => {
  if (price < REF_PRICE - 0.5) return 0;
  if (price > REF_PRICE + 0.5) return 2;
  return 1;
};

// Apply one full MDP transition. `impact` toggles whether the agent's own trade
// pushes the price (and thus pays a cost that shrinks its reward).
const advance = (s: MdpState, impact: boolean): MdpState => {
  const action = choosePolicyAction(s.price);
  const shock = SHOCKS[s.step % SHOCKS.length];
  const tradeSize = action === 0 ? 1 : action === 2 ? -1 : 0;

  // Market impact: buying nudges the price up, selling down — the action moves
  // the environment. The fill happens at the impacted price, so impact is a
  // cost paid back to the agent as lower reward.
  const impactMove = impact ? tradeSize * 0.45 : 0;
  const fillPrice = s.price + impactMove;
  const nextPrice = s.price + shock + impactMove;

  const newInventory = s.inventory + tradeSize;
  // Reward = mark-to-market PnL of the new inventory on the price move, minus
  // the slippage paid to impact on this trade.
  const markPnl = newInventory * (nextPrice - s.price);
  const slippage = impact ? Math.abs(tradeSize) * 0.45 : 0;
  const reward = markPnl - slippage;

  return {
    step: s.step + 1,
    price: nextPrice,
    inventory: newInventory,
    lastAction: action,
    lastReward: reward,
    totalReturn: s.totalReturn + reward,
  };
};

export function RlAgentEnvLoop({
  title = 'The agent–environment loop',
  agentLabel = 'Agent (policy π)',
  envLabel = 'Environment (market)',
  actionLabel = 'action aₜ',
  rewardLabel = 'reward rₜ, state sₜ₊₁',
  stepLabel = 'Step',
  stateLabel = 'State (price, inv)',
  lastRewardLabel = 'Last reward',
  returnLabel = 'Episode return',
  stepButtonLabel = 'Step',
  autoLabel = 'Auto',
  resetLabel = 'Reset',
  impactLabel = 'Market impact',
  actionWords = ['Buy', 'Hold', 'Sell'],
  caption = 'One loop = one decision. The agent reads the state, its policy picks an action, the market returns a reward and a new state — forever. Flip on Market impact and the agent’s own trades push the price against it, shrinking every reward: in trading, unlike a video game, the action moves the environment. That feedback is exactly what supervised learning cannot capture.',
  className,
}: RlAgentEnvLoopProps) {
  const id = useId();
  const [state, setState] = useState<MdpState>(INITIAL);
  const [impact, setImpact] = useState(false);
  const [auto, setAuto] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'act' | 'observe'>('idle');
  const [glide, setGlide] = useState(1); // 0→1 token travel along active arrow
  const rafRef = useRef<number | null>(null);
  const autoRef = useRef<number | null>(null);
  const pendingRef = useRef<MdpState | null>(null);

  const W = 380;
  const H = 220;
  // Anchor points for the loop. Agent box left, Environment box right.
  const agentC: [number, number] = [88, 110];
  const envC: [number, number] = [292, 110];
  const topY = 52; // action arrow height
  const botY = 168; // reward arrow height

  const doStep = () => {
    if (phase !== 'idle') return;
    const next = advance(state, impact);
    pendingRef.current = next;
    if (prefersReducedMotion()) {
      // No animation: jump straight to the new state.
      setState(next);
      pendingRef.current = null;
      setPhase('idle');
      setGlide(1);
      return;
    }
    setPhase('act');
    setGlide(0);
  };

  const doReset = () => {
    setAuto(false);
    setState(INITIAL);
    setPhase('idle');
    setGlide(1);
    pendingRef.current = null;
  };

  // Drive the token glide for the active phase, then hand off act → observe →
  // commit the new state.
  useEffect(() => {
    if (phase === 'idle') return;
    if (prefersReducedMotion()) return;
    const duration = 460;
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setGlide(eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (phase === 'act') {
        // Action delivered → environment responds: commit state, run reward leg.
        if (pendingRef.current) setState(pendingRef.current);
        setPhase('observe');
        setGlide(0);
      } else {
        pendingRef.current = null;
        setPhase('idle');
        setGlide(1);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  // Auto-run: step whenever idle.
  useEffect(() => {
    if (!auto) return;
    const period = prefersReducedMotion() ? 900 : 1080;
    autoRef.current = window.setInterval(() => {
      if (phase === 'idle') doStep();
    }, period);
    return () => {
      if (autoRef.current !== null) {
        window.clearInterval(autoRef.current);
        autoRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase, impact, state]);

  // Token position along the active arrow.
  let tokenX = agentC[0];
  let tokenY = topY;
  let tokenVisible = phase !== 'idle';
  if (phase === 'act') {
    // travel left → right along the top (action leg)
    tokenX = agentC[0] + (envC[0] - agentC[0]) * glide;
    tokenY = topY;
  } else if (phase === 'observe') {
    // travel right → left along the bottom (reward leg)
    tokenX = envC[0] + (agentC[0] - envC[0]) * glide;
    tokenY = botY;
  }

  const actionWord = actionWords[state.lastAction];
  const rewardSign = state.lastReward >= 0 ? '+' : '';
  const tokenIsAction = phase === 'act';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={impact}
            onChange={(e) => setImpact(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          {impactLabel}
        </label>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A reinforcement-learning loop: an Agent sends an action to the Environment along the top arrow, and the Environment returns a reward and next state along the bottom arrow. Current step ${state.step}, last action ${actionWord}.`}
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-400)" />
          </marker>
        </defs>

        {/* Action arrow: agent → environment (top) */}
        <path
          d={`M ${agentC[0] + 56} ${topY} L ${envC[0] - 56} ${topY}`}
          fill="none"
          stroke={tokenIsAction ? 'var(--color-brand-500)' : 'var(--color-ink-200)'}
          strokeWidth={tokenIsAction ? 2.5 : 1.5}
          markerEnd={`url(#${id}-arrow)`}
        />
        <text
          x={W / 2}
          y={topY - 10}
          fontSize={11}
          fill="var(--color-ink-600)"
          textAnchor="middle"
        >
          {actionLabel}
        </text>

        {/* Reward arrow: environment → agent (bottom) */}
        <path
          d={`M ${envC[0] - 56} ${botY} L ${agentC[0] + 56} ${botY}`}
          fill="none"
          stroke={phase === 'observe' ? 'var(--color-accent-500)' : 'var(--color-ink-200)'}
          strokeWidth={phase === 'observe' ? 2.5 : 1.5}
          markerEnd={`url(#${id}-arrow)`}
        />
        <text
          x={W / 2}
          y={botY + 20}
          fontSize={11}
          fill="var(--color-ink-600)"
          textAnchor="middle"
        >
          {rewardLabel}
        </text>

        {/* Agent node */}
        <g>
          <rect
            x={agentC[0] - 56}
            y={agentC[1] - 34}
            width={112}
            height={68}
            rx={14}
            fill="color-mix(in srgb, var(--color-brand-500) 14%, var(--color-surface))"
            stroke="var(--color-brand-500)"
            strokeWidth={2}
          />
          <text
            x={agentC[0]}
            y={agentC[1] - 6}
            fontSize={12}
            fontWeight={600}
            fill="var(--color-ink-900)"
            textAnchor="middle"
          >
            {agentLabel}
          </text>
          <text
            x={agentC[0]}
            y={agentC[1] + 16}
            fontSize={11}
            fill="var(--color-brand-700)"
            textAnchor="middle"
          >
            → {actionWord}
          </text>
        </g>

        {/* Environment node */}
        <g>
          <rect
            x={envC[0] - 56}
            y={envC[1] - 34}
            width={112}
            height={68}
            rx={14}
            fill="color-mix(in srgb, var(--color-accent-500) 14%, var(--color-surface))"
            stroke="var(--color-accent-500)"
            strokeWidth={2}
          />
          <text
            x={envC[0]}
            y={envC[1] - 6}
            fontSize={12}
            fontWeight={600}
            fill="var(--color-ink-900)"
            textAnchor="middle"
          >
            {envLabel}
          </text>
          <text
            x={envC[0]}
            y={envC[1] + 16}
            fontSize={11}
            fill="var(--color-accent-600)"
            textAnchor="middle"
          >
            ${state.price.toFixed(1)}
          </text>
        </g>

        {/* Traveling token */}
        {tokenVisible && (
          <g>
            <circle
              cx={tokenX}
              cy={tokenY}
              r={9}
              fill="var(--color-surface)"
              stroke={tokenIsAction ? 'var(--color-brand-600)' : 'var(--color-accent-600)'}
              strokeWidth={2.5}
            />
            <circle
              cx={tokenX}
              cy={tokenY}
              r={3.5}
              fill={tokenIsAction ? 'var(--color-brand-600)' : 'var(--color-accent-600)'}
            />
          </g>
        )}
      </svg>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{stepLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-800">{state.step}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{stateLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {state.price.toFixed(1)}, {state.inventory > 0 ? '+' : ''}
            {state.inventory}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{lastRewardLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              state.lastReward >= 0 ? 'text-accent-600' : 'text-brand-700',
            )}
          >
            {rewardSign}
            {state.lastReward.toFixed(2)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 px-3 py-2">
          <dt className="text-ink-500">{returnLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              state.totalReturn >= 0 ? 'text-accent-600' : 'text-brand-700',
            )}
          >
            {state.totalReturn >= 0 ? '+' : ''}
            {state.totalReturn.toFixed(2)}
          </dd>
        </div>
      </dl>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={doStep}
          disabled={phase !== 'idle'}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 disabled:opacity-50"
        >
          {stepButtonLabel}
        </button>
        <button
          type="button"
          onClick={() => setAuto((a) => !a)}
          aria-pressed={auto}
          className={cx(
            'rounded-pill border border-ink-100 px-4 py-1.5 text-sm font-medium shadow-soft transition',
            auto
              ? 'bg-brand-500 text-surface hover:bg-brand-600'
              : 'bg-surface-50 text-ink-800 hover:bg-surface-100',
          )}
        >
          {autoLabel}
        </button>
        <button
          type="button"
          onClick={doReset}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RlAgentEnvLoop;
