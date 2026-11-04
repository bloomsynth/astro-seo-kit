#!/usr/bin/env node
// Checks the built site (run `astro build` first). Reads the settings astro-seo-kit wrote to
// .astro/seo-kit.json. Exits 1 when there are errors that are not in the baseline.
//
//   seo-check [--root .] [--content src/content] [--warnings]
//             [--baseline seo-check-baseline.json] [--update-baseline]
//
// A baseline lists the errors older pages already have, so only new problems block a change.
// Regenerate it with --update-baseline after fixing old pages.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { applyBaseline, issueKey, runCheck } from '../src/check.js';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: '.' },
    content: { type: 'string', default: 'src/content' },
    warnings: { type: 'boolean', default: false },
    baseline: { type: 'string' },
    'update-baseline': { type: 'boolean', default: false },
  },
});

const root = resolve(values.root);
let settings;
try {
  settings = JSON.parse(await readFile(resolve(root, '.astro/seo-kit.json'), 'utf8'));
} catch {
  console.error('seo-check: .astro/seo-kit.json not found. Add the astro-seo-kit integration and run `astro build` first.');
  process.exit(2);
}

const { pages, issues } = await runCheck({ ...settings, contentDir: resolve(root, values.content) });
const baselineFile = values.baseline ? resolve(root, values.baseline) : null;

if (values['update-baseline']) {
  if (!baselineFile) {
    console.error('seo-check: --update-baseline needs --baseline <file>');
    process.exit(2);
  }
  const keys = [...new Set(issues.filter((issue) => issue.level === 'error').map(issueKey))].sort();
  await writeFile(baselineFile, `${JSON.stringify(keys, null, 2)}\n`);
  console.log(`seo-check: wrote ${keys.length} known errors to ${values.baseline}`);
  process.exit(0);
}

const baseline = baselineFile && existsSync(baselineFile) ? JSON.parse(await readFile(baselineFile, 'utf8')) : [];
const { newErrors, knownErrors, fixed } = applyBaseline(issues, baseline);
const warnings = issues.filter((issue) => issue.level === 'warning');
const print = (list) => {
  for (const issue of list) console.log(`  ${issue.level === 'error' ? 'x' : '!'} ${issue.path}  [${issue.rule}] ${issue.message}`);
};

console.log(
  `seo-check: ${pages} pages, ${newErrors.length} errors` +
    (baseline.length ? `, ${knownErrors.length} known errors in the baseline` : '') +
    `, ${warnings.length} warnings`,
);
if (newErrors.length) {
  console.log('\nErrors (must be fixed):');
  print(newErrors);
}
if (fixed.length) {
  console.log(`\n${fixed.length} baseline errors are fixed; run with --update-baseline to drop them from the baseline.`);
}
if (warnings.length) {
  if (values.warnings) {
    console.log('\nWarnings:');
    print(warnings);
  } else {
    console.log('\nRun with --warnings to list the warnings.');
  }
}
process.exit(newErrors.length ? 1 : 0);
