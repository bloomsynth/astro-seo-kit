import { textResponse } from '../llm.js';
import { llmsFullTxt } from './_entries.js';

export async function GET() {
  return textResponse(await llmsFullTxt());
}
