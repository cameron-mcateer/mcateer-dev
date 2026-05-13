import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const isProd = import.meta.env.PROD;

  const projects = (await getCollection('projects'))
    .filter((e) => !isProd || !e.data.draft)
    .map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.summary,
      link: `/projects/${e.id}/`,
      categories: ['project'],
    }));

  const notes = (await getCollection('notes'))
    .filter((e) => !isProd || !e.data.draft)
    .map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.summary ?? '',
      link: `/notes/${e.id}/`,
      categories: ['note'],
    }));

  const items = [...projects, ...notes].sort(
    (a, b) => b.pubDate.getTime() - a.pubDate.getTime()
  );

  return rss({
    title: 'Cameron McAteer',
    description: 'Projects and notes.',
    site: context.site!,
    items,
  });
}
