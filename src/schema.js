/**
 * Frontmatter fields every SEO content collection shares. Pass Astro's `z` (from `astro/zod`) and the
 * schema's `image` helper, then add the site's own fields:
 *
 *   schema: ({ image }) => z.object({ ...seoFields({ z, image }), deity: z.enum(DEITIES).optional() })
 *
 * The build fails when a post breaks these rules, which is the first quality gate for agent-written posts.
 */
export function seoFields({ z, image }) {
  return {
    // Up to about 60 characters shows untruncated in Google; 70 is the hard limit
    title: z.string().min(10).max(70),
    // Meta description: answers the query in one or two sentences
    description: z.string().min(80).max(170),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // The one search or AI-assistant query this page is built to answer
    primaryKeyword: z.string().min(2),
    keywords: z.array(z.string()).default([]),
    // A complete two or three sentence answer shown at the top; what AI assistants quote
    tldr: z.string().min(80),
    // Shown as a visible FAQ and as FAQPage structured data
    faq: z.array(z.object({ q: z.string().min(5), a: z.string().min(10) })).default([]),
    cover: image ? image().optional() : z.string().optional(),
    // Describes the cover, in the page's language; required with a cover (see `requireCoverAlt`)
    coverAlt: z.string().optional(),
    // For translations: the id of the original entry, so pages can link each other with hreflang
    translationOf: z.string().optional(),
    draft: z.boolean().default(false),
  };
}

/** Refinement for an object built from `seoFields`: a cover needs alt text */
export function requireCoverAlt(schema) {
  return schema.refine((data) => !data.cover || Boolean(data.coverAlt), {
    message: 'coverAlt is required when cover is set',
    path: ['coverAlt'],
  });
}
