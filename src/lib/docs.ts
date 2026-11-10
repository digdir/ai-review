export const docHref = (page: string, anchor?: string): string =>
  `https://github.com/digdir/ai-review/blob/main/docs/${page}.md${anchor ? '#' + anchor : ''}`;
