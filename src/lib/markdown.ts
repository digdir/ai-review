import { Marked, type Token } from 'marked';

export interface DocHeading {
  id: string;
  text: string;
  depth: number;
}

export interface DocPage {
  id: string;
  title: string;
  html: string;
  headings: DocHeading[];
}

export const DOC_ORDER = ['experiment', 'working-with-the-review', 'runbook', 'grading', 'joining', 'platform'];
export const SOURCE = 'https://github.com/digdir/ai-review/blob/main/';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The anchor GitHub gives a heading, so links written for GitHub keep working. */
export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

const plain = (tokens: Token[]): string =>
  tokens.map((t) => ('tokens' in t && t.tokens ? plain(t.tokens) : 'text' in t ? String(t.text) : '')).join('');

export function rewriteHref(href: string, page: string, pages: string[]): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return href;
  if (href.startsWith('#')) return `#/docs/${page}${href}`;
  const [path, anchor] = href.split('#');
  const resolved = new URL(path, 'https://repo/docs/').pathname.slice(1);
  const doc = /^docs\/([\w-]+)\.md$/.exec(resolved)?.[1];
  const tail = anchor ? '#' + anchor : '';
  return doc && pages.includes(doc) ? `#/docs/${doc}${tail}` : `${SOURCE}${resolved}${tail}`;
}

export function renderDoc(id: string, md: string, pages: string[]): DocPage {
  const headings: DocHeading[] = [];
  const seen = new Map<string, number>();
  let title = '';
  const marked = new Marked({
    gfm: true,
    async: false,
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const text = plain(tokens);
        if (depth === 1 && !title) {
          title = text;
          return '';
        }
        const base = slug(text);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const hid = n ? `${base}-${n}` : base;
        headings.push({ id: hid, text, depth });
        return `<h${depth} id="${hid}">${inner}<a class="anchor" href="#/docs/${id}#${hid}" aria-label="Link to ${escape(text)}">#</a></h${depth}>\n`;
      },
      link({ href, title: tip, tokens }) {
        const t = tip ? ` title="${escape(tip)}"` : '';
        return `<a href="${escape(rewriteHref(href, id, pages))}"${t}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text }) {
        return `<img src="${escape(rewriteHref(href, id, []).replace('/blob/', '/raw/'))}" alt="${escape(text)}">`;
      },
      html({ text }) {
        return escape(text);
      },
    },
  });
  const html = marked.parse(md) as string;
  return { id, title: title || id, html, headings };
}

/** Renders every page and orders them as the docs nav lists them. */
export function renderDocs(files: Record<string, string>): DocPage[] {
  const pages = Object.keys(files);
  const rank = (p: string) => (DOC_ORDER.includes(p) ? DOC_ORDER.indexOf(p) : DOC_ORDER.length);
  return pages.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((p) => renderDoc(p, files[p], pages));
}
