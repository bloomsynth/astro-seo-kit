import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkPages, duplicateKeywords, markdownLinks, parsePage, primaryKeywords, runCheck } from '../src/check.js';

const site = 'https://bloomsynth.com';
const collections = [{ collection: 'guides', path: '/latte-books/guides/' }];
const words = (n, seed = 'word') => Array.from({ length: n }, (_, i) => `${seed}${i % 97} ${i}`).join(' ');

function page({ title = 'A good title for this page', description = 'A description that is long enough to pass the length check for meta descriptions on pages.', body = words(400), links = '', h1 = '<h1>Heading</h1>', head = '' } = {}) {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="https://bloomsynth.com/x/">${head}</head><body><nav><a href="/">Home</a></nav><main>${h1}<p>${body}</p>${links}</main></body></html>`;
}

async function site_(files) {
  const dir = await mkdtemp(join(tmpdir(), 'seo-kit-check-'));
  for (const [path, html] of Object.entries(files)) {
    const file = join(dir, path.replace(/^\//, ''), 'index.html');
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, html);
  }
  return dir;
}

const rules = (issues, path) => issues.filter((issue) => issue.path === path).map((issue) => `${issue.level}:${issue.rule}`).sort();

test('content pages get the strict checks', async () => {
  const outDir = await site_({
    '/': page({ title: 'Home page title here', links: '<a href="/latte-books/guides/good/">g</a>' }),
    '/latte-books/guides/': page({ title: 'Guides index title', body: 'short' }),
    '/latte-books/guides/good/': page({ title: 'Good guide title here', links: '<a href="/latte-books/guides/thin/">t</a>' }),
    '/latte-books/guides/thin/': page({ title: 'Thin guide title here', body: words(50, 'thin'), links: '<a href="/missing/">m</a>', h1: '' }),
    '/latte-books/guides/copy/': page({ title: 'Copied guide title', links: '<a href="/latte-books/guides/good/">g</a>' }),
  });
  const { issues } = await runCheck({ site, outDir, collections, check: {}, contentDir: join(outDir, 'none') });
  assert.deepEqual(rules(issues, '/latte-books/guides/good/'), ['error:near-duplicate'], 'good and copy share their text');
  assert.deepEqual(rules(issues, '/latte-books/guides/thin/'), ['error:broken-link', 'error:h1', 'error:thin']);
  assert.deepEqual(rules(issues, '/latte-books/guides/copy/'), ['error:near-duplicate']);
  assert.deepEqual(rules(issues, '/latte-books/guides/'), [], 'the collection index is not an article');
});

test('other pages only get warnings for content rules', async () => {
  const about = page({ body: 'short' }).replace(/<meta name="description"[^>]*>/, '').replace('<h1>Heading</h1>', '');
  const outDir = await site_({ '/': page({ title: 'Home page title here' }), '/about/': about });
  const pages = [parsePage(about, '/about/')];
  assert.deepEqual(rules(checkPages(pages, { site, outDir, collections }), '/about/'), ['warning:description', 'warning:h1']);
});

test('ignores navigation text and reads metadata', () => {
  const parsed = parsePage(
    page({ head: '<meta name="robots" content="noindex"><script type="application/ld+json">{bad</script>', body: 'one two three' }),
    '/x/',
  );
  assert.equal(parsed.noindex, true);
  assert.equal(parsed.words.length, 4, 'Heading plus three words; nav "Home" is not counted');
  assert.equal(parsed.jsonLdErrors.length, 1);
});

test('finds primary keywords used twice', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seo-kit-keywords-'));
  await writeFile(join(dir, 'a.md'), "---\ntitle: A\nprimaryKeyword: 'Frappe Books alternative'\n---\nx");
  await writeFile(join(dir, 'b.md'), '---\ntitle: B\nprimaryKeyword: frappe  books alternative\n---\nx');
  await writeFile(join(dir, 'c.md'), "---\ntitle: C\nprimaryKeyword: 'Frappe Books alternative'\ndraft: true\n---\nx");
  await writeFile(join(dir, 'd.md'), "---\ntitle: D\nprimaryKeyword: 'it''s free'\n---\nx");
  const keywords = await primaryKeywords(dir);
  assert.equal(keywords.length, 3);
  assert.deepEqual(duplicateKeywords(keywords).map((d) => d.keyword), ['frappe books alternative']);
});

test('the written text must link to another page of the site', async () => {
  const outDir = await site_({
    '/': page({ title: 'Home page title here' }),
    '/latte-books/download/': page({ title: 'Download page title' }),
    '/latte-books/guides/a/': page({ title: 'Guide A title here', links: '<a href="/latte-books/download/">template link</a>' }),
    '/latte-books/guides/b/': page({ title: 'Guide B title here', body: words(400, 'bee'), links: '<a href="/latte-books/download/">template link</a>' }),
  });
  await writeFile(join(outDir, 'latte-books/guides/a.md'), '# A\n\nSee [download](/latte-books/download/) and [home](/).');
  await writeFile(join(outDir, 'latte-books/guides/b.md'), '# B\n\nOnly [home](https://bloomsynth.com/) and [elsewhere](https://example.com/).');
  const { issues } = await runCheck({ site, outDir, collections, check: {}, contentDir: join(outDir, 'none') });
  assert.deepEqual(rules(issues, '/latte-books/guides/a/'), []);
  assert.deepEqual(rules(issues, '/latte-books/guides/b/'), ['error:internal-links']);
});

test('reads Markdown link targets', () => {
  assert.deepEqual(markdownLinks('[a](/x/) text [b]( https://s/y "title") ![img](/i.png)'), ['/x/', 'https://s/y', '/i.png']);
});

test('a baseline lets known errors pass and reports fixed ones', async () => {
  const { applyBaseline } = await import('../src/check.js');
  const issues = [
    { path: '/old/', level: 'error', rule: 'thin', message: '90 words' },
    { path: '/new/', level: 'error', rule: 'thin', message: '80 words' },
    { path: '/old/', level: 'warning', rule: 'description', message: 'short' },
  ];
  const result = applyBaseline(issues, ['/old/|thin', '/gone/|h1']);
  assert.deepEqual(result.newErrors.map((issue) => issue.path), ['/new/']);
  assert.deepEqual(result.knownErrors.map((issue) => issue.path), ['/old/']);
  assert.deepEqual(result.fixed, ['/gone/|h1']);
});
