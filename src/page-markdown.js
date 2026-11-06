import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildLlmsTxt, inSection, insertIntoFull, pageToMarkdown, resolvePage } from './llm.js';
import { htmlToMarkdown } from './markdown.js';

/**
 * Markdown versions of the `pages` entries, which are usually .astro pages with no Markdown source.
 * Runs after the build: each page's built HTML is turned into Markdown, written next to it
 * (`/x/` -> `/x.md`), and added to llms-full.txt (and to the llms-full.txt of its section).
 */

/** The built HTML file of a page path, if there is one */
export function builtHtml(outDir, path) {
  const clean = decodeURIComponent(path).replace(/^\/+/, '');
  const candidates = path.endsWith('/')
    ? [join(outDir, clean, 'index.html')]
    : [join(outDir, `${clean}.html`), join(outDir, clean, 'index.html'), join(outDir, clean)];
  return candidates.find((candidate) => candidate.endsWith('.html') && existsSync(candidate)) ?? null;
}

const fileOf = (outDir, urlPath) => join(outDir, decodeURIComponent(urlPath).replace(/^\/+/, ''));

/**
 * @param {object} options
 * @param {string} options.outDir the build output directory
 * @param {string} options.site
 * @param {ReturnType<import('./index.js').normalizeOptions>} options.config
 * @returns {Promise<{ written: string[], warnings: string[] }>} the paths written and what was skipped
 */
export async function writePageMarkdown({ outDir, site, config }) {
  const written = [];
  const warnings = [];
  const pages = [];
  for (const page of config.pages.map((entry) => resolvePage(entry, site))) {
    if (!page.markdownPath) continue;
    const html = builtHtml(outDir, page.path);
    if (!html) {
      warnings.push(`pages: ${page.path} was not built, so it has no Markdown version`);
      continue;
    }
    const target = fileOf(outDir, page.markdownPath);
    if (existsSync(target)) {
      warnings.push(`pages: ${page.markdownPath} already exists, so it was left as it is`);
      continue;
    }
    const converted = htmlToMarkdown(await readFile(html, 'utf8'), page.url);
    const markdown = pageToMarkdown({
      title: converted.title ?? page.title,
      description: converted.description ?? page.description,
      url: page.url,
      body: converted.body,
      publisher: `${config.publisher.name} (${config.publisher.url})`,
      footer: page.footer ?? config.markdownFooter,
    });
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, markdown);
    written.push(page.markdownPath);
    pages.push({ path: page.path, markdown });
  }

  const fulls = [
    { file: 'llms-full.txt', head: { name: config.name, summary: config.summary, intro: config.intro, facts: config.facts }, path: '/' },
    ...config.sections.map((section) => ({
      file: `${section.path.replace(/^\//, '')}llms-full.txt`,
      head: { name: section.name, summary: section.summary, intro: section.intro, facts: section.facts },
      path: section.path,
    })),
  ];
  for (const full of fulls) {
    const file = join(outDir, full.file);
    if (!existsSync(file)) continue;
    const markdowns = pages.filter((page) => inSection(page.path, full.path)).map((page) => page.markdown);
    await writeFile(file, insertIntoFull(await readFile(file, 'utf8'), buildLlmsTxt(full.head), markdowns));
  }
  return { written, warnings };
}
