/**
 * Roadmaps registry — maps a tag to its metadata and helpers.
 * A roadmap is a curated learning path (a subset of the catalog) with a
 * bilingual title, description, and icon. The tag itself lives on each
 * topic's frontmatter (`tags:`), so adding a course to a roadmap is just
 * editing its MDX file — no code changes here.
 */

import { getTopics, getLessons, type TopicView } from '@/lib/content';
import type { Lang } from '@/i18n/utils';

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
    tag: 'crypto',
    icon: '₿',
    order: 1,
    title: { en: 'Crypto', es: 'Cripto' },
    description: {
      en: 'Bitcoin, Ethereum, DeFi, and the mechanics of on-chain finance — from "magic internet money" to real understanding.',
      es: 'Bitcoin, Ethereum, DeFi y la mecánica de las finanzas on-chain — de "dinero mágico de internet" a entenderlo de verdad.',
    },
  },
  {
    tag: 'quantitative-finance',
    icon: '📊',
    order: 2,
    title: { en: 'Quantitative Finance', es: 'Finanzas Cuantitativas' },
    description: {
      en: 'Statistics, portfolio theory, risk models, Monte Carlo, stochastic processes, and Bayesian methods — the math that drives modern markets.',
      es: 'Estadística, teoría de carteras, modelos de riesgo, Monte Carlo, procesos estocásticos y métodos bayesianos — la matemática que mueve los mercados modernos.',
    },
  },
  {
    tag: 'derivatives',
    icon: '🎟️',
    order: 3,
    title: { en: 'Derivatives', es: 'Derivados' },
    description: {
      en: 'Options from first principles through pricing, Greeks, and hedging — the full toolkit for structured products and risk management.',
      es: 'Opciones desde los primeros principios hasta precios, griegas y cobertura — el kit completo para productos estructurados y gestión de riesgo.',
    },
  },
  {
    tag: 'prediction-markets',
    icon: '🎲',
    order: 4,
    title: { en: 'Prediction Markets', es: 'Mercados de Predicción' },
    description: {
      en: 'How Polymarket turns opinions into probabilities — order books, oracles, calibration, and sizing bets with Kelly.',
      es: 'Cómo Polymarket convierte opiniones en probabilidades — libros de órdenes, oráculos, calibración y dimensionar apuestas con Kelly.',
    },
  },
];

/** Quick lookup by tag. */
export const roadmapByTag = new Map<string, RoadmapMeta>(
  roadmaps.map((r) => [r.tag, r]),
);

/** All tag slugs in order. */
export const roadmapTags: string[] = roadmaps.map((r) => r.tag);

/**
 * Summary of a roadmap for a given locale — includes live course count and
 * the difficulty range of the topics that carry this tag.
 */
export interface RoadmapSummary {
  meta: RoadmapMeta;
  courseCount: number;
  minDifficulty: string;
  maxDifficulty: string;
}

/** Difficulty rank for range comparison. */
const DIFF_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

function rankOf(d?: string): number {
  return d && d in DIFF_RANK ? DIFF_RANK[d] : -1;
}

/**
 * Return summaries for every roadmap in display order, with live counts
 * and difficulty ranges from the actual topics collection.
 */
export async function getRoadmapSummaries(lang: Lang): Promise<RoadmapSummary[]> {
  const allTopics = await getTopics(lang);
  return roadmaps.map((meta) => {
    const topics = allTopics.filter((t) => t.entry.data.tags?.includes(meta.tag));
    const difficulties = topics
      .map((t) => t.entry.data.difficulty)
      .filter((d): d is 'beginner' | 'intermediate' | 'advanced' | 'expert' => !!d && d in DIFF_RANK)
      .sort((a, b) => rankOf(a) - rankOf(b));
    return {
      meta,
      courseCount: topics.length,
      minDifficulty: difficulties[0] ?? 'beginner',
      maxDifficulty: difficulties[difficulties.length - 1] ?? 'beginner',
    };
  });
}

/**
 * Topics that carry a given tag, sorted by the catalog order (difficulty
 * then manual order), with lesson counts.
 */
export async function getTopicsByTag(
  lang: Lang,
  tag: string,
): Promise<{ topic: TopicView; lessons: number; lessonSlugs: string[] }[]> {
  const allTopics = await getTopics(lang);
  const filtered = allTopics.filter((t) => t.entry.data.tags?.includes(tag));
  const withCounts = await Promise.all(
    filtered.map(async (topic) => {
      const lessons = await getLessons(lang, topic.slug);
      return { topic, lessons: lessons.length, lessonSlugs: lessons.map((l) => l.lessonSlug) };
    }),
  );
  return withCounts;
}
