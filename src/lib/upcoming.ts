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
 * The agent has TWO modes, decided by whether this array still has entries.
 *
 * MODE A — queue NOT empty: build the LOWEST-`order` entry, then DELETE it.
 *   • Build strictly within the finance scope in CLAUDE.md (quantitative
 *     finance, crypto, DeFi). One topic per run, en + es twin.
 *   • Go in order: build the lowest-`order` upcoming entry first. Never build
 *     something easier than the most recently built course (keep the ramp
 *     monotone).
 *   • Use the entry's `buildNotes` as the build brief, its `dependencies`/`tags`
 *     for catalog wiring, and keep the same `slug` for the topic MDX so it
 *     graduates cleanly.
 *   • After building, REMOVE its entry here (the topic MDX is now the record).
 *   • Do NOT append new entries. Once these planned courses are built the
 *     catalog is considered complete — let the queue empty out.
 *
 * MODE B — queue EMPTY (`[]`): the catalog is complete. The agent NO LONGER
 *   adds courses. Each run instead picks ONE already-built topic AT RANDOM
 *   (e.g. `ls src/content/topics/en/ | shuf -n1`, varying the pick run to run),
 *   reviews its current state against the mission (zero-to-expert depth, worked
 *   examples, animation coverage, interaction density, quiz quality, accuracy,
 *   en/es parity), and proposes + implements concrete improvements to that one
 *   topic. This array stays empty and is left untouched.
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
  {
    slug: 'graph-neural-networks-for-financial-networks',
    icon: '🕸️',
    difficulty: 'expert',
    order: 19,
    accent: 'brand',
    title: {
      en: 'Graph Neural Networks for Financial Networks & Systemic Risk',
      es: 'Redes Neuronales de Grafos para Redes Financieras y Riesgo Sistémico',
    },
    description: {
      en: 'Markets are not a table of returns — they are a graph: banks lending to banks, firms wired into supply chains, assets co-moving, wallets transacting on-chain. Learn graph neural networks — message passing, node/edge/graph tasks — and aim them at the problems a flat table cannot see: contagion, systemic risk, fraud rings, and relational alpha.',
      es: 'Los mercados no son una tabla de rendimientos — son un grafo: bancos que prestan a bancos, empresas cableadas en cadenas de suministro, activos que co-mueven, monederos que transaccionan en cadena. Aprende redes neuronales de grafos —paso de mensajes, tareas de nodo/arista/grafo— y apúntalas a los problemas que una tabla plana no puede ver: contagio, riesgo sistémico, redes de fraude y alfa relacional.',
    },
    dependencies: ['deep-learning-for-market-data'],
    tags: ['quantitative-finance'],
    buildNotes:
      'The structural turn on top of deep-learning-for-market-data: most ML in finance flattens the world into a feature table and throws away the RELATIONSHIPS, but finance is natively a graph. Graph neural networks (GNNs) for finance: represent the system as nodes + edges (interbank lending, supply-chain links, asset correlation graphs, on-chain wallet/transaction graphs), the message-passing paradigm (aggregate-from-neighbours), and the three task types — node-level (classify/score an institution or wallet), edge-level (predict a new link, e.g. a counterparty exposure or a fraud transfer), graph-level (score a whole portfolio/market state). The architecture lineage: GCN, GraphSAGE (inductive, scales to new nodes), GAT (attention over neighbours), and temporal/dynamic GNNs for evolving networks. Killer finance applications: SYSTEMIC RISK & contagion (model how a default cascades through the lending network — a DebtRank/feedback story the tabular models structurally miss), fraud & AML ring detection on transaction graphs, relational alpha (cross-asset/peer-firm signal propagation), and on-chain analytics. The honest audit, carrying the deflated-Sharpe / leakage discipline: graphs leak HARD (a node sees its neighbours, so train/test splits must be topology-aware — no peeking across edges), over-smoothing as you stack layers, non-stationary topology, and the heavy data-plumbing cost. Contrast GNN (relational, structural) vs sequence models from deep-learning-for-market-data (temporal, per-asset). Islands: message-passing-animator + contagion-cascade-graph.',
  },
  {
    slug: 'adversarial-ml-and-robustness-in-trading',
    icon: '🛡️',
    difficulty: 'expert',
    order: 20,
    accent: 'accent',
    title: {
      en: 'Adversarial Machine Learning & Model Robustness in Trading',
      es: 'Machine Learning Adversarial y Robustez de Modelos en Trading',
    },
    description: {
      en: 'Markets are adversarial: other agents probe, spoof, and trade against your model, and the data shifts the instant you deploy. Learn adversarial examples and data poisoning aimed at trading models, distribution shift and concept drift, and the robustness toolkit — adversarial training, robust optimization, and honest stress evaluation — for systems that must survive an opponent, not a benchmark.',
      es: 'Los mercados son adversariales: otros agentes sondean, hacen spoofing y operan contra tu modelo, y los datos cambian en el instante en que despliegas. Aprende ejemplos adversariales y envenenamiento de datos apuntados a modelos de trading, cambio de distribución y deriva de concepto, y la caja de herramientas de robustez —entrenamiento adversarial, optimización robusta y evaluación de estrés honesta— para sistemas que deben sobrevivir a un oponente, no a un benchmark.',
    },
    dependencies: ['machine-learning-for-alpha', 'deep-learning-for-market-data'],
    tags: ['quantitative-finance'],
    buildNotes:
      'The security mindset for quant ML: every other course assumes the data-generating process is indifferent to you — this one assumes it is HOSTILE. Adversarial machine learning for trading: adversarial examples (tiny, crafted input perturbations that flip a model — the FGSM/PGD lineage) reframed for market features, data poisoning and backdoor attacks (an adversary who can nudge the order flow your model learns from, e.g. spoofing/layering to bait a signal), and model extraction/inference attacks against a deployed strategy. The non-stationary, non-malicious half: distribution shift and concept drift (covariate vs label shift), why a strategy decays the moment it is live (the market adapts, alpha crowds out), and drift detection. The robustness toolkit: adversarial training and robust optimization (distributionally-robust optimization / DRO, min-max objectives), regularization and ensembling for stability, conformal prediction for honest uncertainty under shift, and stress evaluation against a worst-case opponent rather than an i.i.d. test set. Carry the deflated-Sharpe / "did you fool yourself" creed all the way: robustness claims are easy to fake, so the evaluation must be adversarial too. Ties to systematic-and-statistical-arbitrage (alpha decay) and deep-rl-for-execution (an environment that reacts). Islands: adversarial-perturbation-explorer + drift-detector-timeline.',
  },
  {
    slug: 'quantum-computing-for-finance',
    icon: '⚛️',
    difficulty: 'expert',
    order: 21,
    accent: 'brand',
    title: {
      en: 'Quantum Computing for Finance',
      es: 'Computación Cuántica para Finanzas',
    },
    description: {
      en: 'The frontier-hardware bet: where quantum algorithms might actually help finance, and where it is pure hype. Amplitude estimation for a quadratic Monte-Carlo speedup in option pricing and risk, QAOA and quantum annealing for portfolio optimization, quantum-inspired methods you can run on classical hardware today — and a clear-eyed audit of the noise, qubit-count, and data-loading walls between the promise and a real edge.',
      es: 'La apuesta por el hardware de frontera: dónde podrían ayudar de verdad los algoritmos cuánticos a las finanzas, y dónde es puro bombo. Estimación de amplitud para una aceleración cuadrática de Monte Carlo en valoración de opciones y riesgo, QAOA y recocido cuántico para optimización de carteras, métodos inspirados en lo cuántico que puedes ejecutar hoy en hardware clásico — y una auditoría lúcida de los muros de ruido, número de cúbits y carga de datos entre la promesa y una ventaja real.',
    },
    dependencies: ['monte-carlo-finance', 'portfolio-optimization'],
    tags: ['quantitative-finance'],
    buildNotes:
      'The deepest frontier topic: a sober, technical map of quantum computing for finance that neither dismisses nor oversells it. Foundations just enough to use: qubits, superposition, entanglement, gates, and the two hardware paradigms (gate-model vs quantum annealing) — taught for the finance reader, not the physicist. The three application pillars: (1) Quantum Amplitude Estimation (QAE) giving a QUADRATIC speedup over classical Monte Carlo for option pricing and risk (VaR/CVaR) — the cleanest theoretical win, built directly on monte-carlo-finance; (2) portfolio optimization as QUBO solved with QAOA (gate model) or quantum annealing (D-Wave), handling cardinality/discrete constraints that choke classical convex solvers, building on portfolio-optimization; (3) quantum machine learning (quantum kernels, variational classifiers) for signals — with heavy skepticism. The reality check that anchors the whole course: the bottlenecks that make near-term advantage elusive — NISQ-era noise and decoherence, qubit counts and error correction overhead, and above all the DATA-LOADING / state-preparation problem (loading classical market data into amplitudes can erase the speedup). What is usable TODAY: quantum-inspired / tensor-network classical algorithms. Keep the same evidential discipline as the ML courses: a theoretical speedup is not a PnL edge until the end-to-end pipeline (including loading and readout) beats the best classical baseline. Islands: amplitude-estimation-convergence + qubo-portfolio-annealer.',
  },
];

/** Quick lookup by slug. */
export const upcomingBySlug = new Map<string, UpcomingCourse>(
  upcomingCourses.map((c) => [c.slug, c]),
);
