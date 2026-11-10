export function toggled(open: string | null, label: string): string | null {
  return open === label ? null : label;
}

export function afterKey(open: string | null, key: string): string | null {
  return key === 'Escape' ? null : open;
}
