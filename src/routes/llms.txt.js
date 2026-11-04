import { buildLlmsTxt, textResponse } from '../llm.js';
import { config, entries } from './_entries.js';

export async function GET() {
  const items = await entries();
  const sections = [
    { heading: 'Pages', links: config.pages.map((page) => ({ ...page, url: new URL(page.url, config.site).toString() })) },
    ...config.collections.map((collection) => ({
      heading: collection.title,
      links: items
        .filter((item) => item.collection.collection === collection.collection)
        .map((item) => ({ title: item.entry.data.title, url: item.markdownUrl, description: item.entry.data.description })),
    })),
  ];
  return textResponse(
    buildLlmsTxt({ name: config.name, summary: config.summary, intro: config.intro, facts: config.facts, sections }),
  );
}
