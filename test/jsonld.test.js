import assert from 'node:assert/strict';
import { test } from 'node:test';
import { faqPage, graph, softwareApplication } from '../src/jsonld.js';

const publisher = { name: 'BloomSynth', url: 'https://bloomsynth.com', sameAs: ['https://github.com/bloomsynth'] };

test('every page graph starts with the publisher and the site', () => {
  const result = graph({ publisher, siteName: 'BloomSynth', siteUrl: 'https://bloomsynth.com/', nodes: [faqPage([])] .filter(Boolean) });
  assert.equal(result['@context'], 'https://schema.org');
  assert.deepEqual(result['@graph'].map((node) => node['@type']), ['Organization', 'WebSite']);
  assert.equal(result['@graph'][1].publisher['@id'], 'https://bloomsynth.com/#organization');
});

test('describes a free app without empty fields', () => {
  const app = softwareApplication({
    name: 'Latte Books',
    url: 'https://bloomsynth.com/latte-books/',
    applicationCategory: 'BusinessApplication',
    operatingSystem: ['Windows', 'macOS', 'Linux'],
    codeRepository: 'https://github.com/bloomsynth/latte-books',
    publisher,
  });
  assert.equal(app.operatingSystem, 'Windows, macOS, Linux');
  assert.deepEqual(app.offers, { '@type': 'Offer', price: '0', priceCurrency: 'USD' });
  assert.deepEqual(app.sameAs, ['https://github.com/bloomsynth/latte-books']);
  assert.equal('description' in app, false);
  assert.equal('aggregateRating' in app, false);
});
