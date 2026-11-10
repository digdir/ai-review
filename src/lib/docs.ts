import pages from 'virtual:docs';

export const DOCS = pages;
export const DOC_IDS = pages.map((p) => p.id);

export const docHref = (page: string, anchor?: string): string => `#/docs/${page}${anchor ? '#' + anchor : ''}`;

export function docLabel(page: string, anchor?: string): string {
  const p = pages.find((x) => x.id === page);
  const h = anchor ? p?.headings.find((x) => x.id === anchor) : undefined;
  return h ? `${h.text}, in ${p!.title}` : (p?.title ?? 'The docs');
}
