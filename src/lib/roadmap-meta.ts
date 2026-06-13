/**
 * Roadmap metadata — PURE data, no astro:content imports, so it is safe to
 * import from anywhere including `astro.config.mjs` (which uses it to emit a
 * 301 redirect per tag from the retired /roadmap/<tag> pages to the catalog's
 * `?tag=` filter). A roadmap is a curated learning path (a subset of the
 * catalog) with a bilingual title, description, and icon. The tag itself
 * lives on each topic's frontmatter (`tags:`), so adding a course to a
 * roadmap is just editing its MDX file — no code changes here.
 */

export interface RoadmapMeta {
  /** Tag slug — matches the `tags:` value in topic MDX frontmatter. */
  tag: string;
  /** Emoji / icon for the roadmap card. */
  icon: string;
  /** Bilingual title. */
  title: { en: string; es: string };
  /** Bilingual one-line description. */
  description: { en: string; es: string };
  /** Display order on the home page (lower = earlier). */
  order: number;
}

/** All defined roadmaps, in display order. */
export const roadmaps: RoadmapMeta[] = [
  {
    tag: 'investing-basics',
    icon: '🌱',
    order: 0,
    title: { en: 'Investing Basics', es: 'Fundamentos de Inversión' },
    description: {
      en: 'From what money is to how bonds work — the absolute zero-to-investor path. No jargon assumed.',
      es: 'Desde qué es el dinero hasta cómo funcionan los bonos — el camino de cero a inversor. Sin tecnicismos.',
    },
  },
  {
    tag: 'stocks',
    icon: '📈',
    order: 1,
    title: { en: 'Stocks & Company Analysis', es: 'Bolsa y Análisis de Empresas' },
    description: {
      en: 'How exchanges, funds, order books, and balance sheets really work — pick stocks with your eyes open.',
      es: 'Cómo funcionan de verdad las bolsas, los fondos, los libros de órdenes y los balances — elige acciones con los ojos abiertos.',
    },
  },
  {
    tag: 'crypto',
    icon: '₿',
    order: 2,
    title: { en: 'Crypto', es: 'Cripto' },
    description: {
      en: 'Bitcoin, Ethereum, DeFi, and the mechanics of on-chain finance — from "magic internet money" to real understanding.',
      es: 'Bitcoin, Ethereum, DeFi y la mecánica de las finanzas on-chain — de "dinero mágico de internet" a entenderlo de verdad.',
    },
  },
  {
    tag: 'quantitative-finance',
    icon: '📊',
    order: 3,
    title: { en: 'Quantitative Finance', es: 'Finanzas Cuantitativas' },
    description: {
      en: 'Statistics, portfolio theory, risk models, Monte Carlo, stochastic processes, and Bayesian methods — the math that drives modern markets.',
      es: 'Estadística, teoría de carteras, modelos de riesgo, Monte Carlo, procesos estocásticos y métodos bayesianos — la matemática que mueve los mercados modernos.',
    },
  },
  {
    tag: 'derivatives',
    icon: '🎟️',
    order: 4,
    title: { en: 'Derivatives', es: 'Derivados' },
    description: {
      en: 'Futures, forwards, and options from first principles through pricing, Greeks, hedging, and on-chain perps — the full toolkit for risk management.',
      es: 'Futuros, forwards y opciones desde los primeros principios hasta precios, griegas, cobertura y perps on-chain — el kit completo de gestión de riesgo.',
    },
  },
  {
    tag: 'prediction-markets',
    icon: '🎲',
    order: 5,
    title: { en: 'Prediction Markets', es: 'Mercados de Predicción' },
    description: {
      en: 'How Polymarket turns opinions into probabilities — order books, oracles, calibration, and sizing bets with Kelly.',
      es: 'Cómo Polymarket convierte opiniones en probabilidades — libros de órdenes, oráculos, calibración y dimensionar apuestas con Kelly.',
    },
  },
  {
    tag: 'defi',
    icon: '🔁',
    order: 6,
    title: { en: 'DeFi', es: 'DeFi' },
    description: {
      en: 'Finance rebuilt on-chain — Ethereum, stablecoins, AMMs, lending, perps, and the MEV games underneath it all.',
      es: 'Las finanzas reconstruidas on-chain — Ethereum, stablecoins, AMMs, préstamos, perps y los juegos de MEV que hay debajo.',
    },
  },
  {
    tag: 'trading-and-markets',
    icon: '⚖️',
    order: 7,
    title: { en: 'Trading & Market Mechanics', es: 'Trading y Mecánica de Mercados' },
    description: {
      en: 'How orders actually become trades — exchanges, order books, futures, FX, and the psychology that wrecks traders.',
      es: 'Cómo las órdenes se convierten en operaciones — bolsas, libros de órdenes, futuros, divisas y la psicología que arruina a los traders.',
    },
  },
  {
    tag: 'fixed-income',
    icon: '💵',
    order: 8,
    title: { en: 'Fixed Income & Rates', es: 'Renta Fija y Tipos' },
    description: {
      en: 'Everything interest rates — from compound interest and mortgages to bonds, duration, convexity, and the yield curve.',
      es: 'Todo sobre los tipos de interés — del interés compuesto y las hipotecas a los bonos, la duración, la convexidad y la curva de tipos.',
    },
  },
  {
    tag: 'risk-management',
    icon: '🛡️',
    order: 9,
    title: { en: 'Risk Management', es: 'Gestión de Riesgos' },
    description: {
      en: 'Measure what can go wrong before it does — VaR, expected shortfall, tail risk, Monte Carlo, hedging, and ruin.',
      es: 'Mide lo que puede salir mal antes de que pase — VaR, expected shortfall, riesgo de cola, Monte Carlo, cobertura y ruina.',
    },
  },
  {
    tag: 'behavioral-finance',
    icon: '🧠',
    order: 10,
    title: { en: 'Behavioral Finance', es: 'Finanzas del Comportamiento' },
    description: {
      en: 'Why real investors are not rational — biases, heuristics, overconfidence, calibration, and being fooled by randomness.',
      es: 'Por qué los inversores reales no son racionales — sesgos, heurísticos, exceso de confianza, calibración y dejarse engañar por el azar.',
    },
  },
  {
    tag: 'macro-and-currencies',
    icon: '🌍',
    order: 11,
    title: { en: 'Macro & Currencies', es: 'Macro y Divisas' },
    description: {
      en: 'The big picture — money, inflation, GDP, central banks, bond markets, and how currencies trade against each other.',
      es: 'La visión global — dinero, inflación, PIB, bancos centrales, mercados de bonos y cómo se negocian las divisas entre sí.',
    },
  },
];

/** Quick lookup by tag. */
export const roadmapByTag = new Map<string, RoadmapMeta>(roadmaps.map((r) => [r.tag, r]));

/** All tag slugs in order. */
export const roadmapTags: string[] = roadmaps.map((r) => r.tag);
