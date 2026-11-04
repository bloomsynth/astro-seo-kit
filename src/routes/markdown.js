import { markdownResponse, pageToMarkdown } from '../llm.js';
import { entries, toMarkdownInput } from './_entries.js';

export async function getStaticPaths() {
  return (await entries()).map((item) => ({
    params: { mdpath: item.markdownPath.replace(/^\//, '').replace(/\.md$/, '') },
    props: { item },
  }));
}

export function GET({ props }) {
  return markdownResponse(pageToMarkdown(toMarkdownInput(props.item)));
}
