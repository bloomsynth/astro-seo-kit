# astro-seo-kit

SEO and AI-search plumbing for [Astro](https://astro.build) content sites, in one integration:

- **Frontmatter fields** that make every article answer one query: title and description limits, a primary keyword, a short answer and an FAQ, checked at build time.
- **`<SeoHead>`**: title, description, canonical, Open Graph and Twitter tags, hreflang alternates, and a JSON-LD graph that always describes your organization and site.
- **JSON-LD helpers** for articles, FAQs, breadcrumbs and software applications.
- **Files for AI assistants and crawlers**: `/llms.txt`, `/llms-full.txt`, a Markdown version of every article and of every page you list (built from its HTML), an `llms.txt` per section of the site, and a `robots.txt` that lets every crawler in.
- **Outbound link attribution** added to the built HTML, for example the Play Store install referrer with the page's slug as the campaign.
- **`seo-check`**, a command that checks the built site before you merge a change: thin pages, missing internal links, near-duplicates, broken links, two pages targeting the same keyword. It supports a baseline so older sites can adopt it without fixing everything first.

It is not a theme. Your site keeps its own layout and styles; you use the parts you want.

Built and used by [BloomSynth](https://bloomsynth.com) on its own sites. MIT licensed.

## Requirements

- Astro 7 with static output (the generated routes are prerendered). Other versions are untested.
- Node.js 22.12 or later.
- `site` set in `astro.config.mjs`.
- [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/) if you want `robots.txt` to point at `/sitemap-index.xml`.

## Install

The kit is installed from GitHub. Pin a release tag or a commit so builds don't change under you:

```sh
npm install github:bloomsynth/astro-seo-kit#<tag-or-commit>
```

## Quick start

**1. Add the integration** in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import seoKit from '@bloomsynth/astro-seo-kit';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    sitemap(),
    seoKit({
      name: 'Example',
      summary: 'Example makes free accounting software for small businesses.',
      publisher: { name: 'Example Ltd', url: 'https://example.com', logo: 'https://example.com/logo.png' },
      collections: [{ collection: 'guides', path: '/guides/', title: 'Guides' }],
    }),
  ],
});
```

**2. Use the frontmatter fields** in `src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { requireCoverAlt, seoFields } from '@bloomsynth/astro-seo-kit/schema';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: ({ image }) => requireCoverAlt(z.object({ ...seoFields({ z, image }) })),
});

export const collections = { guides };
```

**3. Render the head tags** in your layout:

```astro
---
import SeoHead from '@bloomsynth/astro-seo-kit/components/SeoHead.astro';
const { title, description } = Astro.props;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <SeoHead {title} {description} />
  </head>
  <body><slot /></body>
