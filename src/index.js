import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tagLinksInDir } from './links.js';

const VIRTUAL_ID = 'virtual:astro-seo-kit/config';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const route = (name) => fileURLToPath(new URL(`./routes/${name}`, import.meta.url));

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
  return {
    name: options.name,
    summary: options.summary ?? '',
    intro: options.intro ?? [],
    facts: options.facts ?? null,
    publisher: { sameAs: [], ...options.publisher },
    collections,
    pages: options.pages ?? [],
    markdownFooter: options.markdownFooter ?? '',
    robots: options.robots === false ? false : { disallow: ['/cdn-cgi/'], ...(options.robots === true ? {} : options.robots) },
    linkRules: options.linkRules ?? [],
    check: { minWords: 300, ...options.check },
  };
}

/**
 * Astro integration. Adds /llms.txt, /llms-full.txt, a Markdown twin of every collection entry
 * (`/path/slug.md`) and /robots.txt, tags outbound links after the build, and records the settings
 * `seo-check` reads. See README.md.
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
