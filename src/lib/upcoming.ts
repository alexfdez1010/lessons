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
    slug: 'mental-models-for-finance',
    icon: '🧩',
    difficulty: 'beginner',
    order: 4,
    accent: 'brand',
    title: {
      en: 'Mental Models for Finance',
      es: 'Modelos Mentales para las Finanzas',
    },
    description: {
      en: 'The thinking toolkit before the math: the core economics and finance mental models that turn money decisions from guesswork into reasoning.',
      es: 'La caja de herramientas mental antes que las fórmulas: los modelos mentales clave de economía y finanzas que convierten las decisiones de dinero en razonamiento.',
    },
    dependencies: ['investing-basics', 'economics-for-finance'],
    tags: ['investing-basics'],
    buildNotes:
      "The thinking toolkit a beginner needs before any formula — a curated set of economics + finance mental models, each taught with a plain-language intuition, a worked everyday example, the common misuse, and a 'when to reach for it' note. Assume zero finance background; define every term on first use. Cover: ECONOMICS — opportunity cost, trade-offs & 'there is no free lunch', incentives & second-order effects, marginal thinking (sunk cost vs marginal cost), supply & demand intuition, comparative advantage & specialization, scarcity, time value of money as a model. RISK & PROBABILITY — expected value, risk vs uncertainty, base rates & regression to the mean, asymmetry / convexity (limited downside vs open upside), margin of safety, ergodicity / never risk ruin. MARKETS & BEHAVIOR — compounding as the 8th wonder, diversification ('don't put all eggs in one basket'), Mr. Market & price vs value, reflexivity & feedback loops, efficient-market intuition and its limits, the map is not the territory (models lie). BEHAVIORAL TRAPS — loss aversion, anchoring, confirmation bias, herd behavior/FOMO, recency bias, overconfidence. Mention Munger's 'latticework of mental models' as the framing. Islands: a mental-model latticework/grid explorer + an expected-value-vs-intuition interactive + an asymmetry/convexity payoff visual + a compounding-curve animation. Heavy on analogies and decision scenarios, light on equations (this is the pre-math layer).",
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
  {
    slug: 'machine-learning-for-alpha',
    icon: '🧠',
    difficulty: 'expert',
    order: 7,
    accent: 'accent',
    title: {
      en: 'Machine Learning for Alpha',
      es: 'Machine Learning para Alpha',
    },
    description: {
      en: 'ML done right in markets: feature engineering, leakage and purged cross-validation, backtest overfitting, ensembles, and the deflated Sharpe ratio.',
      es: 'ML bien hecho en mercados: ingeniería de features, fugas y validación cruzada purgada, sobreajuste del backtest, ensembles y el ratio de Sharpe desinflado.',
    },
    dependencies: ['time-series-finance', 'factor-models', 'systematic-and-statistical-arbitrage'],
    tags: ['quantitative-finance'],
    buildNotes:
      'Applying machine learning to predictive signals without fooling yourself: financial features & labeling (fixed-horizon vs triple-barrier), the leakage problem and why standard k-fold fails on time series, purged & embargoed cross-validation, the backtest-overfitting / multiple-testing trap and the deflated Sharpe ratio, tree ensembles vs linear models & feature importance (MDI/MDA), regularization and ensembling for noisy low-signal data, and combining ML signals with the stat-arb pipeline. Heavy emphasis on overfitting as the central enemy. Islands: purged-cv-split + deflated-sharpe.',
  },
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
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
