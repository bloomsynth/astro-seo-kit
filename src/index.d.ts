import type { AstroIntegration } from 'astro';

export interface Publisher {
  name: string;
  url: string;
  logo?: string;
  /** Profiles and sister sites of the same publisher, for the Organization's sameAs */
  sameAs?: string[];
}

export interface SeoKitCollection {
  /** Content collection name */
  collection: string;
  /** URL path the entries are served under: entry id "x" -> `${path}x/` */
  path: string;
  /** Section heading in llms.txt */
  title?: string;
}

export interface LinkRule {
  prefix: string;
  param: string;
  /** May use {campaign} (the page slug) and {path} */
  value: string;
}

export interface SeoKitOptions {
  name: string;
  summary?: string;
  intro?: string[];
  facts?: { heading: string; items: [string, string][] };
  publisher: Publisher;
  collections?: SeoKitCollection[];
  /** Important pages outside the collections, listed first in llms.txt */
  pages?: { title: string; url: string; description?: string }[];
  /** Last line of every Markdown twin, e.g. where to download the app */
  markdownFooter?: string;
  robots?: boolean | { disallow?: string[] };
  linkRules?: LinkRule[];
  check?: { minWords?: number; ignore?: string[] };
}

export default function seoKit(options: SeoKitOptions): AstroIntegration;
export function normalizeOptions(options: SeoKitOptions): Required<SeoKitOptions>;
export { seoFields, requireCoverAlt } from './schema.js';
