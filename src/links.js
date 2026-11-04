import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * Outbound link attribution. Each rule adds one query parameter to links that start with `prefix`,
 * unless the link already has it, e.g. the Play Store install referrer:
 *
 *   { prefix: 'https://play.google.com/store/apps/details?id=com.bloomsynth.deva', param: 'referrer',
 *     value: 'utm_source=blog&utm_medium=article&utm_campaign={campaign}' }
 *
 * `{campaign}` is the page's slug (last path segment, "home" for the root) and `{path}` its path.
 * Tagging runs on the built HTML, so it covers Markdown, MDX and components alike.
 */

export function campaignFromPath(pagePath) {
  const segments = pagePath.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1] : 'home';
}

export function tagUrl(href, rules, pagePath) {
  const rule = rules.find((candidate) => href.startsWith(candidate.prefix));
  if (!rule) return null;
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.searchParams.has(rule.param)) return null;
  const value = rule.value.replaceAll('{campaign}', campaignFromPath(pagePath)).replaceAll('{path}', pagePath);
  url.searchParams.set(rule.param, value);
  return url.toString();
}

const decode = (value) => value.replaceAll('&amp;', '&');
const encode = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

const ANCHOR_HREF = /(<a\b[^>]*?\shref=)(["'])(.*?)\2/gis;

export function tagHtml(html, rules, pagePath) {
  let count = 0;
  const output = html.replace(ANCHOR_HREF, (match, start, quote, href) => {
    const tagged = tagUrl(decode(href), rules, pagePath);
    if (!tagged) return match;
    count++;
    return `${start}"${encode(tagged)}"`;
  });
  return { html: output, count };
}

/** "latte-books/guides/x/index.html" -> "/latte-books/guides/x/", "index.html" -> "/" */
export function pagePathOf(file) {
  const path = `/${file.split(sep).join('/')}`;
  if (path.endsWith('/index.html')) return path.slice(0, -'index.html'.length);
  return path.replace(/\.html$/, '');
}

export async function htmlFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => relative(dir, join(entry.parentPath ?? entry.path, entry.name)))
    .sort();
}

export async function tagLinksInDir(dir, rules) {
  let pages = 0;
  let links = 0;
  for (const file of await htmlFiles(dir)) {
    const path = join(dir, file);
    const { html, count } = tagHtml(await readFile(path, 'utf8'), rules, pagePathOf(file));
    if (count > 0) {
      await writeFile(path, html);
      pages++;
      links += count;
    }
  }
  return { pages, links };
}
