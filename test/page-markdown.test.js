import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { normalizeOptions } from '../src/index.js';
import { FULL_SEPARATOR, buildLlmsTxt } from '../src/llm.js';
import { builtHtml, writePageMarkdown } from '../src/page-markdown.js';

const site = 'https://example.com';
const html = (h1, text) =>
  `<html><head><title>${h1} | Example</title><meta name="description" content="About ${h1}."></head><body><nav><a href="/">Home</a></nav><main><h1>${h1}</h1><p>${text} <a href="/app/download/">Download</a></p></main></body></html>`;

async function build(files) {
  const dir = await mkdtemp(join(tmpdir(), 'seo-kit-pages-'));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  return dir;
}

test('finds the built HTML of a path', async () => {
  const outDir = await build({ 'a/index.html': 'x', 'b.html': 'x' });
  assert.equal(builtHtml(outDir, '/a/'), join(outDir, 'a/index.html'));
  assert.equal(builtHtml(outDir, '/b'), join(outDir, 'b.html'));
  assert.equal(builtHtml(outDir, '/c/'), null);
});

test('writes Markdown versions of pages and adds them to the llms-full.txt files', async () => {
  const config = normalizeOptions({
    name: 'Example',
    summary: 'Example makes apps.',
    publisher: { name: 'Example Ltd', url: site },
    markdownFooter: 'Default footer',
    pages: [
      { title: 'App', url: '/app/', description: 'The app', footer: 'Get the app' },
      { title: 'Company', url: '/about/' },
      { title: 'Missing', url: '/gone/' },
      { title: 'Other site', url: 'https://other.example.org/' },
      { title: 'No twin', url: '/legal/', markdown: false },
      { title: 'Has a twin', url: '/guide/' },
    ],
    sections: [{ path: '/app/', name: 'App', summary: 'The app.' }],
  });
  const rootHead = buildLlmsTxt({ name: config.name, summary: config.summary, intro: config.intro, facts: config.facts });
  const appHead = buildLlmsTxt({ name: 'App', summary: 'The app.', facts: [] });
  const outDir = await build({
    'app/index.html': html('The app', 'Free for everyone.'),
    'about/index.html': html('About us', 'We make apps.'),
    'legal/index.html': html('Legal', 'Terms.'),
    'guide/index.html': html('Guide', 'Steps.'),
    'guide.md': '# Written by a collection\n',
    'llms-full.txt': `${rootHead}${FULL_SEPARATOR}# Entry\n`,
    'app/llms-full.txt': appHead,
  });

  const { written, warnings } = await writePageMarkdown({ outDir, site, config });
  assert.deepEqual(written, ['/app.md', '/about.md']);
  assert.deepEqual(warnings, [
    'pages: /gone/ was not built, so it has no Markdown version',
    'pages: /guide.md already exists, so it was left as it is',
  ]);
  assert.equal(existsSync(join(outDir, 'legal.md')), false);
  assert.equal(await readFile(join(outDir, 'guide.md'), 'utf8'), '# Written by a collection\n');

  const app = await readFile(join(outDir, 'app.md'), 'utf8');
  assert.equal(
    app,
    [
      '# The app',
      '',
      '> About The app.',
      '',
      'URL: https://example.com/app/',
      'Publisher: Example Ltd (https://example.com)',
      '',
      'Free for everyone. [Download](https://example.com/app/download/)',
      '',
      '---',
      '',
      'Get the app',
      '',
    ].join('\n'),
  );
  const about = await readFile(join(outDir, 'about.md'), 'utf8');
  assert.match(about, /Default footer\n$/);

  const full = await readFile(join(outDir, 'llms-full.txt'), 'utf8');
  assert.equal(full, [rootHead, app, about, '# Entry\n'].join(FULL_SEPARATOR));
  assert.equal(await readFile(join(outDir, 'app/llms-full.txt'), 'utf8'), [appHead, app].join(FULL_SEPARATOR));
});
