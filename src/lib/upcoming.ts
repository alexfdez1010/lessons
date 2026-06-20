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
    slug: 'order-flow-auctions-and-mev-redistribution',
    icon: '📡',
    difficulty: 'expert',
    order: 13,
    accent: 'brand',
    title: {
      en: 'Order-Flow Auctions & MEV Redistribution',
      es: 'Subastas de Flujo de Órdenes y Redistribución del MEV',
    },
    description: {
      en: 'The frontier of taming MEV: order-flow auctions, intent-based trading with solvers (CoW, UniswapX), MEV-Share and SUAVE, and the mechanism design that routes extracted value back to users.',
      es: 'La frontera para domar el MEV: subastas de flujo de órdenes, trading basado en intents con solvers (CoW, UniswapX), MEV-Share y SUAVE, y el diseño de mecanismos que devuelve a los usuarios el valor extraído.',
    },
    dependencies: ['mev-and-ordering', 'onchain-arbitrage-and-cross-dex-mev'],
    tags: ['defi', 'quantitative-finance', 'crypto'],
    buildNotes:
      'How the MEV supply chain is being re-architected to give value back to the user who creates it. Order-flow auctions (OFAs): selling the right to backrun/execute a user transaction and refunding the user a share of the bid. Intent-based trading: the user signs a desired outcome, not a transaction, and competing solvers bid to fill it best (CoW Protocol batch auctions with uniform clearing price + coincidence of wants, UniswapX Dutch auctions). MEV-Share and programmable privacy, the SUAVE decentralized-sequencing vision, and the mechanism-design tradeoffs (price improvement vs solver centralization, censorship, trust). Tie back to the cost-stack lesson: this is the "redistribute" verb made concrete. Islands: intent-solver-auction + ofa-refund-split.',
  },
  {
    slug: 'deep-rl-for-execution-and-market-making',
    icon: '🤖',
    difficulty: 'expert',
    order: 14,
    accent: 'brand',
    title: {
      en: 'Deep RL for Execution & Market Making',
      es: 'Deep RL para Ejecución y Creación de Mercado',
    },
    description: {
      en: 'Where deep learning meets reinforcement learning on the order book: deep policy/value networks for optimal execution and market making, the sim-to-real gap, reward shaping, and why a learned agent so often loses to a simple baseline.',
      es: 'Donde el deep learning se cruza con el aprendizaje por refuerzo sobre el libro de órdenes: redes profundas de política/valor para ejecución óptima y creación de mercado, la brecha sim-a-real, el diseño de recompensas y por qué un agente aprendido pierde tan a menudo frente a una referencia simple.',
    },
    dependencies: ['reinforcement-learning-for-trading', 'deep-learning-for-market-data', 'high-frequency-market-making'],
    tags: ['quantitative-finance'],
    buildNotes:
      'Fuse the RL-for-trading course with the new deep-learning-for-market-data course, pointed at the two canonical control problems: optimal execution (beat Almgren-Chriss/TWAP/VWAP) and market making (Avellaneda-Stoikov as the analytic baseline). Deep function approximation for RL: DQN and its instability on financial state, policy-gradient/REINFORCE, actor-critic (A2C/PPO), and continuous-action control for quoting. The state (LOB features, inventory, time-left), action (child-order size/aggression or bid/ask skew), and reward (implementation shortfall, spread capture minus inventory penalty) design — and how reward shaping silently changes the learned policy. The sim-to-real gap: market impact models, non-stationarity, and why backtested RL agents overfit the simulator. Honest evaluation: compare against Almgren-Chriss and A-S baselines, not against doing nothing. Carry forward the deflated-Sharpe and overfitting discipline. Islands: rl-execution-schedule + market-making-quote-ladder.',
  },
  {
    slug: 'generative-models-for-synthetic-market-data',
    icon: '🌀',
    difficulty: 'expert',
    order: 15,
    accent: 'accent',
    title: {
      en: 'Generative Models for Synthetic Market Data',
      es: 'Modelos Generativos para Datos de Mercado Sintéticos',
    },
    description: {
      en: 'Manufacturing more market when you have too little: GANs, VAEs and diffusion models for synthetic price paths, the stylized facts a good generator must reproduce, and the hard problem of evaluating — and not fooling yourself with — fake data.',
      es: 'Fabricar más mercado cuando tienes demasiado poco: GAN, VAE y modelos de difusión para trayectorias de precios sintéticas, los hechos estilizados que un buen generador debe reproducir, y el problema difícil de evaluar —y no engañarte con— datos falsos.',
    },
    dependencies: ['deep-learning-for-market-data', 'monte-carlo-finance', 'time-series-finance'],
    tags: ['quantitative-finance'],
    buildNotes:
      'The deep-learning answer to the tiny-effective-sample-size problem from deep-learning-for-market-data: generate more data. Generative models for financial time series — GANs (and the QuantGAN/TimeGAN lineage), variational autoencoders, and diffusion/score-based models — versus the classical Monte-Carlo simulators from monte-carlo-finance (GBM, block bootstrap, regime-switching). The stylized facts a generator MUST reproduce to be useful (fat tails, volatility clustering, autocorrelation of absolute returns, leverage effect) — tie hard to time-series-finance. Uses: data augmentation for training, scenario generation and stress testing, privacy-preserving data sharing, and synthetic backtesting. The central trap, in the spirit of the ML-for-alpha creed: how do you EVALUATE synthetic data, and why training/validating on a generator that learned your history can leak and inflate every downstream backtest? Mode collapse, memorization, and the "is it real or did the GAN just copy?" test. Islands: stylized-facts-checklist + synthetic-vs-real-paths.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
