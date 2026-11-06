import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOptions } from '../src/index.js';

const base = { name: 'Site', publisher: { name: 'Org', url: 'https://example.com' } };

test('facts may be one block or several', () => {
  const block = { heading: 'About', items: [['License', 'MIT']] };
  assert.deepEqual(normalizeOptions(base).facts, []);
  assert.deepEqual(normalizeOptions({ ...base, facts: block }).facts, [block]);
  assert.deepEqual(normalizeOptions({ ...base, facts: [block, block] }).facts, [block, block]);
});

test('sections get a trailing slash and defaults', () => {
  const { sections } = normalizeOptions({ ...base, sections: [{ path: '/app', name: 'App', facts: { heading: 'About', items: [] } }] });
  assert.deepEqual(sections, [{ path: '/app/', name: 'App', summary: '', intro: [], facts: [{ heading: 'About', items: [] }] }]);
});

test('rejects options that would build broken files', () => {
  const cases = [
    ['section at the root', { sections: [{ path: '/', name: 'Root' }] }, /section/],
    ['section without a name', { sections: [{ path: '/app/' }] }, /section/],
    ['page without a url', { pages: [{ title: 'A' }] }, /page/],
    ['facts without items', { facts: { heading: 'About' } }, /facts/],
  ];
  for (const [name, options, error] of cases) assert.throws(() => normalizeOptions({ ...base, ...options }), error, name);
});
