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
  {
    slug: 'cross-chain-arbitrage-and-bridge-mev',
    icon: '🌉',
    difficulty: 'expert',
    order: 12,
    accent: 'accent',
    title: {
      en: 'Cross-Chain Arbitrage & Bridge MEV',
      es: 'Arbitraje Cross-Chain y MEV de Puentes',
    },
    description: {
      en: 'Arbitrage when settlement is no longer atomic: bridging assets across chains, the inventory and finality risk it reintroduces, shared sequencers, and where MEV reappears in a multi-chain world.',
      es: 'Arbitraje cuando la liquidación deja de ser atómica: puentear activos entre cadenas, el riesgo de inventario y de finalidad que reintroduce, los secuenciadores compartidos y dónde reaparece el MEV en un mundo multicadena.',
    },
    dependencies: ['onchain-arbitrage-and-cross-dex-mev', 'stablecoins', 'ethereum'],
    tags: ['defi', 'quantitative-finance', 'crypto'],
    buildNotes:
      'On-chain arbitrage once the single-transaction atomicity guarantee is gone. How bridges move value across chains (lock-and-mint, burn-and-mint, liquidity-network bridges) and why a cross-chain leg cannot settle in one atomic transaction — so inventory risk, bridge latency and probabilistic finality / reorg risk all return, making cross-chain arb look more like the non-atomic CEX-DEX cousin than pure atomic arb. Capital and rebalancing constraints (you must pre-position inventory on both sides), bridge trust assumptions and the bridge-hack tail risk, shared/centralized sequencers and cross-domain MEV, atomic-cross-chain attempts (bonded relayers, intents, escrow) and why they only approximate atomicity. Carry the cost-stack and capacity themes forward from onchain-arbitrage-and-cross-dex-mev. Islands: cross-chain-settlement-timeline + bridge-inventory-balance.',
  },
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
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
