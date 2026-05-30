/**
 * rss.xml endpoint — hand-rolled minimal RSS 2.0 feed of the English lessons
 * (@astrojs/rss isn't a dependency, so we build valid XML by hand).
 */
import type { APIRoute } from 'astro';
import { getLessons } from '@/lib/content';
import { localizePath } from '@/i18n/utils';
import { SITE } from '@/lib/site';

/** Escape the five XML predefined entities for safe text/attribute content. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL(import.meta.env.SITE)).origin;
  const lessons = await getLessons('en');

  const items = lessons
    .map((l) => {
      const link = new URL(localizePath(`/${l.topicSlug}/${l.lessonSlug}`, 'en'), origin).href;
      const updated = l.entry.data.updated;
      const pubDate = updated ? `<pubDate>${updated.toUTCString()}</pubDate>` : '';
      return [
        '    <item>',
        `      <title>${esc(l.entry.data.title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid>${esc(link)}</guid>`,
        `      <description>${esc(l.entry.data.description)}</description>`,
        pubDate ? `      ${pubDate}` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${esc(origin)}</link>
    <atom:link href="${esc(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>${esc(SITE.description)}</description>
    <language>en-US</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
