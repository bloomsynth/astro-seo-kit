# astro-seo-kit

Public SEO and AI-search plumbing for Astro content sites, maintained by BloomSynth and used on its sites. Read README.md first; it is the user-facing documentation, so keep it accurate when behavior changes.

- Plain JavaScript (ESM) with JSDoc and `src/index.d.ts`; no build step, because sites install it from GitHub and Node does not strip types inside `node_modules`.
- `src/index.js` is the integration; `src/routes/*.js` are injected routes and read the site's options from the virtual module `virtual:astro-seo-kit/config`; keep them free of site-specific logic.
- Pure logic lives in `src/llm.js`, `src/markdown.js` (HTML to Markdown), `src/links.js`, `src/jsonld.js` and `src/check.js`, plus the after-build step `src/page-markdown.js` (Markdown versions of `pages`); all of it is tested with `node --test` (`npm test`). Tests use temp directories and never the network.
- `seo-check` errors block merges on every site: add a rule only when it catches a real problem, keep content rules strict for articles and lenient for other pages, and support the baseline.
- Never emit ratings, reviews or claims a site didn't provide.
- Changes are released by tagging `vX.Y.Z`; sites pin a tag. Commit messages: Conventional Commits.
