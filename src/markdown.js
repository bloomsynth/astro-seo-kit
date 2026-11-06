import { parse } from 'node-html-parser';

/**
 * Markdown from a built HTML page, for the Markdown versions of pages that aren't collection entries
 * (landing, download and docs pages written as .astro files). Only the main content is kept:
 * navigation, header, footer, scripts, forms, buttons and anything `aria-hidden`, `hidden` or marked
 * `data-markdown="skip"` are left out. Links and images become absolute URLs.
 */

const SKIPPED = new Set([
  'script', 'style', 'noscript', 'template', 'nav', 'header', 'footer', 'svg', 'iframe', 'canvas',
  'button', 'form', 'input', 'select', 'textarea', 'dialog', 'video', 'audio', 'source', 'track', 'object', 'embed', 'map',
]);

const BLOCKS = new Set([
  'address', 'article', 'aside', 'blockquote', 'caption', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'hr', 'li', 'main', 'ol', 'p', 'pre',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'picture',
]);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const tagOf = (node) => (node.nodeType === ELEMENT_NODE ? (node.rawTagName ?? '').toLowerCase() : '');

function skipped(node) {
  if (node.nodeType !== ELEMENT_NODE) return node.nodeType !== TEXT_NODE;
  return (
    SKIPPED.has(tagOf(node)) ||
    node.getAttribute('aria-hidden') === 'true' ||
    node.hasAttribute('hidden') ||
    node.getAttribute('data-markdown') === 'skip'
  );
}

function hasBlock(node) {
  return node.childNodes.some((child) => child.nodeType === ELEMENT_NODE && !skipped(child) && (BLOCKS.has(tagOf(child)) || hasBlock(child)));
}

