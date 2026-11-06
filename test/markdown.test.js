import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlToMarkdown } from '../src/markdown.js';

const url = 'https://example.com/app/download/';
const doc = (main, head = '<title>Page title</title>') =>
  `<!doctype html><html><head>${head}</head><body><header><a href="/">Logo</a></header><nav><a href="/x/">Menu</a></nav><main>${main}</main><footer>Footer text</footer></body></html>`;

const cases = [
  {
    name: 'paragraphs with inline formatting, spaces kept outside the markers',
    main: '<p>Free  for\n  <strong> Windows </strong>and <em>macOS</em>, with <code>npm ci</code>.</p>',
    body: 'Free for **Windows** and *macOS*, with `npm ci`.',
  },
  {
    name: 'links become absolute; page anchors keep only their text',
    main: '<p>See <a href="../guide/">the guide</a>, <a href="#faq">the FAQ</a> and <a href="https://github.com/x/y">https://github.com/x/y</a>.</p>',
    body: 'See [the guide](https://example.com/app/guide/), the FAQ and https://github.com/x/y.',
  },
  {
    name: 'buttons laid out side by side get a space',
    main: '<div class="flex"><a href="/app/download/">Download</a><a href="https://github.com/x/y">GitHub</a></div>',
    body: '[Download](https://example.com/app/download/) [GitHub](https://github.com/x/y)',
  },
  {
    name: 'navigation, scripts, buttons and hidden parts are left out',
    main: '<nav aria-label="Breadcrumb"><a href="/">Home</a></nav><p>Kept<span aria-hidden="true"> +</span></p><script>var x = 1;</script><button>Copy</button><div hidden>Hidden</div><p data-markdown="skip">Skipped</p><svg><text>Icon</text></svg>',
    body: 'Kept',
  },
  {
    name: 'nested and ordered lists',
    main: '<ul><li>One<ul><li>Inner</li></ul></li><li>Two</li></ul><ol start="3"><li>Third</li><li>Fourth</li></ol>',
    body: '- One\n  - Inner\n- Two\n\n3. Third\n4. Fourth',
  },
  {
    name: 'a heading inside a list item becomes its bold label',
    main: '<ul><li><h3>Fast</h3><p>Native code.</p></li></ul>',
    body: '- **Fast**\n  Native code.',
  },
  {
    name: 'a card link links its heading',
    main: '<a href="/app/"><p>Desktop app · MIT</p><h2>Latte Books</h2><p>Accounting.</p></a>',
    body: 'Desktop app · MIT\n\n## [Latte Books](https://example.com/app/)\n\nAccounting.',
  },
  {
    name: 'tables, with pipes escaped',
    main: '<table><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody><tr><th>Open</th><td>0.8 s | fast</td></tr></tbody></table>',
    body: '| Measure | Value |\n| --- | --- |\n| Open | 0.8 s \\| fast |',
  },
  {
    name: 'code blocks keep their whitespace and language',
    main: '<pre><code class="language-sh">git clone x\n  cd x &amp;&amp; npm ci\n</code></pre>',
    body: '```sh\ngit clone x\n  cd x && npm ci\n```',
  },
  {
    name: 'a code block containing a fence gets a longer one',
    main: '<pre>```\ninner\n```</pre>',
    body: '````\n```\ninner\n```\n````',
  },
  {
    name: 'images with alt text are kept, decorative ones are not',
    main: '<figure><img src="/a.png" alt="The dashboard"><figcaption>Cash flow</figcaption></figure><p><img src="/logo.svg" alt=""> Open source</p>',
    body: '![The dashboard](https://example.com/a.png)\n\nCash flow\n\nOpen source',
  },
  {
    name: 'FAQ details read as question and answer',
    main: '<details><summary>Is it free? <span aria-hidden="true">+</span></summary><p>Yes.</p></details>',
    body: '**Is it free?**\n\nYes.',
  },
  {
    name: 'blockquotes and rules',
    main: '<blockquote><p>One</p><p>Two</p></blockquote><hr><p>After</p>',
    body: '> One\n>\n> Two\n\n---\n\nAfter',
  },
  {
    name: 'line breaks stay inside the paragraph',
    main: '<p>Line one<br>Line two</p>',
    body: 'Line one\nLine two',
  },
];

for (const { name, main, body } of cases) {
  test(`htmlToMarkdown: ${name}`, () => {
    assert.equal(htmlToMarkdown(doc(`<h1>Heading</h1>${main}`), url).body, body);
  });
}

test('htmlToMarkdown takes the title from the first h1 and the meta description', () => {
  const html = doc(
    '<p>Kicker</p><h1>Download <em>Latte Books</em></h1><p>Body</p>',
    '<title>Download | Example</title><meta name="description" content=" Installers for every system. ">',
  );
  assert.deepEqual(htmlToMarkdown(html, url), {
    title: 'Download *Latte Books*',
    description: 'Installers for every system.',
    body: 'Kicker\n\nBody',
  });
});

test('htmlToMarkdown falls back to the <title> and to <body> without <main>', () => {
  const html = '<html><head><title>Only a title</title></head><body><header>Site</header><p>Text</p></body></html>';
  assert.deepEqual(htmlToMarkdown(html, url), { title: 'Only a title', description: null, body: 'Text' });
});