</html>
```

**4. Remove** any `public/robots.txt` or hand-written `llms.txt`: the kit generates them.

**5. Check the build:**

```sh
npx astro build && npx seo-check --warnings
```

## Integration options

| Option | Type | Default | What it does |
|---|---|---|---|
| `name` | `string` | required | Site name: the title of `llms.txt` and `og:site_name` |
| `publisher` | `{ name, url, logo?, sameAs? }` | required | The organization behind the site. It is the first node of every page's JSON-LD graph. `sameAs` lists the organization's own profiles, such as GitHub or LinkedIn |
| `summary` | `string` | `''` | One sentence about the site, quoted at the top of `llms.txt` |
| `intro` | `string[]` | `[]` | Paragraphs after the summary in `llms.txt` |
| `facts` | `{ heading, items: [label, value][] }`, or a list of them | none | Label/value lists in `llms.txt`, such as what each product is, what it costs and where to get it |
| `collections` | `{ collection, path, title?, footer? }[]` | `[]` | Content collections served as pages. The entry with id `x` is expected at `${path}x/`. These collections get Markdown versions, `llms.txt` sections and the strict article checks. `footer` replaces `markdownFooter` for the collection |
| `pages` | `{ title, url, description?, markdown?, footer? }[]` | `[]` | Important pages outside the collections, such as landing, download and docs pages written as `.astro` files. They are listed first in `llms.txt` and, when they are on this site, get a Markdown version made from their HTML and their full text in `llms-full.txt` (see below). `markdown: false` turns that off for a page; `footer` replaces `markdownFooter` |
| `sections` | `{ path, name, summary?, intro?, facts? }[]` | `[]` | Parts of the site with their own `${path}llms.txt` and `${path}llms-full.txt`, for example a product at `/docs/` or `/my-app/`. Each lists only the pages and entries under its path |
| `markdownFooter` | `string` | `''` | The last line of every Markdown version, for example where to download your app |
| `robots` | `false \| true \| { disallow?: string[] }` | `{ disallow: ['/cdn-cgi/'] }` | Generates `/robots.txt`. `false` turns it off. The `/cdn-cgi/` default suits Cloudflare-hosted sites |
| `linkRules` | `{ prefix, param, value }[]` | `[]` | Outbound link attribution (see below) |
| `check` | `{ minWords?, ignore? }` | `{ minWords: 300 }` | `seo-check` settings: minimum words per article, and paths to skip (`'/drafts/*'` matches a prefix) |

## Frontmatter fields

`seoFields({ z, image })` returns these fields. Spread them into your own schema and add whatever else your site needs.

| Field | Rule | Why |
|---|---|---|
| `title` | 10-70 characters | Around 60 characters show untruncated in Google |
| `description` | 80-170 characters | The meta description: answer the query in a sentence or two |
| `pubDate`, `updatedDate?` | dates | Shown in the Markdown versions and in `Article` JSON-LD |
| `primaryKeyword` | required | The one query the page answers. `seo-check` fails when two pages share one |
| `keywords` | `string[]` | Close variants |
| `tldr` | at least 80 characters | A two or three sentence answer at the top of the page; AI assistants quote it |
| `faq` | `{ q, a }[]` | A visible FAQ and `FAQPage` JSON-LD |
| `cover`, `coverAlt?` | image | `requireCoverAlt` makes alt text required whenever there is a cover |
| `translationOf?` | entry id | Links translations of a page for hreflang |
| `draft` | boolean, default `false` | Drafts are left out of every generated file |

The generated routes read `title`, `description`, `pubDate`, `updatedDate`, `tldr`, `faq` and `draft` from your entries. If you don't use `seoFields`, give your collection at least `title` and `description`.

## `<SeoHead>` props

| Prop | Type | Default |
|---|---|---|
| `title`, `description` | `string` | required |
| `canonical` | `string` | the current URL on `site` |
| `image`, `imageAlt` | `string` | none: path or URL of the share image |
| `type` | `'website' \| 'article'` | `'website'` |
| `noindex` | `boolean` | `false`: emits `noindex, follow` |
| `alternates` | `{ lang, href }[]` | `[]`: hreflang links. Include the page itself |
| `markdown` | `string` | the Markdown version of a page listed in `pages`, otherwise none: emitted as `<link rel="alternate" type="text/markdown">` |
| `jsonLd` | `object[]` | `[]`: nodes added after the publisher Organization and the WebSite |
| `publishedTime`, `modifiedTime` | `Date` | none |

The kit also ships two unstyled components: `Tldr.astro` (the short answer, class `seo-kit-tldr`) and `Faq.astro` (questions in `<details>` elements, class `seo-kit-faq`).

## JSON-LD helpers

```js
import { article, breadcrumbs, faqPage, softwareApplication } from '@bloomsynth/astro-seo-kit/jsonld';