function absolute(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** Puts the Markdown markers inside the surrounding spaces: "** x **" would not render */
function wrap(text, marker) {
  const inner = text.trim();
  if (!inner) return text;
  const lead = text.startsWith(inner) ? '' : ' ';
  const trail = text.endsWith(inner) ? '' : ' ';
  return `${lead}${marker}${inner}${marker}${trail}`;
}

function image(node, base) {
  const alt = (node.getAttribute('alt') ?? '').replace(/\s+/g, ' ').trim();
  const src = node.getAttribute('src');
  // alt="" marks a decorative image
  return alt && src ? `![${alt}](${absolute(src, base)})` : '';
}

function inline(node, base) {
  if (node.nodeType === TEXT_NODE) return node.text.replace(/\s+/g, ' ');
  if (skipped(node)) return '';
  const tag = tagOf(node);
  const children = () => node.childNodes.map((child) => inline(child, base)).join('');
  switch (tag) {
    case 'br':
      return '\n';
    case 'img':
      return image(node, base);
    case 'strong':
    case 'b':
      return wrap(children(), '**');
    case 'em':
    case 'i':
      return wrap(children(), '*');
    case 's':
    case 'del':
      return wrap(children(), '~~');
    case 'code':
    case 'kbd':
    case 'samp': {
      const code = node.text.replace(/\s+/g, ' ');
      if (!code.trim()) return '';
      const fence = code.includes('`') ? '``' : '`';
      return `${fence}${code}${fence}`;
    }
    case 'q':
      return `"${children()}"`;
    case 'a': {
      const text = children();
      const href = node.getAttribute('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return text;
      if (!text.trim()) return '';
      const url = absolute(href, base);
      if (text.trim() === url || text.trim() === href) return url;
      const lead = text.startsWith(text.trimStart()) ? '' : ' ';
      const trail = text.endsWith(text.trimEnd()) ? '' : ' ';
      return `${lead}[${text.trim()}](${url})${trail}`;
    }
    default:
      return children();
  }
}

/** Collapses spaces and trims each line of an inline run */
const tidy = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

const indent = (text, prefix) =>
  text
    .split('\n')
    .map((line) => (line ? `${prefix}${line}` : line))
    .join('\n');

function list(node, base, ordered) {
  const items = node.childNodes.filter((child) => tagOf(child) === 'li' && !skipped(child));
  let number = Number.parseInt(node.getAttribute('start') ?? '1', 10) || 1;
  const lines = [];
  for (const item of items) {
    // A heading inside a list item (a card's title) reads as the item's bold label
    const content = blocks(item, base).map((text) => text.replace(/^#{1,6} (.+)$/, (_, title) => wrap(title, '**')));
    if (!content.length) continue;
    const marker = ordered ? `${number++}. ` : '- ';
    const pad = ' '.repeat(marker.length);
    const [first, ...rest] = content;
    let text = `${marker}${indent(first, pad).slice(pad.length)}`;
    for (const block of rest) text += `\n${indent(block, pad)}`;
    lines.push(text);
  }
  return lines.join('\n');
}

function table(node, base) {
  const rows = node
    .querySelectorAll('tr')
    .map((row) =>
      row.childNodes
        .filter((cell) => ['td', 'th'].includes(tagOf(cell)))
        .map((cell) => tidy(inline(cell, base)).replaceAll('\n', ' ').replaceAll('|', '\\|')),
    )
    .filter((cells) => cells.length);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((cells) => cells.length));
  const line = (cells) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  const [head, ...body] = rows;
  return [line(head), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}

function pre(node) {
  const code = node.querySelector('code') ?? node;
  const text = code.text.replace(/^\n/, '').replace(/\s+$/, '');
  if (!text) return '';
  const language = (code.getAttribute('class') ?? '').match(/(?:^|\s)language-([\w-]+)/)?.[1] ?? '';
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${language}\n${text}\n${fence}`;
}

/** An inline element (usually a card link) wrapping headings or paragraphs: link its first block */
function linkedBlocks(node, base) {
  const content = blocks(node, base, true);
  const href = node.getAttribute('href')?.trim();
  if (!content.length || !href || href.startsWith('#')) return content;
  const url = absolute(href, base);
  const heading = content.findIndex((text) => /^#{1,6} /.test(text) && !text.includes(']('));
  if (heading >= 0) {
    return content.map((text, i) => (i === heading ? text.replace(/^(#{1,6} )(.+)$/, (_, hashes, title) => `${hashes}[${title}](${url})`) : text));
  }
  const [first, ...rest] = content;
  if (!first.includes('\n') && !first.includes('](')) return [`[${first}](${url})`, ...rest];
  return [...content, url];
}

/** The Markdown blocks of an element's children */
function blocks(node, base, ignoreLink = false) {
  const out = [];
  let run = '';
  const flush = () => {
    const text = tidy(run);
    if (text) out.push(text);
    run = '';
  };
  for (const child of node.childNodes) {
    if (child.nodeType === TEXT_NODE) {
      run += inline(child, base);
      continue;
    }
    if (skipped(child)) continue;
    const tag = tagOf(child);
    const isBlock = BLOCKS.has(tag) || hasBlock(child);
    if (!isBlock) {
      const piece = inline(child, base);
      // Links laid out side by side (buttons in a flex row) have no space between them in the HTML
      run += /[)\]]$/.test(run) && /^[[!]/.test(piece) ? ` ${piece}` : piece;
      continue;
    }
    flush();
    out.push(...block(child, base, ignoreLink));
  }
  flush();
  return out.filter(Boolean);
}

function block(node, base, ignoreLink) {
  const tag = tagOf(node);
  const heading = tag.match(/^h([1-6])$/);
  if (heading) {
    const text = tidy(inline(node, base)).replaceAll('\n', ' ');
    return text ? [`${'#'.repeat(Number(heading[1]))} ${text}`] : [];
  }
  switch (tag) {
    case 'p':
    case 'figcaption':
    case 'caption':
    case 'address':
      return hasBlock(node) ? blocks(node, base) : [tidy(inline(node, base))];
    case 'summary':
    case 'dt': {
      const text = tidy(inline(node, base)).replaceAll('\n', ' ');
      return text ? [wrap(text, '**')] : [];
    }
    case 'ul':
    case 'ol':
      return [list(node, base, tag === 'ol')];
    case 'table':
      return [table(node, base)];
    case 'pre':
      return [pre(node)];
    case 'hr':
      return ['---'];
    case 'blockquote':
      return [indent(blocks(node, base).join('\n\n'), '> ').replace(/^$/gm, '>')];
    case 'a':
      return ignoreLink ? blocks(node, base) : linkedBlocks(node, base);
    default:
      return blocks(node, base, ignoreLink);
  }
}

/**
 * @param {string} html a built page
 * @param {string} url the page's absolute URL, to make links absolute
 * @returns {{ title: string | null, description: string | null, body: string }} the first `<h1>` of the
 *   main content (or the `<title>`), the meta description, and the rest of the main content as Markdown
 */
export function htmlToMarkdown(html, url) {
  const root = parse(html, { comment: false, blockTextElements: { script: true, noscript: true, style: true } });
  const main = root.querySelector('main') ?? root.querySelector('article') ?? root.querySelector('body') ?? root;
  const h1 = main.querySelectorAll('h1').find((node) => !node.closest('nav,header,footer,[aria-hidden="true"]'));
  const title = h1 ? tidy(inline(h1, url)).replaceAll('\n', ' ') : null;
  h1?.remove();
  const body = blocks(main, url).join('\n\n');
  return {
    title: title || root.querySelector('title')?.text.replace(/\s+/g, ' ').trim() || null,
    description: root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null,
    body,
  };
}
