import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { htmlFiles, pagePathOf } from './links.js';

/**
 * Checks on the built site, run before a change is merged. Errors block the merge; warnings are
 * reported. Content pages (entries of the configured collections) get the strict checks, since
 * that is what the writer agents produce; the rest of the site gets basic hygiene checks.
 */

const SKIPPED_TEXT = 'script,style,noscript,template,nav,header,footer,svg';
const SHINGLE = 5;
export const NEAR_DUPLICATE = 0.8;

export function parsePage(html, path) {
  const root = parse(html, { comment: false });
  const attr = (selector, name) => root.querySelector(selector)?.getAttribute(name)?.trim() || null;
  const jsonLdErrors = [];
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      JSON.parse(script.textContent);
    } catch (error) {
      jsonLdErrors.push(error.message);
    }
  }
  const robots = root
    .querySelectorAll('meta[name="robots"]')
    .map((meta) => meta.getAttribute('content') ?? '')
    .join(',')
    .toLowerCase();
  const links = root
    .querySelectorAll('a[href]')
    .map((anchor) => anchor.getAttribute('href').trim())
    .filter(Boolean);
  const imagesWithoutAlt = root.querySelectorAll('img').filter((img) => img.getAttribute('alt') == null).length;
  const h1 = root.querySelectorAll('h1').length;
  for (const node of root.querySelectorAll(SKIPPED_TEXT)) node.remove();
  const main = root.querySelector('main') ?? root.querySelector('article') ?? root.querySelector('body') ?? root;
  const words = main.structuredText
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  return {
    path,
    title: root.querySelector('title')?.textContent.replace(/\s+/g, ' ').trim() || null,
    description: attr('meta[name="description"]', 'content'),
    canonical: attr('link[rel="canonical"]', 'href'),
    noindex: robots.includes('noindex'),
    h1,
    imagesWithoutAlt,
    jsonLdErrors,
    links,
    words,
  };
}

/** Pages a path can be served from in the built site */
export function resolveTarget(href, fromPath, site) {
  let url;
  try {
    url = new URL(href, new URL(fromPath, site));
  } catch {
    return null;
  }
  if (url.origin !== new URL(site).origin) return null;
  return decodeURIComponent(url.pathname);
}

export function targetExists(outDir, path) {
  const clean = path.replace(/^\/+/, '');
  const candidates = path.endsWith('/')
    ? [join(outDir, clean, 'index.html')]
    : [join(outDir, clean), join(outDir, `${clean}.html`), join(outDir, clean, 'index.html')];
  return candidates.some((candidate) => existsSync(candidate));
}

function shingles(words) {
  const set = new Set();
  const lower = words.map((word) => word.toLowerCase());
  for (let i = 0; i + SHINGLE <= lower.length; i++) set.add(lower.slice(i, i + SHINGLE).join(' '));
  return set;
}

export function similarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared++;
  return shared / (a.size + b.size - shared);
}

/** The collection a path is an entry of (not the collection's own index page) */
export function contentCollectionOf(path, collections) {
  return collections.find((collection) => path.startsWith(collection.path) && path !== collection.path) ?? null;
}

const matches = (path, patterns = []) =>
  patterns.some((pattern) => (pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern));

