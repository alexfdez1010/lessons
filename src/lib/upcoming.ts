/**
 * Upcoming courses — the build queue, as PURE data (no astro:content imports,
 * so it is safe to import from anywhere). This file is the SINGLE SOURCE OF
 * TRUTH for "what gets built next": each entry is a finance course that is
 * *planned but not yet built*. The catalog renders these as dimmed
 * "Coming soon" nodes on the dependency graph, wired to their prerequisites
 * exactly like real courses, and on the `/upcoming` page.
 *
 * Two operations are meant to be trivial:
 *
 *   • ADD a planned course → append an `UpcomingCourse` object to the array
 *     below. It immediately shows up on the catalog graph. No other change.
 *
 *   • GRADUATE a course to "created" → once its topic MDX exists under
 *     `src/content/topics/`, DELETE its entry here. The built topic is now the
 *     record; an upcoming entry only describes what is still missing. (Keeping
 *     a slug in both places would draw the node twice.)
 *
 * ── Autonomous daily-agent contract (`scripts/daily-lesson.sh`) ──────────────
 * The daily agent builds the LOWEST-`order` entry, then DELETES that entry.
 *
 *   • Build strictly within the finance scope in CLAUDE.md (quantitative
 *     finance, crypto, DeFi). One topic per run, en + es twin.
 *   • Go in order: build the lowest-`order` upcoming entry first. Never build
 *     something easier than the most recently built course (keep the ramp
 *     monotone).
 *   • Use the entry's `buildNotes` as the build brief, its `dependencies`/`tags`
 *     for catalog wiring, and keep the same `slug` for the topic MDX so it
 *     graduates cleanly.
 *   • After building, REMOVE its entry here (the topic MDX is now the record).
 *   • When fewer than 3 entries remain, APPEND the next harder topics (each one
 *     notch up) so the queue never empties.
 */

import type { Difficulty } from '@/lib/catalog-filter';

/** A planned-but-unbuilt finance course, rendered as a "Coming soon" node. */
export interface UpcomingCourse {
  /** Bare topic slug — the id used to wire dependencies and, later, the MDX. */
  slug: string;
  /** Emoji / icon for the node. */
  icon: string;
  /** Where it sits on the zero-to-expert ladder. */
  difficulty: Difficulty;
  /** Build order — the agent builds the LOWEST order first. */
  order: number;
  /** Accent token suffix used for the node tint (defaults to `brand`). */
  accent?: 'brand' | 'accent';
  /** Bilingual title. */
  title: { en: string; es: string };
  /** Bilingual one-line summary shown on the card. */
  description: { en: string; es: string };
  /** Bare slugs of prerequisite courses (drawn as incoming edges). */
  dependencies?: string[];
  /** Roadmap tags the course will carry — drives the tag filter. */
  tags?: string[];
  /**
   * Free-text build brief for the authoring agent (sub-topics to cover,
   * islands to build). Not rendered in the UI — it is the spec the agent
   * follows when it builds this course.
   */
  buildNotes?: string;
}

/**
 * The queue, in build order. Append to grow it; delete an entry once its topic
 * MDX exists. Keep the same `slug` you intend the built topic to use.
 */
