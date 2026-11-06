import { textResponse } from '../llm.js';
import { llmsTxt } from './_entries.js';

export async function GET() {
  return textResponse(await llmsTxt());
}
