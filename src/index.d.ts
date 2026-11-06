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
  /** Last line of this collection's Markdown twins, instead of `markdownFooter` */
  footer?: string;
}

/** A label/value list in llms.txt, such as what a product is, costs and where to get it */
export interface FactsBlock {
  heading: string;
  items: [string, string][];
}

export interface SeoKitPage {
  title: string;
  /** Path on this site, or an absolute URL */
  url: string;
  description?: string;
  /** Pages of this site get a Markdown version built from their HTML; false turns it off */
  markdown?: boolean;
  /** Last line of this page's Markdown version, instead of `markdownFooter` */
  footer?: string;
}

/** A part of the site with its own llms.txt and llms-full.txt, e.g. a product at /latte-books/ */
export interface SeoKitSection {
  /** URL path, such as "/latte-books/" */
  path: string;
  /** The H1 of the section's llms.txt */
  name: string;
  summary?: string;
  intro?: string[];
  facts?: FactsBlock | FactsBlock[];
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
  facts?: FactsBlock | FactsBlock[];
  publisher: Publisher;
  collections?: SeoKitCollection[];
  /** Important pages outside the collections, listed first in llms.txt, with Markdown versions */
  pages?: SeoKitPage[];
  /** Parts of the site that get their own llms.txt and llms-full.txt */
  sections?: SeoKitSection[];
  /** Last line of every Markdown twin, e.g. where to download the app */
  markdownFooter?: string;
  robots?: boolean | { disallow?: string[] };
  linkRules?: LinkRule[];
  check?: { minWords?: number; ignore?: string[] };
}

export default function seoKit(options: SeoKitOptions): AstroIntegration;
export type NormalizedOptions = Required<Omit<SeoKitOptions, 'facts' | 'sections'>> & {
  facts: FactsBlock[];
  sections: (Required<Omit<SeoKitSection, 'facts'>> & { facts: FactsBlock[] })[];
};

export function normalizeOptions(options: SeoKitOptions): NormalizedOptions;
export { seoFields, requireCoverAlt } from './schema.js';
