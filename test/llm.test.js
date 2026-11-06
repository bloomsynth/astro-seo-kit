import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FULL_SEPARATOR, buildLlmsTxt, entryPath, insertIntoFull, markdownPath, pageToMarkdown, resolvePage } from '../src/llm.js';

test('builds entry URLs and their Markdown twins', () => {
  assert.equal(entryPath('/latte-books/guides/', 'gst-invoice'), '/latte-books/guides/gst-invoice/');
  assert.equal(entryPath('/blog', 'hi/post'), '/blog/hi/post/');
  assert.equal(entryPath('/', 'post/index'), '/post/');
  assert.equal(markdownPath('/blog/hi/post/'), '/blog/hi/post.md');
  assert.equal(markdownPath('/latte-books'), '/latte-books.md');
  assert.equal(markdownPath('/about.html'), '/about.md');
  assert.equal(markdownPath('/'), '/index.md');
});

test('resolves pages: this site gets Markdown versions, other sites and opt-outs do not', () => {
  const site = 'https://bloomsynth.com';
  const cases = [
    [{ title: 'A', url: '/latte-books/' }, 'https://bloomsynth.com/latte-books/', '/latte-books.md'],
    [{ title: 'B', url: 'https://bloomsynth.com/open-source/' }, 'https://bloomsynth.com/open-source/', '/open-source.md'],
    [{ title: 'C', url: 'https://deva.bloomsynth.com/' }, 'https://deva.bloomsynth.com/', null],
    [{ title: 'D', url: '/legal/', markdown: false }, 'https://bloomsynth.com/legal/', null],
  ];
  for (const [page, url, markdown] of cases) {
    const resolved = resolvePage(page, site);
    assert.equal(resolved.url, url, page.title);
    assert.equal(resolved.markdownPath, markdown, page.title);
    assert.equal(resolved.markdownUrl, markdown && `${site}${markdown}`, page.title);
  }
});

test('inserts page Markdown after the llms-full.txt header', () => {
  const head = '# Site\n\n> Summary\n';
  const cases = [
    ['no pages', head, [], head],
    ['header only', head, ['# Page A\n'], `${head}${FULL_SEPARATOR}# Page A\n`],
    ['before entries', `${head}${FULL_SEPARATOR}# Entry\n`, ['# Page A\n', '# Page B\n'], `${head}${FULL_SEPARATOR}# Page A\n${FULL_SEPARATOR}# Page B\n${FULL_SEPARATOR}# Entry\n`],
    ['another header: appended', '# Custom\n\n', ['# Page A\n'], `# Custom\n${FULL_SEPARATOR}# Page A\n`],
  ];
  for (const [name, full, pages, expected] of cases) assert.equal(insertIntoFull(full, head, pages), expected, name);
});

test('builds llms.txt with several facts blocks', () => {
  const text = buildLlmsTxt({
    name: 'BloomSynth',
    facts: [
      { heading: 'About Latte Books', items: [['License', 'AGPL-3.0']] },
      { heading: 'Empty', items: [] },
      { heading: 'About Medusa Mobile', items: [['License', 'MIT']] },
    ],
  });
  assert.equal(text, '# BloomSynth\n\n## About Latte Books\n\n- License: AGPL-3.0\n\n## About Medusa Mobile\n\n- License: MIT\n');
});

test('writes a Markdown twin with the quick answer and FAQ', () => {
  const markdown = pageToMarkdown({
    title: 'Open a Frappe Books file',
    description: 'How to open it.',
    url: 'https://bloomsynth.com/latte-books/guides/open/',
    published: new Date('2026-11-04T00:00:00Z'),
    tldr: 'Use File, Open.',
    body: '## Steps\n\n1. Open it.',
    faq: [{ q: 'Is it free?', a: 'Yes.' }],
    publisher: 'BloomSynth (https://bloomsynth.com)',
    footer: 'Download: https://bloomsynth.com/latte-books/download/',
  });
  assert.equal(
    markdown,
    [
      '# Open a Frappe Books file',
      '',
      '> How to open it.',
      '',
      'URL: https://bloomsynth.com/latte-books/guides/open/',
      'Published: 2026-11-04',
      'Publisher: BloomSynth (https://bloomsynth.com)',
      '',
      '## Quick answer',
      '',
      'Use File, Open.',
      '',
      '## Steps',
      '',
      '1. Open it.',
      '',
      '## Frequently asked questions',
      '',
      '### Is it free?',
      '',
      'Yes.',
      '',
      '---',
      '',
      'Download: https://bloomsynth.com/latte-books/download/',
      '',
    ].join('\n'),
  );
});

test('builds llms.txt and skips empty sections', () => {
  const text = buildLlmsTxt({
    name: 'BloomSynth',
    summary: 'A product studio.',
    facts: { heading: 'About', items: [['Made by', 'BloomSynth']] },
    sections: [
      { heading: 'Pages', links: [{ title: 'Latte Books', url: 'https://bloomsynth.com/latte-books/', description: 'Accounting' }] },
      { heading: 'Guides', links: [] },
    ],
  });
  assert.equal(
    text,
    '# BloomSynth\n\n> A product studio.\n\n## About\n\n- Made by: BloomSynth\n\n## Pages\n\n- [Latte Books](https://bloomsynth.com/latte-books/): Accounting\n',
  );
});