export const upcomingCourses: UpcomingCourse[] = [
  {
    slug: 'high-frequency-market-making',
    icon: '⚡',
    difficulty: 'expert',
    order: 8,
    accent: 'brand',
    title: {
      en: 'High-Frequency Market Making',
      es: 'Creación de Mercado de Alta Frecuencia',
    },
    description: {
      en: 'Quoting both sides for a living: the Avellaneda–Stoikov model, inventory risk, optimal spreads, adverse selection, and the latency arms race.',
      es: 'Cotizar ambos lados para vivir: el modelo de Avellaneda–Stoikov, riesgo de inventario, spreads óptimos, selección adversa y la carrera de latencia.',
    },
    dependencies: ['market-microstructure', 'algorithmic-trading-and-execution', 'systematic-and-statistical-arbitrage'],
    tags: ['quantitative-finance', 'trading-and-markets'],
    buildNotes:
      'The other side of every order: how a market maker earns the spread while managing inventory. The market-making P&L (spread capture minus adverse selection minus inventory risk), the Avellaneda–Stoikov optimal-quoting model (reservation price, optimal bid/ask skew vs inventory and risk aversion), inventory mean-reversion & skewing quotes, adverse selection & the Glosten–Milgrom intuition, queue position & order-book dynamics, latency and the speed arms race, and maker-taker / rebate economics. Islands: as-quoting-sim + inventory-skew.',
  },
  {
    slug: 'onchain-arbitrage-and-cross-dex-mev',
    icon: '🔀',
    difficulty: 'expert',
    order: 9,
    accent: 'accent',
    title: {
      en: 'On-chain Arbitrage & Cross-DEX MEV',
      es: 'Arbitraje On-chain y MEV entre DEX',
    },
    description: {
      en: 'Statistical arbitrage meets the blockchain: cross-DEX and triangular arb, atomic bundles, sandwiching, and the searcher–builder economics of MEV.',
      es: 'El arbitraje estadístico se topa con la blockchain: arbitraje entre DEX y triangular, bundles atómicos, sandwiching y la economía searcher–builder del MEV.',
    },
    dependencies: ['defi-amms', 'mev-and-ordering', 'systematic-and-statistical-arbitrage'],
    tags: ['defi', 'quantitative-finance', 'trading-and-markets'],
    buildNotes:
      'Relative-value arbitrage with no shorting and atomic settlement: cross-DEX price discrepancies and how AMM curves create them, triangular arbitrage across pools, atomic arbitrage bundles & flash-loan-funded legs, the cost stack (gas, priority fees, builder payment, slippage), competition in the priority-gas/PBS auction and why most arb profit is bid away to builders/validators, backrunning vs sandwiching, and the statistical edge & capacity limits of on-chain arb vs TradFi stat-arb. Islands: cross-dex-arb + bundle-profit-split.',
  },
  {
    slug: 'reinforcement-learning-for-trading',
    icon: '🤖',
    difficulty: 'expert',
    order: 10,
    accent: 'accent',
    title: {
      en: 'Reinforcement Learning for Trading',
      es: 'Aprendizaje por Refuerzo para Trading',
    },
    description: {
      en: 'Markets as a sequential decision problem: MDPs for execution and market making, reward design, policy-gradient vs Q-learning, and the sim-to-real gap that wrecks naive RL backtests.',
      es: 'Los mercados como problema de decisión secuencial: MDP para ejecución y creación de mercado, diseño de recompensas, policy-gradient frente a Q-learning, y el salto sim-a-real que arruina los backtests de RL ingenuos.',
    },
    dependencies: ['machine-learning-for-alpha', 'algorithmic-trading-and-execution', 'market-microstructure'],
    tags: ['quantitative-finance', 'trading-and-markets'],
    buildNotes:
      'Reinforcement learning where the action moves the market: framing trading as a Markov decision process (state, action, reward, transition), why supervised ML is the wrong frame for execution/sizing, optimal execution as an RL problem (and how it relates to Almgren–Chriss), market-making agents balancing inventory and spread, value-based (Q-learning/DQN) vs policy-gradient (PPO/actor-critic) methods, reward shaping and its pitfalls (reward hacking, myopia), exploration vs exploitation under transaction costs, and the brutal sim-to-real / non-stationarity gap that makes RL backtests even easier to overfit than supervised ones. Carry the overfitting-is-the-enemy theme from machine-learning-for-alpha. Islands: rl-agent-env-loop + execution-policy-heatmap.',
  },
  {
    slug: 'deep-learning-for-market-data',
    icon: '🔮',
    difficulty: 'expert',
    order: 11,
    accent: 'brand',
    title: {
      en: 'Deep Learning for Market Data',
      es: 'Deep Learning para Datos de Mercado',
    },
    description: {
      en: 'Sequence models on the hardest data there is: RNNs, temporal convolutions and attention for returns and the limit-order book, embeddings for alt-data, and honest, deflated evaluation.',
      es: 'Modelos de secuencia sobre los datos más difíciles que existen: RNN, convoluciones temporales y atención para retornos y el libro de órdenes, embeddings para datos alternativos, y una evaluación honesta y desinflada.',
    },
    dependencies: ['machine-learning-for-alpha', 'time-series-finance'],
    tags: ['quantitative-finance'],
    buildNotes:
      'Deep learning for sequential market data, without the hype: why plain MLPs over-/under-fit low-signal returns, recurrent models (RNN/LSTM/GRU) and their vanishing-gradient story, temporal convolutional networks, attention and transformers applied to returns and to limit-order-book microstructure, embeddings for categorical and alternative data, the tiny-effective-sample-size problem and aggressive regularization (dropout, weight decay, early stopping, data augmentation), purged/embargoed evaluation and the deflated Sharpe applied to DL, and a sober answer to "when does deep learning actually beat gradient boosting in finance?" (usually it does not). Builds directly on machine-learning-for-alpha. Islands: sequence-model-unroll + attention-weights-heatmap.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
