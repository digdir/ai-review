import { OLD_SCREENS, SCREENS, type Screen } from './labels';

export type Page = 'repositories' | 'start' | 'screen';

export interface Route {
  page: Page;
  repo: string | null;
  screen: Screen | null;
  anchor: string | null;
  canonical: string;
}

const screens = SCREENS.map(([id]) => id) as string[];
const screen = (id: string | undefined): Screen | null => (id && screens.includes(id) ? (id as Screen) : id ? (OLD_SCREENS[id] ?? null) : null);
const ANCHOR = /^[a-z0-9-]+$/;

/** Reads `#/<owner>/<name>/<screen>#<anchor>`, `#/start` and `#/`; old tab ids land on the screen that took them over. */
export function parseRoute(hash: string, repos: string[]): Route {
  const [path, rawAnchor] = hash.replace(/^#\/?/, '').split('#');
  const anchor = rawAnchor && ANCHOR.test(rawAnchor) ? rawAnchor : null;
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 1 && parts[0] === 'start') return { page: 'start', repo: null, screen: null, anchor, canonical: '/start' + (anchor ? '#' + anchor : '') };
  if (parts.length === 1 && screen(parts[0]) && repos.length) return at(repos[0], screen(parts[0])!, anchor);
  if (parts.length >= 2) {
    const repo = `${parts[0]}/${parts[1]}`;
    if (repos.includes(repo)) return at(repo, screen(parts[2]) ?? 'overview', anchor ?? (parts[2] === 'experiment' ? 'criteria' : null));
  }
  return { page: 'repositories', repo: null, screen: null, anchor: null, canonical: '/' };
}

const at = (repo: string, s: Screen, anchor: string | null): Route => ({
  page: 'screen',
  repo,
  screen: s,
  anchor,
  canonical: `/${repo}/${s}${anchor ? '#' + anchor : ''}`,
});
