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
    slug: 'agent-based-market-simulation',
    icon: '🐜',
    difficulty: 'expert',
    order: 16,
    accent: 'accent',
    title: {
      en: 'Agent-Based Models & Market Simulation',
      es: 'Modelos Basados en Agentes y Simulación de Mercados',
    },
    description: {
      en: 'Grow a market from the bottom up: simulate it as a swarm of interacting agents — zero-intelligence traders, market makers, momentum and value players, learned RL bots — then calibrate it to real stylized facts and use it as a sandbox the historical tape can never give you.',
      es: 'Haz crecer un mercado de abajo arriba: simúlalo como un enjambre de agentes que interactúan —traders de inteligencia cero, creadores de mercado, jugadores de momentum y de valor, bots de RL aprendidos— calíbralo con los hechos estilizados reales y úsalo como un laboratorio que la serie histórica nunca puede darte.',
    },
    dependencies: ['generative-models-for-synthetic-market-data', 'deep-rl-for-execution-and-market-making'],
    tags: ['quantitative-finance'],
    buildNotes:
      'The other answer to "you only have one history": instead of LEARNING a generator (the generative-models course), BUILD the market mechanistically as interacting agents and let the price path emerge. Agent-based models (ABMs) for markets: zero-intelligence agents as the surprising baseline, the Santa Fe artificial stock market, the ABIDES/multi-agent-LOB lineage, and how heterogeneous strategies (market makers, momentum/trend, fundamental/value, noise, and the RL agents from deep-rl-for-execution-and-market-making) produce emergent stylized facts. The calibration problem: how do you tune an ABM so its output matches the fat tails, volatility clustering and autocorrelations from time-series-finance — and how do you VALIDATE it (the same "did you fool yourself?" discipline as synthetic data). Killer uses an ABM gives you that backtests cannot: counterfactual market structure (tick size, latency, a circuit breaker), flash-crash and feedback-loop stress testing, and a non-stationary training ground for RL that pushes back. Contrast ABM (bottom-up, mechanistic, interpretable) vs deep generative models (top-down, learned, opaque). Islands: agent-population-mixer + emergent-stylized-facts.',
  },
  {
    slug: 'foundation-models-for-financial-time-series',
    icon: '🧠',
    difficulty: 'expert',
    order: 17,
    accent: 'brand',
    title: {
      en: 'Foundation Models for Financial Time Series',
      es: 'Modelos Fundacionales para Series Temporales Financieras',
    },
    description: {
      en: 'The pretrain-and-adapt playbook meets markets: large time-series foundation models and LLM-driven research, zero/few-shot forecasting, multimodal price-plus-news signals — and a brutal audit of whether any of it survives contact with an efficient, non-stationary market.',
      es: 'El manual de preentrenar-y-adaptar se topa con los mercados: grandes modelos fundacionales de series temporales e investigación impulsada por LLM, predicción zero/few-shot, señales multimodales de precio-más-noticias — y una auditoría brutal de si algo de esto sobrevive al contacto con un mercado eficiente y no estacionario.',
    },
    dependencies: ['deep-learning-for-market-data', 'generative-models-for-synthetic-market-data'],
    tags: ['quantitative-finance'],
    buildNotes:
      'The frontier on top of deep-learning-for-market-data: stop training one model per task and PRETRAIN a foundation model, then adapt it. Time-series foundation models (the TimesFM / Chronos / Moirai / Lag-Llama lineage): pretraining objectives, tokenizing continuous returns, zero-shot and few-shot forecasting, and scaling laws — do they even hold on financial data? LLMs as research tools and as signals: sentiment/event extraction from filings and news, multimodal price+text models, LLM agents for hypothesis generation, and the leakage minefield (lookahead in pretraining corpora, the model having memorized the future). The honest evaluation, carrying forward the deflated-Sharpe / purged-CV discipline from the ML-for-alpha courses: foundation models are trained on near-stationary domains (language, weather) and markets are adversarial and non-stationary, so benchmark wins rarely translate to PnL. Where pretraining genuinely helps (cross-asset transfer, cold-start, data-poor regimes) vs where it is hype. Islands: pretrain-finetune-timeline + zero-shot-vs-fitted-forecast.',
  },
  {
    slug: 'causal-inference-for-alpha-and-execution',
    icon: '🎯',
    difficulty: 'expert',
    order: 18,
    accent: 'accent',
    title: {
      en: 'Causal Inference for Alpha & Execution',
      es: 'Inferencia Causal para Alfa y Ejecución',
    },
    description: {
      en: 'The discipline that separates "my signal predicts returns" from "my signal causes returns": potential outcomes, confounding, natural experiments, instrumental variables and double machine learning — aimed squarely at trading signals and the true cost of your own trades.',
      es: 'La disciplina que separa «mi señal predice rendimientos» de «mi señal causa rendimientos»: resultados potenciales, confusión, experimentos naturales, variables instrumentales y doble machine learning — apuntando de lleno a las señales de trading y al coste real de tus propias operaciones.',
    },
    dependencies: ['deep-learning-for-market-data', 'systematic-and-statistical-arbitrage'],
    tags: ['quantitative-finance'],
    buildNotes:
      'The capstone critique of everything predictive: a backtest shows correlation, but capital is allocated on the belief that the signal CAUSES the return — and confounding quietly wrecks that leap. Causal inference for quant: the potential-outcomes / Rubin framework and causal DAGs, confounders vs colliders, why "control for everything" (collider bias, bad controls) backfires, and how this reframes factor zoo / overfitting from the systematic-and-statistical-arbitrage course. The estimation toolkit pointed at finance: natural experiments and event studies (index reconstitutions, regulatory shocks), difference-in-differences, instrumental variables, regression discontinuity, and double/debiased machine learning (DML) layered on the models from deep-learning-for-market-data. The sharpest application: market impact and transaction-cost analysis as a CAUSAL problem — your own trade moves the price, so naive TCA is hopelessly confounded by why you traded; this ties straight back to optimal-execution. Honest limits: unobserved confounders, the un-testable assumptions every method rests on, and why an RCT is a luxury markets rarely grant. Islands: confounder-dag-explorer + correlation-vs-causation-backtest.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
