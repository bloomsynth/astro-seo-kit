import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tagLinksInDir } from './links.js';
import { writePageMarkdown } from './page-markdown.js';

const VIRTUAL_ID = 'virtual:astro-seo-kit/config';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const route = (name) => fileURLToPath(new URL(`./routes/${name}`, import.meta.url));

/** `facts` may be one block or a list of blocks */
function factsOf(facts) {
  const blocks = [].concat(facts ?? []);
  for (const block of blocks) {
    if (!block?.heading || !Array.isArray(block.items)) throw new Error('astro-seo-kit: each facts block needs a `heading` and `items`');
  }
  return blocks;
}

export function normalizeOptions(options = {}) {
  if (!options.name) throw new Error('astro-seo-kit: `name` (the site name) is required');
  if (!options.publisher?.name || !options.publisher?.url) {
    throw new Error('astro-seo-kit: `publisher` needs a name and a url');
  }
  const collections = (options.collections ?? []).map((collection) => {
    if (!collection.collection || !collection.path?.startsWith('/')) {
      throw new Error('astro-seo-kit: each collection needs `collection` and a `path` starting with "/"');
    }
    return { title: collection.path, ...collection, path: collection.path.endsWith('/') ? collection.path : `${collection.path}/` };
  });
  const pages = (options.pages ?? []).map((page) => {
    if (!page.title || !page.url) throw new Error('astro-seo-kit: each page needs a `title` and a `url`');
    return page;
  });
  const sections = (options.sections ?? []).map((section) => {
    if (!section.name || !section.path?.startsWith('/') || section.path === '/') {
      throw new Error('astro-seo-kit: each section needs a `name` and a `path` below "/", such as "/docs/"');
    }
    return {
      summary: '',
      intro: [],
      ...section,
      path: section.path.endsWith('/') ? section.path : `${section.path}/`,
      facts: factsOf(section.facts),
    };
  });
  return {
    name: options.name,
    summary: options.summary ?? '',
    intro: options.intro ?? [],
    facts: factsOf(options.facts),
    publisher: { sameAs: [], ...options.publisher },
    collections,
    pages,
    sections,
    markdownFooter: options.markdownFooter ?? '',
    robots: options.robots === false ? false : { disallow: ['/cdn-cgi/'], ...(options.robots === true ? {} : options.robots) },
    linkRules: options.linkRules ?? [],
    check: { minWords: 300, ...options.check },
  };
}

/**
 * Astro integration. Adds /llms.txt, /llms-full.txt (and both for each of `sections`), a Markdown
 * twin of every collection entry (`/path/slug.md`) and /robots.txt. After the build it tags outbound
 * links, writes the Markdown twins of `pages` from their HTML, and records the settings `seo-check`
 * reads. See README.md.
 */
export default function seoKit(options) {
  const config = normalizeOptions(options);
  let site;
  let root;
  return {
    name: '@bloomsynth/astro-seo-kit',
    hooks: {
      'astro:config:setup': ({ config: astroConfig, injectRoute, updateConfig }) => {
        if (!astroConfig.site) throw new Error('astro-seo-kit: set `site` in astro.config');
        site = astroConfig.site;
        root = astroConfig.root;
        const runtime = { ...config, site };
        updateConfig({
          vite: {
            ssr: { noExternal: ['@bloomsynth/astro-seo-kit'] },
            plugins: [
              {
                name: 'astro-seo-kit-config',
                resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
                load: (id) => (id === RESOLVED_ID ? `export default ${JSON.stringify(runtime)};` : undefined),
              },
            ],
          },
        });
        injectRoute({ pattern: '/llms.txt', entrypoint: route('llms.txt.js'), prerender: true });
        injectRoute({ pattern: '/llms-full.txt', entrypoint: route('llms-full.txt.js'), prerender: true });
        if (config.sections.length) {
          injectRoute({ pattern: '/[...llmsSection]/llms.txt', entrypoint: route('section-llms.txt.js'), prerender: true });
          injectRoute({ pattern: '/[...llmsSection]/llms-full.txt', entrypoint: route('section-llms-full.txt.js'), prerender: true });
        }
        if (config.collections.length) {
          injectRoute({ pattern: '/[...mdpath].md', entrypoint: route('markdown.js'), prerender: true });
        }
        if (config.robots) {
          injectRoute({ pattern: '/robots.txt', entrypoint: route('robots.txt.js'), prerender: true });
        }
      },
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        if (config.linkRules.length) {
          const { pages, links } = await tagLinksInDir(outDir, config.linkRules);
          logger.info(`tagged ${links} outbound links on ${pages} pages`);
        }
        // After link tagging, so the Markdown links carry the same attribution as the HTML
        const { written, warnings } = await writePageMarkdown({ outDir, site, config });
        for (const warning of warnings) logger.warn(warning);
        if (written.length) logger.info(`wrote Markdown versions of ${written.length} pages`);
        const cacheDir = new URL('./.astro/', root);
        await mkdir(cacheDir, { recursive: true });
        await writeFile(
          new URL('./seo-kit.json', cacheDir),
          JSON.stringify({ site, outDir, collections: config.collections, check: config.check }, null, 2),
        );
      },
    },
  };
}

export { seoFields, requireCoverAlt } from './schema.js';
