import { textResponse } from '../llm.js';
import { config, llmsFullTxt } from './_entries.js';

/** `${section.path}llms-full.txt` for each of the `sections` option */
export function getStaticPaths() {
  return config.sections.map((section) => ({ params: { llmsSection: section.path.replace(/^\/|\/$/g, '') }, props: { section } }));
}

export async function GET({ props }) {
  return textResponse(await llmsFullTxt(props.section));
}
