import { buildLlmsTxt, pageToMarkdown, textResponse } from '../llm.js';
import { config, entries, toMarkdownInput } from './_entries.js';

export async function GET() {
  const items = await entries();
  const head = buildLlmsTxt({ name: config.name, summary: config.summary, intro: config.intro, facts: config.facts });
  const pages = items.map((item) => pageToMarkdown(toMarkdownInput(item)));
  return textResponse([head, ...pages].join('\n---\n\n'));
}
