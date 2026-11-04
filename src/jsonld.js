/**
 * Schema.org JSON-LD builders. Pass the nodes to <SeoHead jsonLd={[...]} />, which adds the publisher
 * Organization and the WebSite to every page so all BloomSynth sites describe one entity.
 * Never add ratings or reviews that are not real.
 */

const clean = (value) => {
  if (Array.isArray(value)) {
    const items = value.map(clean).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, clean(item)])
      .filter(([, item]) => item !== undefined && item !== '');
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value instanceof Date) return value.toISOString();
  return value === null ? undefined : value;
};

export const absolute = (url, site) => (url ? new URL(url, site).toString() : undefined);

export function organization({ name, url, logo, sameAs = [] }) {
  return clean({ '@type': 'Organization', '@id': `${new URL('/', url)}#organization`, name, url, logo, sameAs });
}

export function website({ name, url, publisher }) {
  return clean({
    '@type': 'WebSite',
    '@id': `${new URL('/', url)}#website`,
    name,
    url: new URL('/', url).toString(),
    publisher: publisher ? { '@id': `${new URL('/', publisher.url)}#organization` } : undefined,
  });
}

export function article({ title, description, url, datePublished, dateModified, image, publisher, inLanguage }) {
  return clean({
    '@type': 'Article',
    headline: title,
    description,
    url,
    mainEntityOfPage: url,
    datePublished,
    dateModified: dateModified ?? datePublished,
    image,
    inLanguage,
    author: publisher ? { '@id': `${new URL('/', publisher.url)}#organization` } : undefined,
    publisher: publisher ? { '@id': `${new URL('/', publisher.url)}#organization` } : undefined,
  });
}

export function faqPage(faq = []) {
  if (!faq.length) return undefined;
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

/** items: [{ name, url }] from the site root to the current page */
export function breadcrumbs(items = []) {
  if (items.length < 2) return undefined;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })),
  };
}

/**
 * An app or program. `price` defaults to free. `type` can be SoftwareApplication, MobileApplication
 * or WebApplication.
 */
export function softwareApplication({
  name,
  description,
  url,
  type = 'SoftwareApplication',
  applicationCategory,
  operatingSystem,
  downloadUrl,
  softwareVersion,
  license,
  codeRepository,
  image,
  price = '0',
  priceCurrency = 'USD',
  publisher,
  sameAs = [],
}) {
  return clean({
    '@type': type,
    name,
    description,
    url,
    applicationCategory,
    operatingSystem: Array.isArray(operatingSystem) ? operatingSystem.join(', ') : operatingSystem,
    downloadUrl,
    softwareVersion,
    license,
    image,
    sameAs: [codeRepository, ...sameAs],
    offers: { '@type': 'Offer', price, priceCurrency },
    publisher: publisher ? { '@id': `${new URL('/', publisher.url)}#organization` } : undefined,
  });
}

/** The full @graph for a page: publisher and site first, then the page's own nodes */
export function graph({ publisher, siteName, siteUrl, nodes = [] }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      publisher ? organization(publisher) : undefined,
      website({ name: siteName, url: siteUrl, publisher }),
      ...nodes,
    ].filter(Boolean),
  };
}
