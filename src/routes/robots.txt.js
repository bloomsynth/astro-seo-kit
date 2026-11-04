import config from 'virtual:astro-seo-kit/config';
import { textResponse } from '../llm.js';

// Every crawler, AI crawlers included, may read the whole site: being read by assistants is the point.
export function GET() {
  const lines = ['User-agent: *', 'Allow: /', ...config.robots.disallow.map((path) => `Disallow: ${path}`), ''];
  lines.push(`Sitemap: ${new URL('/sitemap-index.xml', config.site)}`, '');
  return textResponse(lines.join('\n'));
}
