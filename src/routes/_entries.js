import { getCollection } from 'astro:content';
import config from 'virtual:astro-seo-kit/config';
import { entryPath, markdownPath } from '../llm.js';

/** Every published entry of the configured collections, with its URLs */
export async function entries() {
  const result = [];
  for (const collection of config.collections) {
    const items = await getCollection(collection.collection, (entry) => !entry.data.draft);
    for (const entry of items) {
      const path = entryPath(collection.path, entry.id);
      result.push({
        collection,
        entry,
        path,
        url: new URL(path, config.site).toString(),
        markdownPath: markdownPath(path),
        markdownUrl: new URL(markdownPath(path), config.site).toString(),
      });
    }
  }
  return result.sort((a, b) => {
    const dateA = a.entry.data.updatedDate ?? a.entry.data.pubDate ?? 0;
    const dateB = b.entry.data.updatedDate ?? b.entry.data.pubDate ?? 0;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
}

export function toMarkdownInput(item) {
  const { data, body } = item.entry;
  return {
    title: data.title,
    description: data.description,
    url: item.url,
    published: data.pubDate,
    updated: data.updatedDate,
    tldr: data.tldr,
    body,
    faq: data.faq ?? [],
    publisher: `${config.publisher.name} (${config.publisher.url})`,
    footer: config.markdownFooter,
  };
}

export { config };
