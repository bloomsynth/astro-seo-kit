# @bloomsynth/astro-seo-kit

The SEO and AI-search plumbing shared by BloomSynth's Astro sites (deva.bloomsynth.com,
bloomsynth.com, codingislove.com and the ones that follow), so every site describes itself the same
way to search engines and AI assistants and every change is checked before it is merged.

It is not a theme: each site keeps its own design and only uses the parts below.

## What's in it

| Part | What it does |
|---|---|
| `seoFields({ z, image })` | Frontmatter fields for SEO content: title (max 70), description (80-170), `primaryKeyword`, `keywords`, `tldr` (the short answer assistants quote), `faq`, `updatedDate`, `translationOf`, cover and alt. The build fails on a bad post |
| `<SeoHead>` | Title, description, canonical, Open Graph and Twitter tags, hreflang alternates, the Markdown twin link and a JSON-LD graph that always starts with the publisher Organization and the WebSite |
| `jsonld` helpers | `article`, `faqPage`, `breadcrumbs`, `softwareApplication`, `organization`, `website`, `graph`. Never add ratings or reviews that are not real |
| Routes | `/llms.txt` (an index for AI assistants), `/llms-full.txt` (every article in one file), a Markdown twin of every article at `/<path>/<slug>.md`, and `/robots.txt` that lets every crawler, AI crawlers included, read the site |
| Link tagging | After the build, adds attribution to outbound links that match a rule, e.g. the Play Store install referrer with the page's slug as campaign |
| `seo-check` | Checks the built site before a merge (see below) |
| `<Tldr>`, `<Faq>` | Unstyled markup for the short answer and the visible FAQ |

## Use it in a site

```sh
npm install github:bloomsynth/astro-seo-kit#v0.1.0   # or #<commit>
```

```js
// astro.config.mjs
import seoKit from '@bloomsynth/astro-seo-kit';

export default defineConfig({
  site: 'https://bloomsynth.com', // required
  integrations: [
    seoKit({
      name: 'BloomSynth',
      summary: 'One sentence about the site, the first thing llms.txt says.',
      intro: ['Optional paragraphs.'],
      facts: { heading: 'About', items: [['Made by', 'BloomSynth']] },
      publisher: { name: 'BloomSynth', url: 'https://bloomsynth.com', logo: '...', sameAs: ['https://github.com/bloomsynth'] },
      // Entry id "x" of collection "latteBooksGuides" is served at /latte-books/guides/x/
      collections: [{ collection: 'latteBooksGuides', path: '/latte-books/guides/', title: 'Latte Books guides' }],
      pages: [{ title: 'Latte Books', url: '/latte-books/', description: '...' }],
      markdownFooter: 'Download: https://...',
      linkRules: [{ prefix: 'https://play.google.com/store/apps/details?id=com.bloomsynth.deva', param: 'referrer', value: 'utm_source=blog&utm_medium=article&utm_campaign={campaign}' }],
      check: { minWords: 300, ignore: ['/drafts/*'] },
    }),
  ],
});
```

```ts
// src/content.config.ts
import { requireCoverAlt, seoFields } from '@bloomsynth/astro-seo-kit/schema';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: ({ image }) => requireCoverAlt(z.object({ ...seoFields({ z, image }), extra: z.string().optional() })),
});
```

```astro
---
import SeoHead from '@bloomsynth/astro-seo-kit/components/SeoHead.astro';
import { article, faqPage } from '@bloomsynth/astro-seo-kit/jsonld';
---
<head>
  <SeoHead title={title} description={description} markdown="/guides/x.md" jsonLd={[article({ ... }), faqPage(faq)]} />
</head>
```

Remove the site's own `public/robots.txt` and any hand-written `llms.txt`: the kit generates them.

## seo-check

Run it in CI after `astro build`:

```sh
npx seo-check                                  # errors fail, warnings are counted
npx seo-check --warnings                       # also list the warnings
npx seo-check --baseline seo-check-baseline.json
npx seo-check --baseline seo-check-baseline.json --update-baseline
```

Articles (entries of the configured collections) get the strict checks, since that is what writers
and agents produce:

- title present and at most 70 characters, a meta description, an absolute canonical URL, one `<h1>`
- at least `minWords` words (default 300) in the main content
- the article's own text (its Markdown twin) links to at least one other page of the site
- no near-duplicate of another article (80% of 5-word shingles shared)
- no two articles with the same title, or the same `primaryKeyword` in their frontmatter
- images have alt text, JSON-LD parses, internal links resolve to built pages

Other pages get warnings for the same content rules, and errors only for broken internal links,
invalid JSON-LD, missing titles and relative canonicals.

Sites with older content keep a **baseline** of the errors those pages already have, so only new
problems block a change. Fix old pages over time and run `--update-baseline` to shrink it.

## Develop

```sh
npm install
npm test        # node:test, no network
```

Code is plain JavaScript with JSDoc and `.d.ts` types, so it runs from `node_modules` without a
build step. Tag a release (`git tag v0.x.y && git push --tags`) and bump the tag in each site's
`package.json`.
