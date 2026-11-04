import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLlmsTxt, entryPath, markdownPath, pageToMarkdown } from '../src/llm.js';

test('builds entry URLs and their Markdown twins', () => {
  assert.equal(entryPath('/latte-books/guides/', 'gst-invoice'), '/latte-books/guides/gst-invoice/');
  assert.equal(entryPath('/blog', 'hi/post'), '/blog/hi/post/');
  assert.equal(entryPath('/', 'post/index'), '/post/');
  assert.equal(markdownPath('/blog/hi/post/'), '/blog/hi/post.md');
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
