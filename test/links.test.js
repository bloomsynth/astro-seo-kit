import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { campaignFromPath, pagePathOf, tagHtml, tagLinksInDir, tagUrl } from '../src/links.js';

const PLAY = 'https://play.google.com/store/apps/details?id=com.bloomsynth.deva';
const rules = [{ prefix: PLAY, param: 'referrer', value: 'utm_source=blog&utm_medium=article&utm_campaign={campaign}' }];

test('tags matching links once, with the page slug as campaign', () => {
  const cases = [
    [PLAY, '/blog/talk-to-shiva-app/', `${PLAY}&referrer=utm_source%3Dblog%26utm_medium%3Darticle%26utm_campaign%3Dtalk-to-shiva-app`],
    [`${PLAY}&referrer=already`, '/blog/x/', null],
    ['https://example.com/', '/blog/x/', null],
    [PLAY, '/', `${PLAY}&referrer=utm_source%3Dblog%26utm_medium%3Darticle%26utm_campaign%3Dhome`],
  ];
  for (const [href, path, expected] of cases) assert.equal(tagUrl(href, rules, path), expected, href);
});

test('rewrites anchors in HTML and keeps entities valid', () => {
  const html = `<a class="b" href="${PLAY}&amp;hl=en">Get</a> <a href='https://example.com/'>x</a> <link href="${PLAY}">`;
  const { html: output, count } = tagHtml(html, rules, '/blog/post/');
  assert.equal(count, 1);
  assert.match(output, /href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.bloomsynth\.deva&amp;hl=en&amp;referrer=/);
  assert.match(output, /<link href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.bloomsynth\.deva">/, 'only anchors change');
});

test('maps built files to page paths and campaigns', () => {
  assert.equal(pagePathOf('index.html'), '/');
  assert.equal(pagePathOf(join('latte-books', 'guides', 'x', 'index.html')), '/latte-books/guides/x/');
  assert.equal(pagePathOf('404.html'), '/404');
  assert.equal(campaignFromPath('/latte-books/guides/x/'), 'x');
});

test('tags every page of a built site', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seo-kit-links-'));
  await mkdir(join(dir, 'blog', 'a'), { recursive: true });
  await writeFile(join(dir, 'blog', 'a', 'index.html'), `<a href="${PLAY}">x</a>`);
  await writeFile(join(dir, 'index.html'), '<a href="/">home</a>');
  assert.deepEqual(await tagLinksInDir(dir, rules), { pages: 1, links: 1 });
  assert.match(await readFile(join(dir, 'blog', 'a', 'index.html'), 'utf8'), /utm_campaign%3Da/);
});
