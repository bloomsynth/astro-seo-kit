/**
 * Plain-text versions of a site for AI crawlers and assistants: llms.txt (an index), llms-full.txt
 * (everything) and a Markdown twin of every content page and of every page listed in `pages`.
 */

const isoDate = (date) => (date instanceof Date ? date.toISOString().slice(0, 10) : date);

/**
 * @param {object} page
 * @param {string} page.title
 * @param {string} [page.description]
 * @param {string} page.url absolute URL of the HTML page
 * @param {Date|string} [page.published]
 * @param {Date|string} [page.updated]
 * @param {string} [page.tldr]
 * @param {string} [page.body] Markdown body
 * @param {{ q: string, a: string }[]} [page.faq]
 * @param {string} [page.publisher] e.g. "BloomSynth (https://bloomsynth.com)"
 * @param {string} [page.footer] closing line, e.g. a download link
 */
export function pageToMarkdown({ title, description, url, published, updated, tldr, body, faq = [], publisher, footer }) {
  const lines = [`# ${title}`, ''];
  if (description) lines.push(`> ${description}`, '');
  lines.push(`URL: ${url}`);
  if (published) lines.push(`Published: ${isoDate(published)}${updated ? ` (updated ${isoDate(updated)})` : ''}`);
  if (publisher) lines.push(`Publisher: ${publisher}`);
  lines.push('');
  if (tldr) lines.push('## Quick answer', '', tldr.trim(), '');
  if (body?.trim()) lines.push(body.trim(), '');
  if (faq.length) {
    lines.push('## Frequently asked questions', '');
    for (const { q, a } of faq) lines.push(`### ${q}`, '', a.trim(), '');
  }
  if (footer) lines.push('---', '', footer, '');
  return lines.join('\n');
}

/** Separates the pages of llms-full.txt */
export const FULL_SEPARATOR = '\n---\n\n';

/**
 * @param {object} index
 * @param {string} index.name site name, the H1
 * @param {string} [index.summary] one-sentence summary, the blockquote
 * @param {string[]} [index.intro] paragraphs after the summary
 * @param {FactsBlock | FactsBlock[]} [index.facts] label/value lists, e.g. what a product is and costs
 * @param {{ heading: string, links: { title: string, url: string, description?: string }[] }[]} [index.sections]
 * @typedef {{ heading: string, items: [string, string][] }} FactsBlock
 */
export function buildLlmsTxt({ name, summary, intro = [], facts, sections = [] }) {
  const lines = [`# ${name}`, ''];
  if (summary) lines.push(`> ${summary}`, '');
  for (const paragraph of intro) lines.push(paragraph, '');
  for (const block of [].concat(facts ?? [])) {
    if (!block?.items?.length) continue;
    lines.push(`## ${block.heading}`, '');
    for (const [label, value] of block.items) lines.push(`- ${label}: ${value}`);
    lines.push('');
  }
  for (const section of sections) {
    if (!section.links.length) continue;
    lines.push(`## ${section.heading}`, '');
    for (const link of section.links) {
      lines.push(`- [${link.title}](${link.url})${link.description ? `: ${link.description}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Puts the Markdown versions of pages right after the header of a built llms-full.txt, before the
 * collection entries the route wrote. `head` is the header the route started the file with.
 */
export function insertIntoFull(full, head, pages) {
  if (!pages.length) return full;
  if (!full.startsWith(head)) return [full.replace(/\n+$/, '\n'), ...pages].join(FULL_SEPARATOR);
  return [head, ...pages].join(FULL_SEPARATOR) + full.slice(head.length);
}

export function markdownResponse(body) {
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}

export function textResponse(body) {
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** The URL of a collection entry: `${path}${id}/`, where an id like "hi/slug" keeps its folder */
export function entryPath(path, id) {
  const base = path.endsWith('/') ? path : `${path}/`;
  return `${base}${id.replace(/\/index$/, '').replace(/^\/+|\/+$/g, '')}/`;
}

/** Markdown twin path of a page path: "/blog/x/" -> "/blog/x.md", "/" -> "/index.md" */
export function markdownPath(pagePath) {
  const path = pagePath.replace(/\.html$/, '').replace(/\/$/, '');
  return `${path || '/index'}.md`;
}

/**
 * A `pages` entry with its absolute URL and path. A page of this site gets a Markdown version
 * (built from its HTML after the build) unless it sets `markdown: false`.
 */
export function resolvePage(page, site) {
  const url = new URL(page.url, site);
  const twin = url.origin === new URL(site).origin && page.markdown !== false;
  return {
    ...page,
    url: url.toString(),
    path: url.pathname,
    markdownPath: twin ? markdownPath(url.pathname) : null,
    markdownUrl: twin ? new URL(markdownPath(url.pathname), site).toString() : null,
  };
}

/** Whether a path is inside a section such as "/latte-books/" ("/" holds everything) */
export const inSection = (path, sectionPath = '/') => path.startsWith(sectionPath);
