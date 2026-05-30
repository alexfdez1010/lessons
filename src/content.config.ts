import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content model
 * -------------
 * A "topic" is a subject (e.g. "transformers"). It owns many "lessons".
 * URLs are slug-based and SEO-friendly:
 *   /<topic>            -> topic landing page      (topics collection id)
 *   /<topic>/<lesson>   -> a single lesson page    (lessons collection id)
 *
 * File layout:
 *   src/content/topics/<topic>.mdx
 *   src/content/lessons/<topic>/<lesson>.mdx
 *
 * The lesson id (used for the slug) is "<topic>/<lesson>" thanks to the glob
 * pattern below, so routing can split on "/".
 */

const seo = z
  .object({
    /** Override the <title>. Defaults to the page title. */
    title: z.string().optional(),
    /** Override the meta description. Defaults to `description`. */
    description: z.string().optional(),
    /** Override the generated OG image path (e.g. "/og/custom.png"). */
    ogImage: z.string().optional(),
    /** Comma-free list of keywords for the meta keywords tag. */
    keywords: z.array(z.string()).default([]),
    /** Exclude from sitemap + add noindex when true. */
    noindex: z.boolean().default(false),
  })
  .default({});

const topics = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    /** One-line summary shown on cards + used as default meta description. */
    description: z.string(),
    /** Short tagline rendered under the hero title. */
    tagline: z.string().optional(),
    /** Emoji or short label for the topic chip. */
    icon: z.string().default('📘'),
    /** Sort order within the catalog. Lower = earlier. */
    order: z.number().default(999),
    /** Accent color token suffix, e.g. "brand" | "accent". */
    accent: z.enum(['brand', 'accent']).default('brand'),
    draft: z.boolean().default(false),
    seo,
  }),
});

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Reference to the owning topic (its collection id). */
    topic: reference('topics'),
    /** Position within the topic. Lower = earlier. */
    order: z.number().default(999),
    /** Estimated read/work time, minutes. */
    minutes: z.number().optional(),
    draft: z.boolean().default(false),
    updated: z.coerce.date().optional(),
    seo,
  }),
});

export const collections = { topics, lessons };