const jsonLd = [
  article({ title, description, url, datePublished, dateModified, image, publisher }),
  faqPage(faq),
  breadcrumbs([{ name: 'Home', url: 'https://example.com/' }, { name: 'Guides', url: 'https://example.com/guides/' }]),
  softwareApplication({
    name: 'Example Books',
    url: 'https://example.com/',
    applicationCategory: 'FinanceApplication',
    operatingSystem: ['Windows', 'macOS', 'Linux'],
    codeRepository: 'https://github.com/example/books',
    publisher,
  }),
];
```

The helpers drop empty fields. `softwareApplication` defaults to a free `Offer` (`price: '0'`). The kit never adds ratings or reviews; only add them if they are real.

## Generated files

| Path | Contents |
|---|---|
| `/llms.txt` | Name, summary, intro, facts, then your `pages` and a section per collection linking to the Markdown versions ([llms.txt](https://llmstxt.org/) format) |
| `/llms-full.txt` | The same header, then every page in `pages` and every article in full |
| `/<path>/<slug>.md` | One Markdown version per collection entry: title, description, URL, dates, the short answer, the body and the FAQ |
| `/<page>.md` | One Markdown version per page in `pages` (`/download/` -> `/download.md`, `/` -> `/index.md`): its `<h1>`, meta description, URL and main content |
| `<section>/llms.txt`, `<section>/llms-full.txt` | The same two files for each of `sections`, with only what is under its path |
| `/robots.txt` | `Allow: /` for every user agent, your `disallow` paths, and the sitemap |

Markdown versions of articles are built from the entry's raw body, so MDX components show up as source.

Markdown versions of `pages` are made from the built HTML after `astro build`, so `astro dev` doesn't serve them. Only the main content is kept: `<main>` (or `<article>`, or `<body>`) without its navigation, header, footer, scripts, forms, buttons and anything `aria-hidden`, `hidden` or marked `data-markdown="skip"`. Headings, paragraphs, lists, tables, code blocks, images with alt text, and FAQ `<details>` come through; links become absolute. They are written after link attribution, so they carry the same tagged links as the HTML. If a page isn't built, or a Markdown file already exists at its path, the build logs a warning and leaves it out.

## Outbound link attribution

After the build, each `<a href>` in the HTML that starts with a rule's `prefix` gets the rule's query parameter, unless it already has one. In `value`, `{campaign}` is the page's last path segment (`home` for `/`) and `{path}` is its path:

```js
linkRules: [
  {
    prefix: 'https://play.google.com/store/apps/details?id=com.example.app',
    param: 'referrer',
    value: 'utm_source=blog&utm_medium=article&utm_campaign={campaign}',
  },
],
```

Because tagging runs on the built HTML, it covers links in Markdown, MDX and components alike.

## seo-check

`seo-check` reads the settings the integration writes to `.astro/seo-kit.json` during `astro build`, so build first.

```sh
npx seo-check                     # errors fail with exit code 1; warnings are counted
npx seo-check --warnings          # also list the warnings
npx seo-check --root site --content src/content
npx seo-check --baseline seo-check-baseline.json
npx seo-check --baseline seo-check-baseline.json --update-baseline
```

**Articles**, meaning entries of the configured collections, get strict checks. Each of these is an error:

- a missing title, or one longer than 70 characters
- a missing meta description or canonical URL; the canonical must be absolute
- not exactly one `<h1>`
- fewer than `minWords` words in the main content (navigation, header and footer don't count)
- no link in the article's own text (its Markdown version) to another page of the site; the home page and links added by your templates don't count
- 80% or more of its text shared with another article (5-word shingles)
- the same title as another page
- the same `primaryKeyword` in the frontmatter as another non-draft page
- images without alt text

**Every page** fails on broken internal links, invalid JSON-LD, a missing title and a relative canonical URL. On pages that aren't articles, the other rules are warnings.

**Every `llms.txt`** (the site's and each section's) fails on links to this site that the build doesn't contain, such as a page you removed but still list in `pages`.

**Baseline.** An older site may have hundreds of thin or unlinked posts. Run `--update-baseline` once to record the errors that exist today; after that only new errors fail. Fix old pages over time and update the baseline to shrink it. Errors are matched by page and rule, not by message.

**In GitHub Actions:**

```yaml
name: SEO check
on: [pull_request]
jobs:
  seo-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npx seo-check --baseline seo-check-baseline.json
```

## Lower-level modules

The pure functions behind the routes are exported too, so you can build your own routes:

- `@bloomsynth/astro-seo-kit/llm`: `pageToMarkdown`, `buildLlmsTxt`, `entryPath`, `markdownPath`, `resolvePage`, `insertIntoFull`
- `@bloomsynth/astro-seo-kit/markdown`: `htmlToMarkdown`, Markdown from a built HTML page
- `@bloomsynth/astro-seo-kit/links`: `tagUrl`, `tagHtml`, `tagLinksInDir`, `campaignFromPath`

## Contributing

Issues and pull requests are welcome.

```sh
npm install
npm test   # node:test, no network
```

The code is plain JavaScript with JSDoc and a `.d.ts` file, with no build step, because it runs straight from `node_modules`. Keep `seo-check` rules to problems that really hurt a page; every rule blocks merges for the sites that use it.

## License

[MIT](LICENSE)
