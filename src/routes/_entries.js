import { getCollection } from 'astro:content';
import config from 'virtual:astro-seo-kit/config';
import { FULL_SEPARATOR, buildLlmsTxt, entryPath, inSection, markdownPath, pageToMarkdown, resolvePage } from '../llm.js';

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
    footer: item.collection.footer ?? config.markdownFooter,
  };
}

/** The llms.txt link lists of a section ("/" for the whole site): its pages, then each collection */
export function linkSections(items, sectionPath = '/') {
  const pages = config.pages.map((page) => resolvePage(page, config.site)).filter((page) => inSection(page.path, sectionPath));
  return [
    { heading: 'Pages', links: pages.map((page) => ({ title: page.title, url: page.markdownUrl ?? page.url, description: page.description })) },
    ...config.collections.map((collection) => ({
      heading: collection.title,
      links: items
        .filter((item) => item.collection.collection === collection.collection && inSection(item.path, sectionPath))
        .map((item) => ({ title: item.entry.data.title, url: item.markdownUrl, description: item.entry.data.description })),
    })),
  ];
}

/** The site, or one of its `sections`, as the header fields of llms.txt */
export const headerOf = (section) =>
  section
    ? { name: section.name, summary: section.summary, intro: section.intro, facts: section.facts }
    : { name: config.name, summary: config.summary, intro: config.intro, facts: config.facts };

/** llms.txt of the site or of one section */
export async function llmsTxt(section) {
  return buildLlmsTxt({ ...headerOf(section), sections: linkSections(await entries(), section?.path) });
}

/** llms-full.txt of the site or of one section, before the build adds the Markdown versions of `pages` */
export async function llmsFullTxt(section) {
  const items = (await entries()).filter((item) => inSection(item.path, section?.path));
  return [buildLlmsTxt(headerOf(section)), ...items.map((item) => pageToMarkdown(toMarkdownInput(item)))].join(FULL_SEPARATOR);
}

export { config };
