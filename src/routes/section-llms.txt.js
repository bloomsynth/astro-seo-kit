import { textResponse } from '../llm.js';
import { config, llmsTxt } from './_entries.js';

/** `${section.path}llms.txt` for each of the `sections` option, e.g. /latte-books/llms.txt */
export function getStaticPaths() {
  return config.sections.map((section) => ({ params: { llmsSection: section.path.replace(/^\/|\/$/g, '') }, props: { section } }));
}

export async function GET({ props }) {
  return textResponse(await llmsTxt(props.section));
}
