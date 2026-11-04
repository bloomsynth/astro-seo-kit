/**
 * Plain-text versions of a site for AI crawlers and assistants: llms.txt (an index), llms-full.txt
 * (everything) and a Markdown twin of every content page.
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

/**
 * @param {object} index
 * @param {string} index.name site name, the H1
 * @param {string} [index.summary] one-sentence summary, the blockquote
 * @param {string[]} [index.intro] paragraphs after the summary
 * @param {{ heading: string, items: [string, string][] }} [index.facts] label/value list, e.g. what a product is and costs
 * @param {{ heading: string, links: { title: string, url: string, description?: string }[] }[]} [index.sections]
 */
export function buildLlmsTxt({ name, summary, intro = [], facts, sections = [] }) {
  const lines = [`# ${name}`, ''];
  if (summary) lines.push(`> ${summary}`, '');
  for (const paragraph of intro) lines.push(paragraph, '');
  if (facts?.items?.length) {
    lines.push(`## ${facts.heading}`, '');
    for (const [label, value] of facts.items) lines.push(`- ${label}: ${value}`);
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

/** Markdown twin path of a page path: "/blog/x/" -> "/blog/x.md" */
export function markdownPath(pagePath) {
  return `${pagePath.replace(/\/$/, '')}.md`;
}
