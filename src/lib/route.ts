import { OLD_VIEWS, VIEWS, type View } from './labels';

export interface Route {
  repo: string | null;
  view: View | null;
  canonical: string;
}

const views = VIEWS.map(([id]) => id) as string[];
const view = (id: string | undefined): View | null => (id && views.includes(id) ? (id as View) : id ? (OLD_VIEWS[id] ?? null) : null);

/** Reads `#/<owner>/<name>/<tab>`; a bare `#/<tab>` from before the overview opens that tab for the first repository. */
export function parseRoute(hash: string, repos: string[]): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 1 && view(parts[0]) && repos.length) return at(repos[0], view(parts[0])!);
  if (parts.length >= 2) {
    const repo = `${parts[0]}/${parts[1]}`;
    if (repos.includes(repo)) return at(repo, view(parts[2]) ?? 'overview');
  }
  return { repo: null, view: null, canonical: '/' };
}

const at = (repo: string, v: View): Route => ({ repo, view: v, canonical: `/${repo}/${v}` });