export function checkPages(pages, { site, outDir, collections = [], check = {} }) {
  const issues = [];
  const add = (page, level, rule, message) => issues.push({ path: page.path, level, rule, message });
  const minWords = check.minWords ?? 300;
  const live = pages.filter((page) => !matches(page.path, check.ignore) && !page.path.endsWith('/404'));
  const content = live.filter((page) => !page.noindex && contentCollectionOf(page.path, collections));
  const contentPaths = new Set(content.map((page) => page.path));

  const titles = new Map();
  for (const page of live.filter((page) => !page.noindex)) {
    if (page.title) titles.set(page.title, [...(titles.get(page.title) ?? []), page.path]);
  }

  for (const page of live) {
    const strict = contentPaths.has(page.path);
    const level = strict ? 'error' : 'warning';
    if (!page.title) add(page, 'error', 'title', 'missing <title>');
    else if (page.title.length > 70) add(page, level, 'title', `title is ${page.title.length} characters (max 70)`);
    if (!page.description) add(page, level, 'description', 'missing meta description');
    else if (page.description.length < 70 || page.description.length > 170) {
      add(page, 'warning', 'description', `description is ${page.description.length} characters (aim for 120-160)`);
    }
    if (!page.canonical) add(page, level, 'canonical', 'missing canonical link');
    else if (!/^https?:\/\//.test(page.canonical)) add(page, 'error', 'canonical', 'canonical must be an absolute URL');
    for (const error of page.jsonLdErrors) add(page, 'error', 'json-ld', `invalid JSON-LD: ${error}`);
    if (page.h1 !== 1) add(page, strict ? 'error' : 'warning', 'h1', `${page.h1} <h1> elements (expected 1)`);
    if (page.imagesWithoutAlt) add(page, level, 'alt', `${page.imagesWithoutAlt} images without alt text`);

    const internal = [...new Set(page.links.map((href) => resolveTarget(href, page.path, site)).filter(Boolean))];
    for (const target of internal) {
      if (!targetExists(outDir, target)) add(page, 'error', 'broken-link', `links to ${target}, which does not exist`);
    }
    if (strict) {
      if (page.words.length < minWords) add(page, 'error', 'thin', `${page.words.length} words (min ${minWords})`);
      // What the writer wrote (the Markdown twin's body) must link to another page of the site; the
      // template's own links don't count. Without a twin, any link on the page counts.
      const written = page.bodyLinks
        ? [...new Set(page.bodyLinks.map((href) => resolveTarget(href, page.path, site)).filter(Boolean))]
        : internal;
      if (!written.some((target) => target !== page.path && target !== '/')) {
        add(page, 'error', 'internal-links', 'the text links to no other page of the site; add at least one relevant internal link');
      }
    }
  }

  for (const [title, paths] of titles) {
    if (paths.length > 1) {
      for (const path of paths) {
        const level = contentPaths.has(path) ? 'error' : 'warning';
        issues.push({ path, level, rule: 'duplicate-title', message: `same title as ${paths.filter((p) => p !== path).join(', ')}: "${title}"` });
      }
    }
  }

  const sets = content.map((page) => ({ page, set: shingles(page.words) }));
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const score = similarity(sets[i].set, sets[j].set);
      if (score >= NEAR_DUPLICATE) {
        for (const [page, other] of [[sets[i].page, sets[j].page], [sets[j].page, sets[i].page]]) {
          issues.push({
            path: page.path,
            level: 'error',
            rule: 'near-duplicate',
            message: `${Math.round(score * 100)}% the same text as ${other.path}`,
          });
        }
      }
    }
  }
  return issues;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const PRIMARY_KEYWORD = /^primaryKeyword:\s*(['"]?)(.*?)\1\s*$/m;
const DRAFT = /^draft:\s*true\s*$/m;

/** primaryKeyword of every non-draft Markdown/MDX file under `dir`, normalized */
export async function primaryKeywords(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) continue;
    const file = join(entry.parentPath ?? entry.path, entry.name);
    const frontmatter = (await readFile(file, 'utf8')).match(FRONTMATTER)?.[1];
    if (!frontmatter || DRAFT.test(frontmatter)) continue;
    const keyword = frontmatter.match(PRIMARY_KEYWORD)?.[2]?.replaceAll("''", "'");
    if (keyword) result.push({ file, keyword: keyword.toLowerCase().replace(/\s+/g, ' ').trim() });
  }
  return result;
}

export function duplicateKeywords(keywords) {
  const byKeyword = new Map();
  for (const item of keywords) byKeyword.set(item.keyword, [...(byKeyword.get(item.keyword) ?? []), item.file]);
  return [...byKeyword].filter(([, files]) => files.length > 1).map(([keyword, files]) => ({ keyword, files }));
}

const MARKDOWN_LINK = /\]\(\s*([^)\s]+)[^)]*\)/g;

/** Link targets in a Markdown text, e.g. [x](/a/) and [y](https://site/b/) */
export function markdownLinks(markdown) {
  return [...markdown.matchAll(MARKDOWN_LINK)].map((match) => match[1]);
}

export async function runCheck({ site, outDir, collections, check, contentDir }) {
  const pages = [];
  for (const file of await htmlFiles(outDir)) {
    const page = parsePage(await readFile(join(outDir, file), 'utf8'), pagePathOf(file));
    const twin = join(outDir, `${page.path.replace(/\/$/, '')}.md`);
    if (page.path !== '/' && existsSync(twin)) page.bodyLinks = markdownLinks(await readFile(twin, 'utf8'));
    pages.push(page);
  }
  const issues = checkPages(pages, { site, outDir, collections, check });
  for (const { keyword, files } of duplicateKeywords(await primaryKeywords(contentDir))) {
    issues.push({ path: files.join(', '), level: 'error', rule: 'primary-keyword', message: `"${keyword}" is the primaryKeyword of more than one page` });
  }
  return { pages: pages.length, issues };
}

export const issueKey = (issue) => `${issue.path}|${issue.rule}`;

/** Splits errors into new ones and ones already in the baseline (known issues of older pages) */
export function applyBaseline(issues, baseline = []) {
  const known = new Set(baseline);
  const errors = issues.filter((issue) => issue.level === 'error');
  return {
    newErrors: errors.filter((issue) => !known.has(issueKey(issue))),
    knownErrors: errors.filter((issue) => known.has(issueKey(issue))),
    fixed: [...known].filter((key) => !errors.some((issue) => issueKey(issue) === key)),
  };
}
