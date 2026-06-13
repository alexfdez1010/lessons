/**
 * Upcoming courses — the build queue, as PURE data (no astro:content imports,
 * so it is safe to import from anywhere). This is the structured successor to
 * the old free-text queue in `ROADMAP.md`: each entry is a finance course that
 * is *planned but not yet built*. The catalog renders these as dimmed
 * "Coming soon" nodes on the dependency graph, wired to their prerequisites
 * exactly like real courses.
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
 * The autonomous daily agent builds the lowest-`order` entry, then removes it.
 * See `ROADMAP.md` for the full agent contract.
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
    slug: 'algorithmic-trading-and-execution',
    icon: '🤖',
    difficulty: 'expert',
    order: 1,
    accent: 'brand',
    title: {
      en: 'Algorithmic Trading & Execution',
      es: 'Trading Algorítmico y Ejecución',
    },
    description: {
      en: 'How big orders get worked: execution algos, market impact, and the backtesting traps that fool everyone.',
      es: 'Cómo se ejecutan las órdenes grandes: algoritmos de ejecución, impacto de mercado y las trampas del backtesting.',
    },
    dependencies: ['market-microstructure', 'time-series-finance'],
    tags: ['trading-and-markets', 'quantitative-finance'],
    buildNotes:
      'How orders get worked: execution algos (TWAP/VWAP/POV/IS), implementation shortfall, market-impact models (square-root law), backtesting pitfalls (overfitting, survivorship, look-ahead), alpha decay, transaction-cost analysis, HFT strategies at a glance. Islands: impact-curve + execution-schedule.',
  },
  {
    slug: 'exotic-options-and-structured-products',
    icon: '🎰',
    difficulty: 'expert',
    order: 2,
    accent: 'accent',
    title: {
      en: 'Exotic Options & Structured Products',
      es: 'Opciones Exóticas y Productos Estructurados',
    },
    description: {
      en: 'Beyond vanillas: barriers, digitals, autocallables, and how a structured note is really a bond plus an option strip.',
      es: 'Más allá de las vainilla: barreras, digitales, autocancelables y cómo un nota estructurada es un bono más un paquete de opciones.',
    },
    dependencies: ['options-pricing', 'greeks-and-hedging', 'volatility-trading'],
    tags: ['derivatives'],
    buildNotes:
      'Beyond vanillas: digital/binary options, barrier options (knock-in/out) and their hedging headaches, lookbacks & Asians, autocallables and cliquets, how a structured note is decomposed into a bond + option strip, payoff engineering and the hidden costs investors pay. Islands: barrier-payoff + autocall-ladder.',
  },
  {
    slug: 'counterparty-risk-and-xva',
    icon: '🤝',
    difficulty: 'expert',
    order: 3,
    accent: 'brand',
    title: {
      en: 'Counterparty Risk & XVA',
      es: 'Riesgo de Contraparte y XVA',
    },
    description: {
      en: 'The cost of who you trade with: credit exposure, the XVA family (CVA/DVA/FVA…), collateral, and post-2008 plumbing.',
      es: 'El coste de con quién operas: exposición crediticia, la familia XVA (CVA/DVA/FVA…), colateral y la fontanería post-2008.',
    },
    dependencies: ['swaps-and-rate-derivatives', 'credit-derivatives-and-securitization'],
    tags: ['derivatives', 'risk-management'],
    buildNotes:
      'The cost of who you trade with: counterparty credit exposure (EE/PFE), netting sets and collateral, the XVA family (CVA/DVA/FVA/MVA/KVA), wrong-way risk, central clearing vs bilateral, initial vs variation margin and the post-2008 plumbing. Islands: exposure-profile + xva-waterfall.',
  },
  {
    slug: 'systematic-and-statistical-arbitrage',
    icon: '🔗',
    difficulty: 'expert',
    order: 4,
    accent: 'accent',
    title: {
      en: 'Systematic & Statistical Arbitrage',
      es: 'Arbitraje Sistemático y Estadístico',
    },
    description: {
      en: 'Mining relative value: pairs trading, cointegration, factor-neutral books, signal decay, and the 2007 quant quake.',
      es: 'Minando valor relativo: pairs trading, cointegración, carteras neutrales por factor, decaimiento de señal y el quant quake de 2007.',
    },
    dependencies: ['time-series-finance', 'factor-models', 'algorithmic-trading-and-execution'],
    tags: ['quantitative-finance', 'trading-and-markets'],
    buildNotes:
      'Mining relative value: pairs trading & cointegration, mean-reversion vs momentum signals, building a market-/factor-neutral book, signal combination & decay, capacity and crowding, the 2007 quant quake. Islands: spread-zscore + signal-decay.',
  },
  {
    slug: 'defi-options-and-onchain-volatility',
    icon: '🌀',
    difficulty: 'expert',
    order: 5,
    accent: 'brand',
    title: {
      en: 'DeFi Options & On-chain Volatility',
      es: 'Opciones DeFi y Volatilidad On-chain',
    },
    description: {
      en: 'Volatility goes on-chain: option vaults and their short-vol risk, on-chain implied vol, and perp funding as a vol signal.',
      es: 'La volatilidad va on-chain: vaults de opciones y su riesgo short-vol, volatilidad implícita on-chain y el funding de perps como señal.',
    },
    dependencies: ['volatility-trading', 'defi-derivatives-perps'],
    tags: ['defi', 'derivatives'],
    buildNotes:
      'Volatility goes on-chain: on-chain options protocols, DeFi option vaults (covered-call / put-selling strategies) and their structural short-vol risk, on-chain implied vol & oracles, perp funding as a vol/skew signal, settlement and liquidity frictions vs TradFi desks. Islands: dov-payoff + onchain-vol.',
  },
  {
    slug: 'history-of-finance',
    icon: '📜',
    difficulty: 'intermediate',
    order: 6,
    accent: 'accent',
    title: {
      en: 'History of Finance',
      es: 'Historia de las Finanzas',
    },
    description: {
      en: 'Where financial products came from — from Hammurabi and the VOC to tulip mania, Dojima rice, and modern ETFs.',
      es: 'De dónde vienen los productos financieros — de Hammurabi y la VOC a la tulipomanía, el arroz de Dojima y los ETFs modernos.',
    },
    dependencies: ['history-of-money', 'stock-markets-and-funds'],
    tags: ['investing-basics'],
    buildNotes:
      "Where financial products came from (the story history-of-money doesn't tell): ancient lending & interest and the Code of Hammurabi, Italian merchant banks + double-entry bookkeeping + bills of exchange, the first government bonds (Venetian prestiti), the Amsterdam joint-stock company & the world's first stock exchange (VOC, 1602), tulip mania as the first derivatives bubble, Dojima rice & the first futures market, Lloyd's & the birth of insurance, central banks (Bank of England 1694), mutual funds → index funds → ETFs, and the rise of modern derivatives & securitization. Focus on why each product was invented and what problem it solved. Islands: product-timeline + joint-stock-share.",
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
