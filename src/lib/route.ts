import { OLD_SCREENS, SCREENS, type Screen } from './labels';

export type Page = 'repositories' | 'start' | 'docs' | 'screen';

export interface Route {
  page: Page;
  repo: string | null;
  screen: Screen | null;
  doc: string | null;
  anchor: string | null;
  canonical: string;
}

const screens = SCREENS.map(([id]) => id) as string[];
const screen = (id: string | undefined): Screen | null => (id && screens.includes(id) ? (id as Screen) : id ? (OLD_SCREENS[id] ?? null) : null);
const ANCHOR = /^[a-z0-9_-]+$/;

/** Reads `#/<owner>/<name>/<screen>#<anchor>`, `#/docs/<page>#<anchor>`, `#/start` and `#/`; old tab ids land on the screen that took them over. */
export function parseRoute(hash: string, repos: string[], docs: string[] = []): Route {
  const [path, rawAnchor] = hash.replace(/^#\/?/, '').split('#');
  const anchor = rawAnchor && ANCHOR.test(rawAnchor) ? rawAnchor : null;
  const parts = path.split('/').filter(Boolean);
  const tail = anchor ? '#' + anchor : '';
  if (parts.length === 1 && parts[0] === 'start') return { page: 'start', repo: null, screen: null, doc: null, anchor, canonical: '/start' + tail };
  if (parts[0] === 'docs' && parts.length <= 2 && docs.length) {
    const doc = docs.includes(parts[1]) ? parts[1] : docs[0];
    const a = doc === parts[1] ? anchor : null;
    return { page: 'docs', repo: null, screen: null, doc, anchor: a, canonical: `/docs/${doc}${a ? '#' + a : ''}` };
  }
  if (parts.length === 1 && screen(parts[0]) && repos.length) return at(repos[0], screen(parts[0])!, anchor);
  if (parts.length >= 2) {
    const repo = `${parts[0]}/${parts[1]}`;
    if (repos.includes(repo)) return at(repo, screen(parts[2]) ?? 'overview', anchor ?? (parts[2] === 'experiment' ? 'criteria' : null));
  }
  return { page: 'repositories', repo: null, screen: null, doc: null, anchor: null, canonical: '/' };
}

const at = (repo: string, s: Screen, anchor: string | null): Route => ({
  page: 'screen',
  repo,
  screen: s,
  doc: null,
  anchor,
  canonical: `/${repo}/${s}${anchor ? '#' + anchor : ''}`,
});
